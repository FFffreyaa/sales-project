import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataSource = await readFile(new URL("../app/demo-data.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8");
const workspaceSource = await readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8");
const roleDashboardSource = await readFile(new URL("../app/RoleDashboard.tsx", import.meta.url), "utf8");
const operationalSource = await readFile(new URL("../app/OperationalWorkspaces.tsx", import.meta.url), "utf8");
const scenarioSource = await readFile(new URL("../app/scenario-data.ts", import.meta.url), "utf8");
const contractSource = await readFile(new URL("../app/domain/sales-project-contract.ts", import.meta.url), "utf8");
const flowSource = await readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const integrationLabSource = await readFile(new URL("../integration-lab/src/main.tsx", import.meta.url), "utf8");
const baselineMigrationSource = await readFile(new URL("../drizzle/0036_artifact_baseline_items.sql", import.meta.url), "utf8");

test("BA lifecycle remains the exact S0-S6 baseline", () => {
  for (const stage of [
    "S0\", name: \"待立项",
    "S1\", name: \"立项与策略",
    "S2\", name: \"需求与方案",
    "S3\", name: \"核价评审",
    "S4\", name: \"定价与投标",
    "S5\", name: \"结果与移交",
    "S6\", name: \"赢单后跟踪",
  ]) assert.match(contractSource, new RegExp(stage));
});

test("sales and manager actions stay separated", () => {
  assert.match(appSource, /阶段推进需由销售主管操作/);
  assert.match(appSource, /请切换为销售主管后执行偏差审批/);
  assert.match(appSource, /请按当前阶段门要求补齐事实并提交/);
  assert.match(workspaceSource, /主系统不提供“模拟中标\/丢标”按钮/);
  assert.match(appSource, /只有S5项目Owner可以提交G6/);
  assert.match(appSource, /客户需求事实由销售员登记；主管只能要求补充证据并督办影响评审/);
  assert.match(appSource, /只有S2项目Owner可以提交G3技术评审申请/);
  assert.match(workspaceSource, /主管只读督办区/);
  assert.match(workspaceSource, /主管不会代替销售员登记客户事实/);
  assert.match(workspaceSource, /manager \? "督办需求变更登记" : "登记客户需求变更"/);
  assert.doesNotMatch(workspaceSource, /模拟投标APP正式提交/);
  assert.match(appSource, /\["资源配置", "资源协调"\]\.includes\(type\)/);
  assert.match(appSource, /候选被确认指派后状态变为“待接受”/);
  assert.match(appSource, /candidateId: candidate.id/);
  assert.doesNotMatch(appSource, /已模拟指派并接受责任|指派并确认接受/);
});

test("G2 is an auto-aggregated review desk instead of a duplicate entry form", () => {
  for (const marker of ["G2 WORK INITIATION REVIEW", "G2投入启动门", "首版赢单策略", "客户决策链与关系覆盖", "需求与方案启动评估", "onNavigateG2Source"]) {
    assert.match(`${workspaceSource}\n${appSource}`, new RegExp(marker));
  }
  assert.doesNotMatch(workspaceSource, /G2_INPUTS\.map\(item => <label/);
  assert.doesNotMatch(workspaceSource, /记录\$\{item\.label\}事实、来源或待确认项/);
  for (const retiredLabel of ["客户决策偏好", "技术关系", "伙伴与资源", "需求缺失", "方案资源需求"]) assert.doesNotMatch(workspaceSource, new RegExp(`<h3>${retiredLabel}</h3>`));
});

test("second-batch management track keeps grade lineage, formal reviews, strategy and milestones auditable", () => {
  for (const marker of ["projectGrade", "gradeReason", "gradeEvidence", "线索原始评级永久只读", "G2正式审查", "submitG2Decision"]) assert.match(appSource, new RegExp(marker));
  for (const marker of ["valueProposition", "relationshipPlan", "resourcePlan", "winPath", "requirementScope", "keyRisks"]) assert.match(`${workspaceSource}\n${flowSource}`, new RegExp(marker));
  for (const marker of ["project_milestones", "ProjectMilestonePlanned", "saveProjectMilestone", "按需资源规划，不预设固定技术角色"]) assert.match(flowSource, new RegExp(marker));
  assert.doesNotMatch(flowSource, /批准后自动生成的标准角色需求/);
});

test("S2 uses source facts aggregated into the unified G3 gate", () => {
  for (const marker of ["S2 SOURCE FACTS", "G3 TECHNICAL BASELINE REVIEW", "G3需求与技术基线门", "提交G3技术评审", "api/p0/gates/g3/submission"]) {
    assert.match(`${workspaceSource}\n${appSource}`, new RegExp(marker));
  }
  assert.match(workspaceSource, /需求澄清包 → 正式需求基线 → 技术方案 → 报价设计BOM → 问题澄清与偏差闭环 → 独立技术评审/);
  assert.match(workspaceSource, /销售Owner只协调客户澄清和提交冻结快照/);
  assert.doesNotMatch(workspaceSource, /TEST ADAPTER/);
  assert.doesNotMatch(appSource, /onTechnicalS2Decision|onSaveTechnicalAssessment/);
  assert.doesNotMatch(workspaceSource, /S2_WORK_PACKAGE_INPUTS\.map/);
  assert.doesNotMatch(appSource, /api\/p0\/stage-exit\/s2\/submission/);
});

test("G3 freezes the author output for an independent technical reviewer and does not auto-onboard costing", () => {
  const start = flowSource.indexOf("export async function requestG3");
  const end = flowSource.indexOf("export async function decideG3", start);
  const g3 = flowSource.slice(start, end);
  assert.match(g3, /gateStatus: "pending"/);
  assert.match(g3, /stage: "S2"/);
  assert.match(g3, /G3_GATE_REVIEW/);
  assert.match(g3, /technical-reviewer-wang/);
  assert.match(g3, /decisionRole: "技术评审人"/);
  assert.doesNotMatch(g3, /COSTING_COLLABORATION|costing-liu|刘工/);
});

test("G5 keeps bid package authorship separate and splits formal bid review by profession", () => {
  for (const marker of ["BID_PACKAGE_REVIEW", "professional-reviewer-wu", "bid-technical-reviewer-qian", "qualification-reviewer-he", "reviewType", "business", "technical", "qualification", "saveProfessionalReview", "BidPackageReviewSubmitted"]) assert.match(`${flowSource}\n${integrationLabSource}`, new RegExp(marker));
  const start = flowSource.indexOf("export async function saveBidPackage");
  const end = flowSource.indexOf("export async function saveProfessionalReview", start);
  assert.doesNotMatch(flowSource.slice(start, end), /INSERT INTO professional_reviews/);
  assert.match(flowSource, /professionalReviewTypesForScenario/);
  assert.match(flowSource, /商务、技术、资质评审分别通过且无开放问题/);
});

test("third-batch authority boundary carries lead demand and exposes all gate owners", () => {
  for (const gate of ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]) assert.match(dataSource, new RegExp(`gate: "${gate}"`));
  for (const marker of ["leadRequirementSnapshotId", "leadRequirementSnapshots", "LeadRequirementSnapshotFrozen", "lead_conversion", "requirement_clarification_packages", "customer_requirement_versions"]) assert.match(`${flowSource}\n${schemaSource}`, new RegExp(marker));
  assert.match(workspaceSource, /线索初始需求已作为独立只读快照保留/);
  assert.match(workspaceSource, /不等于正式客户需求基线/);
  assert.doesNotMatch(workspaceSource, /COSTING CAPABILITY|核价数据暂不作为销售项目权威事实/);
  assert.match(workspaceSource, /核价结果是进入G4的必备外部权威事实/);
  assert.match(workspaceSource, /不自动指派核价负责人，也不伪造核价结果/);
  for (const scenario of ["SCN-01-DIRECT-BID", "SCN-02-EPC-INQUIRY", "SCN-03-DIRECT-RFQ", "SCN-04-OVERSEAS-PARTNER-EPC"]) assert.match(integrationLabSource, new RegExp(scenario));
  for (const evidence of ["TENDER-JS-110KV-2026-01", "EPC-RFQ-NMG-2026-03", "RFQ-GD-220KV-2026-02", "OS-EPC-RFQ-2026-04"]) assert.match(integrationLabSource, new RegExp(evidence));
});

test("version and external-system governance is explicit", () => {
  assert.match(appSource, /技术、核价和投标版本均标记为需要重新评审/);
  assert.match(appSource, /主系统不能模拟改写S5/);
  assert.match(appSource, /收到正式提交回执后才进入S5/);
  assert.match(workspaceSource, /本APP仅引用状态、版本和结果，不编制投标文件/);
  assert.match(workspaceSource, /来自下游系统的只读权威事实，不在本APP修改/);
  assert.match(workspaceSource, /对象类型与业务状态分开/);
  assert.match(workspaceSource, /尚未进入对客提交/);
});

test("persisted G6 result pages cannot imply an unfinished approval or allow reset", () => {
  assert.match(workspaceSource, /TERMINATED｜G6 CLOSED/);
  assert.match(workspaceSource, /LOST REVIEW｜G6 CLOSED/);
  assert.match(workspaceSource, /!project\.persisted && <button className="cw-secondary" onClick=\{onReset\}>重置结果分支/);
  assert.match(workspaceSource, /销售主管已确认G6关闭/);
  assert.doesNotMatch(workspaceSource, /真实终止需主管确认/);
  assert.match(appSource, /persistedResult === "won" \? 100/);
});

test("manager command center has nine cross-stage projects and five actionable views", () => {
  for (let suffix = 17; suffix <= 25; suffix += 1) {
    assert.match(dataSource, new RegExp(`QJ-2026-08${suffix}`));
  }
  for (const focus of ["portfolio", "major", "deadline", "todo", "risk"]) {
    assert.match(roleDashboardSource, new RegExp(`id: "${focus}"`));
  }
  assert.match(roleDashboardSource, /setHealthScope/);
  assert.match(roleDashboardSource, /AI建议 · 不自动执行/);
});

test("sales workspace keeps personal scope while detailed lineage stays in project detail", () => {
  assert.equal((dataSource.match(/sourceLineage: sourceLineage/g) ?? []).length, 9);
  for (const field of ["leadId", "commercialProjectId", "sourceRecordId", "inheritedFields", "inheritedContext", "contributor"]) {
    assert.match(dataSource, new RegExp(field));
  }
  assert.match(roleDashboardSource, /project\.participants\?\.includes\("陈晨"\)/);
  assert.doesNotMatch(roleDashboardSource, /来源上下文 · 只读投影/);
  assert.match(roleDashboardSource, /来源详情已移入项目驾驶舱/);
  assert.match(workspaceSource, /上游来源/);
  assert.match(workspaceSource, /来源客户名称/);
  assert.match(workspaceSource, /客户系统匹配/);
  assert.match(roleDashboardSource, /催办/);
  assert.match(roleDashboardSource, /onVoiceRecord\(quickProject\.id/);
});

test("task continuity, workstreams, capacity and configuration comparison remain actionable", () => {
  for (const marker of ["rd-workitem-list", "setExpanded", "onManagerQuickDecision", "正在处理：", "entryContext.returnView", "返回{entryContext.source}"]) {
    assert.match(`${roleDashboardSource}\n${appSource}`, new RegExp(marker));
  }
  for (const marker of ["HealthTriangle", "项目关键路径｜里程碑驱动双线活动", "里程碑是结果锚点", "版本链节点对比", "当前承诺一致性矩阵", "可选任意节点"]) {
    assert.match(workspaceSource, new RegExp(marker));
  }
  assert.match(workspaceSource, /comparisonVersions\.length > 1/);
  assert.match(workspaceSource, /当前承诺一致性矩阵/);
  assert.doesNotMatch(workspaceSource, /配置项影响与一致性|cw-config-table|cw-impact-matrix/);
  assert.match(workspaceSource, /approvedConfiguration &&/);
  assert.match(workspaceSource, /cw-history-disclosure/);
  for (const marker of ["需求、候选、指派与责任接受", "候选池", "当前负荷", "在管项目", "resource\\.dataSource"]) {
    assert.match(appSource, new RegExp(marker));
  }
  assert.match(appSource, /stage-\$\{stage\.code\.toLowerCase\(\)\}/);
  assert.match(appSource, /roleScopedProjects/);
});

test("submission status, probability and result-stage editing are not fabricated", () => {
  assert.match(dataSource, /function submissionTimingLabel/);
  assert.match(dataSource, /已逾期未提交/);
  assert.match(dataSource, /已中标·待合同接收/);
  assert.match(dataSource, /function probabilityLabel/);
  assert.match(dataSource, /probabilityAssessed === false \? "待评估"/);
  assert.doesNotMatch(`${appSource}\n${roleDashboardSource}\n${operationalSource}`, /countdown < 0 \? "已交标"/);
  assert.match(workspaceSource, /project\.stage === "S2" && <button/);
  assert.match(workspaceSource, /manager \? "督办需求变更登记" : "登记客户需求变更"/);
  assert.match(workspaceSource, /project\.stage === "S5" && <Panel kicker="CONTROLLED EXECUTION"/);
  assert.match(workspaceSource, /project\.stage === "S6" && <Panel kicker="READ ONLY" title="S6 赢单后商业事实跟踪"/);
  assert.match(dataSource, /状态冲突·需核对/);
  assert.match(flowSource, /商业结果已形成；客户关系、竞争、风险、伙伴与投标前资源事实均已冻结/);
  assert.match(flowSource, /input\.context === "project_operation" && project\.result !== "pending"/);
  assert.match(flowSource, /businessRefs\.includes\("PostAwardResponsibility"\)/);
  assert.match(workspaceSource, /结果形成，竞争与策略只读/);
  assert.match(workspaceSource, /商业结果已形成，投标前活动与计划只读/);
  assert.match(appSource, /结果形成，资源事实只读/);
  assert.match(workspaceSource, /结果已形成，不再倒计时/);
});

test("competitor facts are persistent, role-guarded and editable only before result", async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL("../app/api/p0/s1-facts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0050_project_competitor_facts.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schemaSource, /projectCompetitorFacts = sqliteTable\("project_competitor_facts"/);
  assert.match(route, /competitor\.create/);
  assert.match(flowSource, /竞争事实由项目Owner核实并记录/);
  assert.match(flowSource, /\["S1", "S2", "S3", "S4"\]\.includes\(project\.stage\)/);
  assert.match(migration, /project_competitor_facts_scores_ck/);
  assert.match(workspaceSource, /补充竞争事实/);
  assert.match(appSource, /新增已核实竞争公司事实/);
});

test("relationship entry preserves the selected layer and fishbone priority order", () => {
  assert.match(appSource, /setRelationLayer\(layer \?\? "商务决策链"\)/);
  assert.match(appSource, /value=\{relationLayer\}/);
  assert.match(workspaceSource, /\["技术层", "商务决策链", "客户高层"\]\.map/);
  assert.match(workspaceSource, /结果形成，关系事实只读/);
});

test("baseline comparison uses structured version facts instead of summaries", () => {
  for (const marker of ["artifact_baseline_items", "artifact_kind", "artifact_version_id", "evidence_ref", "LEAD_PROTOTYPE_SAMPLE", "TECHNICAL_COLLABORATION_SIMULATOR", "REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION"]) {
    assert.match(`${baselineMigrationSource}\n${flowSource}`, new RegExp(marker));
  }
  assert.match(appSource, /artifact_baseline_item_records/);
  assert.match(workspaceSource, /七节点承诺一致性矩阵/);
  for (const node of ["需求澄清包", "客户需求", "技术方案", "设计BOM", "核价方案", "授权底价", "投标方案"]) assert.match(workspaceSource, new RegExp(node));
  assert.match(workspaceSource, /当前版本缺少该结构化字段/);
  assert.match(workspaceSource, /lifecycleValues/);
});

test("win strategy separates auto-aggregated facts from owner decisions", () => {
  for (const marker of ["cw-strategy-facts", "系统先汇总客户、需求、竞对、关系、资源和风险事实", "winThemes", "主要赢单主题", "证据和来源编号由系统自动关联"]) assert.match(`${workspaceSource}\n${flowSource}`, new RegExp(marker));
  for (const retiredTextarea of ["g2Strategy.decisionPreference", "g2Strategy.competitiveAssessment", "g2Strategy.relationshipPlan", "g2Strategy.resourcePlan", "g2Strategy.requirementScope", "g2Strategy.keyRisks", "g2Strategy.evidenceRef"]) assert.doesNotMatch(workspaceSource, new RegExp(retiredTextarea));
  assert.match(flowSource, /至少选择一项主要赢单主题/);
  assert.match(flowSource, /sourceSnapshot/);
  assert.match(flowSource, /SET status='stale'/);
  assert.match(flowSource, /来源事实已变化，当前策略版本需要销售Owner复核后形成新版本/);
  assert.match(flowSource, /strategyCurrent/);
});

test("role navigation opens dedicated workspaces instead of arbitrary project detail", () => {
  for (const marker of ["决策与审批中心", "资源调度", "风险与行动", "版本与配置", "结果与复盘", "平台规则配置", "行动中心"]) {
    assert.match(appSource, new RegExp(marker));
  }
  for (const component of ["DecisionCenter", "ResourceCenter", "RiskCenter", "ConfigurationCenter", "ReviewCenter", "SalesActionCenter"]) {
    assert.match(operationalSource, new RegExp(`export function ${component}`));
  }
  assert.doesNotMatch(appSource, /<span>立项与阶段审批<\/span>/);
  assert.doesNotMatch(appSource, /<span>决策队列<\/span>/);
});

test("dual workstreams align to S0-S6 and avoid decorative bridge blocks", () => {
  assert.match(workspaceSource, /里程碑与双轨活动/);
  assert.match(workspaceSource, /销售项目经营轨/);
  assert.match(workspaceSource, /投标运营轨/);
  assert.doesNotMatch(workspaceSource, /kicker="DUAL TRACK"/);
  assert.doesNotMatch(workspaceSource, /cw-stream-links/);
  assert.doesNotMatch(workspaceSource, /关系事实支撑需求澄清/);
});

test("retired workspaces are removed instead of kept as unreachable fallbacks", () => {
  for (const source of [appSource, roleDashboardSource, workspaceSource, operationalSource]) {
    assert.doesNotMatch(source, /Legacy[A-Za-z]+/);
  }
  assert.doesNotMatch(appSource, /Legacy dashboard kept below/);
});

test("DP-02 V1.2 dual-track ontology is represented as executable UI semantics", () => {
  for (const marker of [
    "国内正式招投标",
    "国内EPC询价",
    "国内客户询价/报价",
    "海外伙伴/EPC询价",
    "DirectBidSubmission",
    "CustomerRouteQuotation",
    "DirectQuotation",
    "QuotationRoute",
  ]) assert.match(`${dataSource}\n${scenarioSource}`, new RegExp(marker));
  for (const gate of ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]) assert.match(contractSource, new RegExp(`code: "${gate}"`));
  for (const marker of ["ACT-BID-01", "ACT-BID-09", "ACT-SPM-01", "ACT-SPM-08", "BID_OPERATION", "SALES_PROJECT_MANAGEMENT"]) {
    assert.match(`${workspaceSource}\n${contractSource}`, new RegExp(marker));
  }
  for (const marker of ["客户需求", "技术方案", "设计BOM", "核价方案", "授权底价", "投标方案"]) {
    assert.match(`${dataSource}\n${workspaceSource}`, new RegExp(marker));
  }
  assert.match(scenarioSource, /不得汇总多家EPC报价/);
  assert.match(workspaceSource, /quotationRoutes\.length.*EPC报价通路不拆分项目，也不相加为项目预计金额/);
  assert.match(scenarioSource, /BR-009｜任一经营三角维度低于60分自动进入总裁显微镜/);
  assert.match(workspaceSource, /商业结果、阶段与行政关闭分开记录/);
});

test("initiation persists the four authoritative scenarios with unambiguous codes", () => {
  for (const marker of ["SCN-01-DIRECT-BID", "SCN-02-EPC-INQUIRY", "SCN-03-DIRECT-RFQ", "SCN-04-OVERSEAS-PARTNER-EPC", "核对业务场景与线索来源", "EPC报价通路不相加", "EPC/伙伴询价批次"]) {
    assert.match(`${contractSource}\n${appSource}`, new RegExp(marker));
  }
  assert.match(appSource, /最终客户\s*\/\s*业主/);
  assert.doesNotMatch(appSource, /\["标书", "RFQ", "明确需求", "直接谈判", "渠道机会", "增购"\]/);
});
