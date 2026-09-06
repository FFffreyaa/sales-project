import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const request = new Request("http://localhost/", { headers: { accept: "text/html" } });
  if (typeof worker === "function") return worker(request);
  return worker.fetch(request, {}, { waitUntil() {}, passThroughOnException() {} });
}

test("server renders the sales project demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /正在读取D1业务项目/);
  assert.match(html, /不会再以静态样例替代业务数据/);
  assert.doesNotMatch(html, /西南新能源升压站设备投标项目/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("first-round manager and planning controls remain present", async () => {
  const [dashboard, app, workspaces, data] = await Promise.all([
    readFile(new URL("../app/RoleDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/scenario-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /label: "团队项目"/);
  assert.match(dashboard, /label: "S级项目"/);
  assert.match(dashboard, /label: "重大 \/ 高风险"/);
  assert.match(dashboard, /项目风险全景/);
  assert.match(dashboard, /项目组合健康分层/);
  assert.match(dashboard, /S0–S6 阶段分布/);
  assert.match(app, /确认项目责任并转化/);
  assert.match(app, /保存S0草稿/);
  assert.match(app, /保存并提交G1审批/);
  assert.match(workspaces, /项目关键路径｜里程碑驱动双线活动/);
  assert.match(workspaces, /鱼骨图模式/);
  assert.match(workspaces, /客户最终采购决策/);
  assert.match(data, /"QJ-2026-0818": "S"/);
});

test("second-round focused workspaces remain present", async () => {
  const [dashboard, app, workspaces] = await Promise.all([
    readFile(new URL("../app/RoleDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /我现在要做/);
  assert.match(dashboard, /按任务/);
  assert.match(dashboard, /按项目/);
  assert.match(dashboard, /待客户\/外部/);
  assert.doesNotMatch(dashboard, /进入行动中心/);
  assert.match(app, /Agent统一对话窗口/);
  assert.match(app, /审计证据抽屉/);
  assert.match(workspaces, /核价结果是进入G4的必备外部权威事实/);
  assert.match(workspaces, /鱼骨图模式/);
});

test("milestone-driven activity path and readable stage cards remain present", async () => {
  const [workspaces, styles] = await Promise.all([
    readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(workspaces, /项目关键路径｜里程碑驱动双线活动/);
  assert.match(workspaces, /销售项目经营轨/);
  assert.match(workspaces, /投标运营轨/);
  assert.match(workspaces, /ACT-BID-01/);
  assert.doesNotMatch(workspaces, /下一步最佳行动/);
  assert.match(workspaces, /关系覆盖与缺口/);
  assert.match(workspaces, /cw-coverage-ring/);
  assert.doesNotMatch(workspaces, /发起匹配\/建档/);
  assert.match(workspaces, /NEXT REQUIRED TASK/);
  assert.match(workspaces, /CURRENT FOCUS/);
  assert.match(workspaces, /查看伙伴与资源/);
  assert.match(styles, /project-card-stage\[class\*="stage-s"\] > span/);
  assert.match(styles, /background: var\(--stage-color\) !important/);
  assert.match(styles, /color: #fff !important/);
});

test("project detail keeps one task spine and excludes unsupported placeholder cards", async () => {
  const [app, workspaces, styles] = await Promise.all([
    readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(workspaces, /NEXT REQUIRED TASK｜唯一首要任务/);
  assert.match(workspaces, /cw-health-triangle/);
  assert.match(workspaces, /项目来源与采购关系/);
  assert.match(workspaces, /project\.stage !== "S0" \|\| \/销售Owner\//);
  assert.doesNotMatch(workspaces, /kicker="DUAL TRACK"/);
  assert.doesNotMatch(workspaces, /kicker="GATE PREVIEW"/);
  assert.doesNotMatch(workspaces, /kicker="MANAGEMENT"/);
  assert.match(app, /tab\.id !== "result" \|\| \["S5", "S6"\]\.includes\(selected\.stage\)/);
  assert.match(styles, /\.detail-main \.detail-content/);
  for (const unsupported of ["本周覆盖计划", "活动实例最小语义", "执行建议", "销售员操作边界", "中标份额", "移交准备度", "合同管理员 · 刘倩", "移交检查清单", "系统移交路径", "阶段性准备度", "门禁交互与决策影响"]) {
    assert.doesNotMatch(workspaces, new RegExp(unsupported));
  }
});

test("winning baseline renders only persisted references and never fabricates audit evidence", async () => {
  const [workspace, app, flow] = await Promise.all([
    readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workspace, /AWARD-DEMO-2026/);
  assert.doesNotMatch(workspace, /Hash \$\{baseline\.id\.slice/);
  assert.match(workspace, /baseline\.resultNoticeId/);
  assert.match(workspace, /baseline\.submissionId/);
  assert.match(app, /approved_by_name/);
  assert.match(flow, /u\.display_name AS approved_by_name/);
});
