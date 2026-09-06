import assert from "node:assert/strict";
import test from "node:test";
import { G2_INPUTS, PROJECT_STAGES, SCENARIO_TYPES, STAGE_GATES, UNIFIED_LIFECYCLE_STATES, deriveUnifiedLifecycle, nextG1Status } from "../app/domain/sales-project-contract.ts";
import { L5_ACTIVITY_MATRIX, L5_TASK_MATRIX, L5_WORK_MODE_LEGEND, summarizeL5TaskCoverage } from "../app/domain/l5-task-matrix.ts";

test("V1.2 stage, gate and unified lifecycle sets are frozen", () => {
  assert.deepEqual(PROJECT_STAGES.map(item => item.code), ["S0", "S1", "S2", "S3", "S4", "S5", "S6"]);
  assert.deepEqual(STAGE_GATES.map(item => item.code), ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
  assert.deepEqual(UNIFIED_LIFECYCLE_STATES, ["待立项", "已立项", "方案中", "核价定价中", "待商务决策", "已对外提交", "成交/未成交"]);
});

test("frozen V1.0 initiation scenarios keep names, request types and submission types together", () => {
  assert.deepEqual(SCENARIO_TYPES.map(item => [item.code, item.name, item.requestType, item.submissionType]), [
    ["SCN-01-DIRECT-BID", "国内正式招投标", "TenderRequest", "DirectBidSubmission"],
    ["SCN-02-EPC-INQUIRY", "国内EPC询价", "EPCInquiry", "CustomerRouteQuotation"],
    ["SCN-03-DIRECT-RFQ", "国内客户询价/报价", "DirectRFQ", "DirectQuotation"],
    ["SCN-04-OVERSEAS-PARTNER-EPC", "海外伙伴/EPC询价", "EPCInquiry", "CustomerRouteQuotation"],
  ]);
});

test("L5 implementation matrix keeps 14 activities, H/A/C semantics and scenario-specific execution", () => {
  assert.equal(L5_ACTIVITY_MATRIX.length, 14);
  assert.deepEqual(Object.keys(L5_WORK_MODE_LEGEND), ["H", "A", "C"]);
  assert.ok(L5_ACTIVITY_MATRIX.every(item => item.scenarios["SCN-01-DIRECT-BID"].mode === "full"));
  assert.ok(L5_ACTIVITY_MATRIX.find(item => item.code === "L5-07")?.scenarios["SCN-03-DIRECT-RFQ"].required);
  assert.equal(L5_ACTIVITY_MATRIX.find(item => item.code === "L5-09")?.scenarios["SCN-03-DIRECT-RFQ"].mode, "conditional");
  assert.equal(L5_ACTIVITY_MATRIX.find(item => item.code === "L5-10")?.scenarios["SCN-02-EPC-INQUIRY"].mode, "conditional");
  assert.ok(L5_ACTIVITY_MATRIX.find(item => item.code === "L5-14")?.scenarios["SCN-04-OVERSEAS-PARTNER-EPC"].required);
});

test("L5 task implementation baseline accounts for all 38 source tasks without treating activity labels as completion", () => {
  assert.equal(L5_TASK_MATRIX.length, 38);
  assert.equal(new Set(L5_TASK_MATRIX.map(item => item.code)).size, 38);
  assert.deepEqual(L5_TASK_MATRIX.map(item => item.sourceRow), [...Array.from({ length: 6 }, (_, index) => index + 3), ...Array.from({ length: 32 }, (_, index) => index + 10)]);
  assert.ok(L5_TASK_MATRIX.every(item => L5_ACTIVITY_MATRIX.some(activity => activity.code === item.activityCode)));
  assert.ok(L5_TASK_MATRIX.every(item => item.implementationEvidence.trim() && item.gap.trim()));
  assert.deepEqual(summarizeL5TaskCoverage(), { implemented: 25, partial: 10, missing: 2, incorrect: 0, to_verify: 1 });
  assert.equal(L5_TASK_MATRIX.find(item => item.name === "资质评审")?.coverage, "implemented");
  assert.equal(L5_TASK_MATRIX.find(item => item.name === "发起决策审批流程")?.coverage, "to_verify");
});

test("all qualified leads require human-confirmed conversion, preserve source candidates and keep bid work external", async () => {
  const fs = await import("node:fs/promises");
  const [flow, leadFlow, app, contracts, schema, migration, migrationV02, baseline, fixtures, fixtureImporter, styles] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/lead-integration-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../packages/integration-contracts/src/index.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0029_lead_bid_integration.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0030_nifty_wendell_vaughn.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../LEAD_BID_INTEGRATION_BASELINE.md", import.meta.url), "utf8"),
    fs.readFile(new URL("../integration-lab/src/fixtures/lead-samples.v1.json", import.meta.url), "utf8"),
    fs.readFile(new URL("../scripts/import-company-lead-fixtures.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const marker of ["lead_conversion_inbox", "project_source_links", "lead_requirement_snapshots", "initialRequirement", "field_provenance", "LeadQualifiedForConversion", "pending_confirmation", "grade_assessment", "major_project", "attachment_snapshot", "competitors", "keyRoles", "partners", "parties", "duplicateCheck"]) assert.match(`${leadFlow}\n${flow}\n${contracts}\n${schema}\n${migration}\n${migrationV02}`, new RegExp(marker));
  assert.match(flow, /\["S", "A", "B", "C"\]/);
  assert.match(app, /线索评级.*只读继承/);
  assert.match(app, /线索管理APP（本地模拟）/);
  assert.match(app, /所有线索先进入待转化队列/);
  assert.match(app, /竞对、客户侧关键角色、伙伴及内部建议负责人均保留为来源候选，不自动成为项目正式责任人/);
  assert.match(app, /步骤 3 \/ 3/);
  assert.match(app, /线索未提供业务场景，请先在线索APP补充/);
  assert.match(app, /销售项目只读继承/);
  assert.match(app, /本地测试设定/);
  assert.match(app, /SCENARIO_TYPES\[\(fixtureNumber - 1\) % SCENARIO_TYPES\.length\]/);
  assert.match(app, /lead-conversion-inline/);
  assert.doesNotMatch(app, /lead-conversion-overlay/);
  assert.match(app, /在当前工作区开始转化/);
  assert.match(app, /lead-pagination/);
  assert.match(app, /window\.innerHeight >= 1050 \? 8 : window\.innerHeight >= 800 \? 6 : 4/);
  for (const marker of ["lead-table", "公司原型来源", "业务场景 ·", "线索APP带入", "leadListMode", "leadStatusFilter"]) assert.match(app, new RegExp(marker));
  assert.doesNotMatch(app, /function recommendLeadScenario/);
  assert.match(app, /selectedLeadConversion\?\.status === "pending_confirmation"/);
  assert.match(leadFlow, /event_id NOT LIKE 'G6-ACCEPTANCE-%'/);
  assert.match(fixtureImporter, /COMPANY-HTML-LEAD-\$\{sample\.id\}-V2/);
  assert.match(leadFlow, /updated: true/);
  for (const marker of ["真实性与价值评级", "客户主体、联系人与关键角色", "竞对、伙伴与内部协同候选", "跟进历史与附件证据"]) assert.match(app, new RegExp(marker));
  assert.match(styles, /\.lead-key-metrics strong\.amount/);
  assert.match(styles, /\.scenario-recommendation\.confidence-low/);
  assert.match(app, /bidRoundRecord/);
  assert.match(app, /销售项目等级.*默认继承/);
  assert.match(app, /保存S0草稿/);
  assert.match(app, /保存并提交G1审批/);
  assert.match(flow, /export async function submitG1Draft/);
  assert.match(flow, /项目Owner提交G1/);
  assert.match(flow, /gateStatus: submitG1 \? "pending" as const : "draft" as const/);
  assert.doesNotMatch(app, /name="projectImportance"/);
  assert.match(`${flow}\n${schema}`, /project_grade/);
  assert.match(app, /线索评级（只读继承）/);
  assert.match(baseline, /线索APP不负责生成销售项目的组织、里程碑/);
  assert.doesNotMatch(leadFlow, /function canAutoConvert/);
  assert.doesNotMatch(leadFlow, /createIntentProjectAndG1/);
  assert.match(leadFlow, /"pending_confirmation"/);
  const companyFixtures = JSON.parse(fixtures);
  assert.equal(companyFixtures.length, 12, "teacher HTML sample table must be frozen as reusable 3010 fixtures");
  assert.equal(companyFixtures[0].grade, "A");
  assert.equal(companyFixtures[0].sourceDetail.keyRoles.length, 2);
  assert.equal(companyFixtures[0].sourceDetail.contacts.length, 4);
  assert.equal(companyFixtures[0].sourceDetail.followups.length, 2);
  assert.equal(companyFixtures[0].sourceDetail.attachments.length, 3);
  assert.equal(companyFixtures[0].sourceDetail.teamCandidates.length, 3);
  assert.match(flow, /const hasInitialPlan/);
  assert.match(flow, /input\.scenarioCode === "SCN-01-DIRECT-BID"/);
  assert.match(flow, /scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" \? requiredText\(data\.projectCountry, "项目国家"/);
  assert.match(flow, /scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" \? requiredText\(data\.deliveryCountry, "交付国家"/);
  assert.match(flow, /authority_system.*BID_MANAGEMENT_APP/);
  assert.doesNotMatch(app, /[SABC]级项目/);
  assert.doesNotMatch(app, /L2\.1.*立项向导/);
});

test("G1 allows only pending approve/return and returned resubmit", () => {
  assert.equal(nextG1Status("pending", "approve"), "approved");
  assert.equal(nextG1Status("pending", "return"), "returned");
  assert.equal(nextG1Status("returned", "resubmit"), "pending");
  assert.throws(() => nextG1Status("approved", "return"), /非法G1流转/);
  assert.throws(() => nextG1Status("pending", "resubmit"), /非法G1流转/);
});

test("stage and result derive lifecycle without conflating stage with state", () => {
  assert.equal(deriveUnifiedLifecycle("S0", "pending"), "待立项");
  assert.equal(deriveUnifiedLifecycle("S4", "pending", "待提交"), "待商务决策");
  assert.equal(deriveUnifiedLifecycle("S4", "pending", "已提交"), "已对外提交");
  assert.equal(deriveUnifiedLifecycle("S5", "won"), "成交/未成交");
  assert.equal(deriveUnifiedLifecycle("S5", "lost"), "成交/未成交");
});

test("G2 aggregates sales facts, professional readiness and the new bid preparation authority facts", () => {
  assert.deepEqual(G2_INPUTS.map(item => [item.track, item.label]), [
    ["销售项目管理轨", "首版赢单策略"],
    ["销售项目管理轨", "客户决策链与关系覆盖"],
    ["销售项目管理轨", "最近客户接触与覆盖缺口"],
    ["销售项目管理轨", "本阶段资源投入与接受"],
    ["投标作业轨", "采购/投报作业启动计划"],
    ["投标作业轨", "需求与方案启动评估"],
    ["投标作业轨", "初版商务条款与偏差上下文"],
  ]);
  const g2 = STAGE_GATES.find(item => item.code === "G2");
  assert.equal(g2?.name, "投入启动门");
  assert.equal(g2?.stageExitEvent, "WorkInitiationApproved");
});

test("G3 is the single S2 exit gate and separates lead demand, clarification and formal baseline", async () => {
  const g3 = STAGE_GATES.find(item => item.code === "G3");
  assert.equal(g3?.name, "需求与技术基线门");
  assert.equal(g3?.stage, "S2");
  assert.equal(g3?.targetStage, "S3");
  assert.equal(g3?.stageExitEvent, "TechnicalBaselineApproved");
  assert.equal(g3?.decisionRole, "独立技术评审人");
  assert.equal(g3?.decisionOutput, "独立评审并冻结可用于核价的需求与技术基线");
  const fs = await import("node:fs/promises");
  const [flow, contract, migration] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/domain/sales-project-contract.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0043_requirement_object_separation.sql", import.meta.url), "utf8"),
  ]);
  for (const marker of ["requirement_clarification_packages", "RequirementClarificationPackage", "requirementClarificationRecorded", "clarification_package_id", "正式客户需求基线", "独立技术评审人"]) assert.match(`${flow}\n${contract}\n${migration}`, new RegExp(marker));
});

test("G4 is the single S3 exit gate and freezes professional costing sources", async () => {
  const g4 = STAGE_GATES.find(item => item.code === "G4");
  assert.equal(g4?.name, "核价授权门");
  assert.equal(g4?.stage, "S3");
  assert.equal(g4?.targetStage, "S4");
  assert.equal(g4?.stageExitEvent, "CostingSolutionApproved");
  assert.equal(g4?.decisionRole, "财务/价格授权人");
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"));
  for (const marker of ["quotation_design_bom_versions", "pricing_snapshot_versions", "costing_solution_versions", "material_cost_cents", "labor_cost_cents", "manufacturing_cost_cents", "transport_cost_cents", "tax_cost_cents", "risk_reserve_cents", "target_profit_rate_bp", "costingSolutionApproved", "销售角色不能代填成本和利润结论", "财务/价格授权人确认"]) assert.match(source, new RegExp(marker));
});

test("G5 is one S4 business decision followed by controlled submission execution", async () => {
  const g5 = STAGE_GATES.find(item => item.code === "G5");
  assert.equal(g5?.name, "商务决策与提交门");
  assert.equal(g5?.stage, "S4");
  assert.equal(g5?.targetStage, "S5");
  const fs = await import("node:fs/promises");
  const [flow, integration, lab, migration, workspace] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/integration-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../integration-lab/src/main.tsx", import.meta.url), "utf8"),
    Promise.all([fs.readFile(new URL("../drizzle/0010_g5_commercial_submission.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0011_g5_execution_completion.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0018_epc_quotation_routes.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0025_g5_residual_risk_acceptance.sql", import.meta.url), "utf8")]).then(parts => parts.join("\n")),
    fs.readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
  ]);
  for (const marker of ["pricing_authorizations", "quotation_routes", "epc_price_exceptions", "bid_package_versions", "professional_reviews", "commercial_submissions_gate_version_route_uq", "execution_status", "approve_submit", "bidDecisionMade", "commercialSubmissionAccepted", "G5_SUBMISSION_EXECUTION", "全部有效报价通路完成提交并推进S5", "各通路采用统一授权价或已批准例外价", "gate_risk_acceptances", "批准投/报必须在本次G5决策中显式接受", "G5提交后销售项目风险状态或版本发生变化"]) assert.match(`${flow}\n${integration}\n${lab}\n${migration}`, new RegExp(marker));
  assert.match(workspace, /一次决策、受控执行/);
  assert.match(workspace, /批准后仍停留S4/);
  assert.match(flow, /未伪造BidSubmitted|不投\/不报/);
});

test("four-scenario Gate policy is centralized and does not invent conditional-review thresholds", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../app/domain/gate-scenario-policy.ts", import.meta.url), "utf8"));
  for (const scenario of ["SCN-01-DIRECT-BID", "SCN-02-EPC-INQUIRY", "SCN-03-DIRECT-RFQ", "SCN-04-OVERSEAS-PARTNER-EPC"]) assert.match(source, new RegExp(scenario));
  assert.match(source, /conditional_pending_enterprise_rule/);
  assert.match(source, /企业阈值未确认/);
  assert.match(source, /Demo不擅自设定硬阈值/);
  assert.doesNotMatch(source, /amount\s*[><=]|金额\s*[><=]|\d+万.*触发/);
});

test("G6 is one result decision followed by controlled contract handover execution", async () => {
  const g6 = STAGE_GATES.find(item => item.code === "G6");
  assert.equal(g6?.stage, "S5");
  assert.equal(g6?.targetStage, "S6");
  const fs = await import("node:fs/promises");
  const [flow, integration, store, lab, migration, workspace] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/integration-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/integration-store.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../integration-lab/src/main.tsx", import.meta.url), "utf8"),
    Promise.all([fs.readFile(new URL("../drizzle/0012_g6_result_handover.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0019_epc_route_results.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0020_result_task_fanout.sql", import.meta.url), "utf8")]).then(parts => parts.join("\n")),
    fs.readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
  ]);
  for (const marker of ["commercial_result_notices", "loss_termination_reviews", "commercial_award_baselines", "contract_handover_receipts", "buildG6Readiness", "requestG6", "decideG6", "completeContractHandover", "returnContractHandover", "COMMERCIAL_RESULT_TRACKING", "CONTRACT_HANDOVER_EXECUTION", "CommercialResultReported", "ContractHandoverAccepted", "ContractHandoverReturned", "clarificationOwnerRole", "clarificationClosureEvidenceRef", "deviationOwnerRole", "deviationDisposition", "deviationClosureEvidenceRef", "scopeAlignmentConclusion", "amountVarianceExplanation"]) assert.match(`${flow}\n${integration}\n${store}\n${lab}\n${migration}`, new RegExp(marker));
  assert.match(workspace, /合同接收是批准后的执行回执，不是第二次审批/);
  assert.match(flow, /UPDATE sales_projects SET stage='S6'/);
});

test("multi-EPC results are recorded per quotation route before project-level G6 aggregation", async () => {
  const fs = await import("node:fs/promises");
  const [flow, lab, migration, contract, workspace] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../integration-lab/src/main.tsx", import.meta.url), "utf8"),
    Promise.all([fs.readFile(new URL("../drizzle/0019_epc_route_results.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0021_result_correction_lineage.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0022_g5_controlled_reopen.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0023_g5_reopen_decision_lock.sql", import.meta.url), "utf8")]).then(parts => parts.join("\n")),
    fs.readFile(new URL("../app/domain/sales-project-contract.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
  ]);
  for (const marker of ["quotation_route_results", "route_effective_uq", "pendingRoutes.length === 0", "winners.length <= 1", "全部有效报价通路结果已回传且无冲突", "resultAggregationStatus", "multipleWinners", "requestCommercialResultCorrection", "CommercialResultCorrectionRequested", "supersedes_result_id", "correction_reason", "CORRECTION:", "g5_reopen_requests", "g5_reopen_decisions_request_uq", "requestG5Reopen", "decideG5Reopen", "withdrawEpcQuotationRoute", "ExternalTaskCancelled", "已有正式对客提交回执，不能解冻"]) assert.match(`${flow}\n${migration}\n${contract}`, new RegExp(marker));
  assert.match(flow, /correlationKey: String\(acceptedSubmission\.route_id\)/);
  assert.match(flow, /多通路项目必须明确本次结果对应的报价通路/);
  assert.match(lab, /单条通路结果不会直接决定整个销售项目/);
  assert.match(lab, /原记录保留为superseded/);
  assert.match(lab, /该通路未赢（该EPC未中标或未选用钱江）/);
  assert.match(workspace, /发起结果核实/);
  assert.match(workspace, /申请新增通路解冻/);
  assert.match(workspace, /批准解冻/);
});

test("P0 source contains persistence, authorization and audit boundaries", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"));
  for (const marker of ["requireDemoActor", "possibleDuplicate", "db.batch", "domain_events", "audit_records", "只有销售主管", "只有项目Owner", "gate_decisions_gate_version_uq", "gate_submission_snapshots", "workInitiationApproved", "technical-zhao", "G3必须由技术评审人确认", "G4必须由财务/价格授权人确认", "BR03", "BR04", "customerRequirementBaselined", "审批状态已被其他操作更新", "buildG2Readiness", "buildS2Readiness", "buildS3Readiness", "customer_requirement_versions", "technical_solution_versions", "technical_clarification_items", "technical_deviation_records", "stage_gate_instances", "gate_decisions", "sourceRefs"]) assert.match(source, new RegExp(marker));
});

test("external collaboration uses a separate idempotent integration gateway", async () => {
  const fs = await import("node:fs/promises");
  const [flow, store, lab, mainWorkspace, contracts, migration] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/integration-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/integration-store.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../integration-lab/src/main.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/CoreWorkspaces.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../packages/integration-contracts/src/index.ts", import.meta.url), "utf8"),
    Promise.all([fs.readFile(new URL("../drizzle/0006_integration_lab.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0008_s3_costing_flow.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0009_lifecycle_gate_alignment.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0010_g5_commercial_submission.sql", import.meta.url), "utf8"), fs.readFile(new URL("../drizzle/0039_bid_preparation_commercial_solution.sql", import.meta.url), "utf8")]).then(parts => parts.join("\n")),
  ]);
  for (const marker of ["integration_inbox", "event_id", "processing_status", "ExternalTaskAccepted", "BidPreparationCompleted", "CommercialSolutionCompleted", "bid_preparation_versions", "commercial_solution_versions", "G3DecisionSubmitted", "CostingAssessmentCompleted", "G4DecisionSubmitted", "BidPackagePrepared", "BidPackageReviewSubmitted", "CommercialSubmissionAccepted", "BID_PREPARATION", "COMMERCIAL_SOLUTION", "G3_GATE_REVIEW", "G4_GATE_REVIEW", "BID_PACKAGE_PREPARATION", "BID_PACKAGE_REVIEW", "G5_SUBMISSION_EXECUTION", "simulated", "environment"]) assert.match(`${flow}\n${migration}\n${contracts}`, new RegExp(marker));
  assert.match(flow, /事件ID已被另一条不同的集成事件占用/);
  assert.match(flow, /duplicate\.payload === JSON\.stringify\(envelope\)/);
  assert.match(store, /integration_outbox/);
  assert.match(lab, /仅本地测试，不是业务系统，也不是权威数据来源/);
  assert.match(contracts, /TECHNICAL_COLLABORATION_SIMULATOR/);
  assert.doesNotMatch(mainWorkspace, /TEST ADAPTER/);
});

test("business screens isolate D1 projects from explicit static sample mode", async () => {
  const fs = await import("node:fs/promises");
  const [app, dashboard, operational] = await Promise.all([
    fs.readFile(new URL("../app/DemoApp.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/RoleDashboard.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/OperationalWorkspaces.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /requestedMode === "sample"/);
  assert.match(app, /setProjects\(persisted\)/);
  assert.match(app, /没有自动回退到静态样例/);
  assert.doesNotMatch(app, /\[\.\.\.persisted, \.\.\.current\.filter/);
  assert.doesNotMatch(dashboard, /DEC-0818-RES|DEC-0824-MARGIN|openProject\("QJ-2026-0818"/);
  assert.doesNotMatch(operational, /customerFallback|DEC-0818-DEV|DEC-0821-INIT/);
  assert.match(operational, /只展示D1中真实存在的待处理Gate/);
});

test("acceptance projects are hidden from business screens but remain available to the integration harness", async () => {
  const fs = await import("node:fs/promises");
  const [flow, projectRoute, acceptance] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/p0/projects/route.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("./g6-acceptance.e2e.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(flow, /includeAcceptanceData/);
  assert.match(flow, /p\.name NOT LIKE 'G6验收%'/);
  assert.match(projectRoute, /x-integration-key/);
  assert.match(acceptance, /integration: true/);
});

test("resource and risk operating facts use persistent guarded state machines", async () => {
  const fs = await import("node:fs/promises");
  const [schema, flow, resourceRoute, riskRoute, migration, candidateMigration] = await Promise.all([
    fs.readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/p0/resources/route.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/p0/risks/route.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0024_sales_operating_register.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0028_resource_candidates.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /resourceRequests = sqliteTable\("resource_requests"/);
  assert.match(schema, /resourceCandidates = sqliteTable\("resource_candidates"/);
  assert.match(schema, /projectRisks = sqliteTable\("project_risks"/);
  assert.match(schema, /projectRiskTransitions = sqliteTable\("project_risk_transitions"/);
  assert.match(flow, /候选记录不存在、已失效或与当前角色不匹配；请先从候选池选择/);
  assert.match(flow, /requestOrigin: request \? "owner_or_system" : "manager_proactive"/);
  assert.match(flow, /resourceCandidateSelected/);
  assert.match(flow, /已到位必须由被指派人接受任务后产生/);
  assert.match(flow, /mitigation_activity_id/);
  assert.match(flow, /风险已被其他操作更新，请刷新后重试/);
  assert.match(resourceRoute, /requestProjectResource/);
  assert.match(riskRoute, /createProjectRisk/);
  assert.match(riskRoute, /commandProjectRisk/);
  assert.match(migration, /resource_requests_project_role_open_uq/);
  assert.match(candidateMigration, /resource_candidates_project_role_name_uq/);
  assert.match(candidateMigration, /resource_candidates_load_ck/);
});

test("scenario identity, party/partner boundaries and G7 read-only events are persisted without inventing closure", async () => {
  const fs = await import("node:fs/promises");
  const [flow, scenarioMigration, downstreamMigration, integration] = await Promise.all([
    fs.readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0026_scenario_party_governance.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0027_g7_downstream_projection.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/api/_lib/integration-flow.ts", import.meta.url), "utf8"),
  ]);
  assert.match(flow, /buildOpportunityFingerprint/);
  assert.match(flow, /同一最终采购机会不得按询价客户重复建项/);
  assert.match(scenarioMigration, /opportunity_fingerprints/);
  assert.match(scenarioMigration, /sales_project_party_roles/);
  assert.match(scenarioMigration, /partner_need_decisions/);
  assert.match(flow, /客户、EPC询价方或潜在合同客户属于Party角色，不能同时登记为经营伙伴/);
  assert.match(downstreamMigration, /downstream_business_events/);
  assert.match(integration, /DownstreamBusinessStatusReported/);
  assert.match(flow, /g7ClosureAvailable: false/);
  assert.match(flow, /企业关闭阈值、超期升级与例外审批规则尚未确认/);
  assert.doesNotMatch(flow, /function closeG7|function approveG7/);
});

test("Gate decisions compare frozen business sources and strategy remains versioned after G2", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../app/api/_lib/p0-flow.ts", import.meta.url), "utf8");
  assert.match(source, /function gateSourceFingerprint/);
  assert.match(source, /G2业务来源在提交后发生变化/);
  assert.match(source, /G3需求、方案、BOM、澄清或偏差来源在提交后发生变化/);
  assert.match(source, /G4技术基线、BOM、价格来源或核价结果在提交后发生变化/);
  assert.match(source, /G5经营策略、关系、风险、价格授权、投标包或评审来源在提交后发生变化/);
  assert.match(source, /\["S1", "S2", "S3", "S4"\]\.includes\(project\.stage\)/);
  assert.match(source, /UPDATE project_strategy_versions SET status='superseded'/);
  assert.match(source, /冻结期间不能静默改写赢单策略/);
});
