import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const apply = process.argv.includes("--apply");
const databaseDir = join(process.cwd(), ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

if (!existsSync(databaseDir)) throw new Error(`本地D1目录不存在：${databaseDir}`);

const databaseFile = readdirSync(databaseDir)
  .filter(name => name.endsWith(".sqlite") && name !== "metadata.sqlite")
  .map(name => join(databaseDir, name))[0];

if (!databaseFile) throw new Error("未找到本地D1业务数据库。请先启动或迁移本地Demo。");

const db = new DatabaseSync(databaseFile);
const candidateWhere = [
  "name LIKE 'G6验收%'",
  "name LIKE 'UI验收%'",
  "name LIKE '线索验收%'",
  "name LIKE '批次二招标线索验收%'",
  "name LIKE 'TST-%'",
  "name LIKE 'EPC验收%'",
].join(" OR ");
const projects = db.prepare(`SELECT rowid,id,project_code,procurement_intent_id,name FROM sales_projects WHERE ${candidateWhere} ORDER BY created_at`).all();

console.log(`验收数据候选：${projects.length} 个项目`);
for (const project of projects) console.log(`- ${project.project_code} | ${project.name}`);

if (!projects.length || !apply) {
  if (!apply) console.log("当前为只读预览；确认范围后使用 --apply 执行清理。");
  db.close();
  process.exit(0);
}

const safeName = name => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`非法数据库标识符：${name}`);
  return `"${name}"`;
};
const placeholders = values => values.map(() => "?").join(",");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all().map(row => String(row.name));
const columns = new Map(tables.map(table => [table, db.prepare(`PRAGMA table_info(${safeName(table)})`).all().map(row => String(row.name))]));
const selected = new Map(tables.map(table => [table, new Set()]));
const projectIds = projects.map(row => String(row.id));
const projectCodes = projects.map(row => String(row.project_code));
const intentIds = projects.map(row => String(row.procurement_intent_id));

for (const row of projects) selected.get("sales_projects")?.add(Number(row.rowid));

function selectRowids(table, column, values) {
  if (!values.length || !columns.get(table)?.includes(column)) return false;
  const rows = db.prepare(`SELECT rowid FROM ${safeName(table)} WHERE ${safeName(column)} IN (${placeholders(values)})`).all(...values);
  const bucket = selected.get(table);
  const before = bucket.size;
  for (const row of rows) bucket.add(Number(row.rowid));
  return bucket.size > before;
}

for (const table of tables) {
  selectRowids(table, "project_id", projectIds);
  selectRowids(table, "sales_project_id", projectIds);
  selectRowids(table, "converted_project_id", projectIds);
  selectRowids(table, "project_code", projectCodes);
  selectRowids(table, "sales_project_code", projectCodes);
}
selectRowids("procurement_intents", "id", intentIds);

// Follow declared foreign keys downward so Gate snapshots, review items and other
// child records are deleted with their acceptance-test aggregate.
let changed = true;
while (changed) {
  changed = false;
  for (const table of tables) {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${safeName(table)})`).all();
    for (const fk of foreignKeys) {
      const parent = String(fk.table);
      const parentRows = [...(selected.get(parent) ?? [])];
      if (!parentRows.length) continue;
      const parentColumn = String(fk.to || "id");
      const childColumn = String(fk.from);
      const values = db.prepare(`SELECT ${safeName(parentColumn)} AS value FROM ${safeName(parent)} WHERE rowid IN (${placeholders(parentRows)})`).all(...parentRows).map(row => row.value).filter(value => value !== null);
      if (selectRowids(table, childColumn, values)) changed = true;
    }
  }
}

// Domain events deliberately use polymorphic aggregate IDs rather than FKs.
const aggregateIds = [];
for (const [table, rowids] of selected) {
  if (!rowids.size || !columns.get(table)?.includes("id")) continue;
  aggregateIds.push(...db.prepare(`SELECT id FROM ${safeName(table)} WHERE rowid IN (${placeholders([...rowids])})`).all(...rowids).map(row => row.id).filter(Boolean));
}
selectRowids("domain_events", "aggregate_id", aggregateIds);

const counts = [...selected].filter(([, rowids]) => rowids.size).map(([table, rowids]) => [table, rowids.size]);
db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
try {
  for (const [table] of counts) {
    const values = [...selected.get(table)];
    db.prepare(`DELETE FROM ${safeName(table)} WHERE rowid IN (${placeholders(values)})`).run(...values);
  }
  db.exec("COMMIT;");
} catch (error) {
  db.exec("ROLLBACK;");
  throw error;
} finally {
  db.exec("PRAGMA foreign_keys=ON;");
  db.close();
}

console.log(`已清理 ${projects.length} 个验收项目及 ${counts.reduce((sum, [, count]) => sum + count, 0)} 条关联记录。`);
for (const [table, count] of counts.sort((a, b) => b[1] - a[1])) console.log(`- ${table}: ${count}`);
