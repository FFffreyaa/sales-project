import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GATE_ACTIVITY_REQUIREMENTS, GATE_DEFINITION_VERSION, nextActivityStatus } from "../app/domain/sales-project-contract.ts";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("activity ownership baseline separates authoritative SPM execution from read-only BID projection", async () => {
  const [baseline, schema, migration, workspace] = await Promise.all([
    read("ACTIVITY_OWNERSHIP_BASELINE.md"),
    read("db/schema.ts"),
    read("drizzle/0013_activity_ownership.sql"),
    read("app/CoreWorkspaces.tsx"),
  ]);
  assert.match(baseline, /ACT-SPM-01—08/);
  assert.match(baseline, /本系统权威的 ACT-SPM/);
  assert.match(baseline, /ACT-BID.*只读投影/);
  for (const table of ["activity_definitions", "activity_instances", "activity_transitions", "activity_evidence_refs", "external_activity_projections"]) {
    assert.match(`${schema}\n${migration}`, new RegExp(table));
  }
  assert.match(migration, /ACT-BID-04A/);
  assert.match(migration, /ACT-BID-04B/);
  assert.match(migration, /ACT-BID-04C/);
  assert.match(migration, /ACT-SPM-08/);
  assert.match(workspace, /project\.persisted \? persistedRows : inferredRows/);
  assert.match(workspace, /外部活动只读/);
});

test("04B owns quotation design BOM and 04C only references an approved BOM", async () => {
  const flow = await read("app/api/_lib/p0-flow.ts");
  const technicalStart = flow.indexOf("export async function saveRequirementBaselineCandidate");
  const costingStart = flow.indexOf("export async function saveCostingAssessment");
  const technical = flow.slice(technicalStart, costingStart);
  const costing = flow.slice(costingStart, flow.indexOf("export async function requestG4", costingStart));
  assert.match(technical, /INSERT INTO quotation_design_bom_versions/);
  assert.match(technical, /DOMAIN_EVENTS\.quotationDesignBomConfirmed/);
  assert.doesNotMatch(costing, /INSERT INTO quotation_design_bom_versions/);
  assert.match(costing, /status='approved' AND confirmation_status='confirmed'/);
  assert.match(costing, /核价人员不能代建/);
});

test("persisted sales activities are created through a guarded API", async () => {
  const [route, flow] = await Promise.all([read("app/api/p0/activities/route.ts"), read("app/api/_lib/p0-flow.ts")]);
  assert.match(route, /requireDemoActor/);
  assert.match(route, /createSpmActivity/);
  assert.match(flow, /只有项目Owner可以创建项目经营行动/);
  assert.match(flow, /activity_transitions/);
  assert.match(flow, /activity_evidence_refs/);
});

test("G3 technical objects use three independently completed responsibility work packages", async () => {
  const flow = await read("app/api/_lib/integration-flow.ts");
  const start = flow.indexOf('envelope.eventType === "RequirementBaselinePrepared"');
  const end = flow.indexOf('envelope.eventType === "G3DecisionSubmitted"', start);
  const branch = flow.slice(start, end);
  const requirementBranch = branch.slice(0, branch.indexOf('envelope.eventType === "TechnicalSolutionPrepared"'));
  const solutionBranch = branch.slice(branch.indexOf('envelope.eventType === "TechnicalSolutionPrepared"'), branch.indexOf('envelope.eventType === "BomAndClosureCompleted"'));
  const closureBranch = branch.slice(branch.indexOf('envelope.eventType === "BomAndClosureCompleted"'));
  assert.match(requirementBranch, /REQUIREMENT_BASELINE_PREPARATION/);
  assert.match(requirementBranch, /status='completed'/);
  assert.match(solutionBranch, /TECHNICAL_SOLUTION_PREPARATION/);
  assert.match(solutionBranch, /status='completed'/);
  assert.match(closureBranch, /BOM_AND_CLOSURE_PREPARATION/);
  assert.match(closureBranch, /status='completed'/);
  assert.match(closureBranch, /completed_at=CURRENT_TIMESTAMP/);
});

test("SPM activity state machine allows only explicit business transitions", () => {
  assert.equal(nextActivityStatus("planned", "start"), "in_progress");
  assert.equal(nextActivityStatus("planned", "block"), "blocked");
  assert.equal(nextActivityStatus("blocked", "resume"), "in_progress");
  assert.equal(nextActivityStatus("in_progress", "complete"), "completed");
  assert.equal(nextActivityStatus("blocked", "cancel"), "cancelled");
  assert.equal(nextActivityStatus("completed", "add_evidence"), "completed");
  assert.throws(() => nextActivityStatus("planned", "complete"), /非法活动流转/);
  assert.throws(() => nextActivityStatus("completed", "start"), /非法活动流转/);
  assert.throws(() => nextActivityStatus("cancelled", "resume"), /非法活动流转/);
});

test("activity commands enforce evidence, optimistic locking and role boundaries", async () => {
  const [flow, route, stateMigration, receiptMigration] = await Promise.all([
    read("app/api/_lib/p0-flow.ts"),
    read("app/api/p0/activities/transition/route.ts"),
    read("drizzle/0014_activity_state_machine.sql"),
    read("drizzle/0015_activity_command_receipts.sql"),
  ]);
  assert.match(route, /commandSpmActivity/);
  assert.match(flow, /commandId/);
  assert.match(flow, /expectedVersion/);
  assert.match(flow, /销售主管可以追加督办证据/);
  assert.match(flow, /完成活动必须填写可验证的完成结果/);
  assert.match(stateMigration, /last_command_id/);
  assert.match(stateMigration, /activity_transitions_command_uq/);
  assert.match(stateMigration, /activity_evidence_refs_command_uq/);
  assert.match(receiptMigration, /activity_command_receipts/);
  assert.match(flow, /request_fingerprint/);
});

test("Gate V4 freezes exact dual-track activity and residual-risk sources", async () => {
  assert.equal(GATE_DEFINITION_VERSION, "LIFECYCLE_GATE_V4_DEMO_IMPLEMENTATION");
  assert.deepEqual(GATE_ACTIVITY_REQUIREMENTS.G3.filter(item => item.hard).map(item => item.definitionCode), ["ACT-BID-04A", "ACT-BID-04B"]);
  assert.deepEqual(GATE_ACTIVITY_REQUIREMENTS.G4.filter(item => item.hard).map(item => item.definitionCode), ["ACT-BID-04C"]);
  assert.deepEqual(GATE_ACTIVITY_REQUIREMENTS.G5.filter(item => item.hard).map(item => item.definitionCode), ["ACT-BID-05", "ACT-BID-06"]);
  assert.deepEqual(GATE_ACTIVITY_REQUIREMENTS.G6.filter(item => item.hard).map(item => item.definitionCode), ["ACT-BID-09"]);
  const [flow, store, migration, workspace, baseline] = await Promise.all([
    read("app/api/_lib/p0-flow.ts"),
    read("app/api/_lib/integration-store.ts"),
    read("drizzle/0016_gate_activity_linkage.sql"),
    read("app/CoreWorkspaces.tsx"),
    read("LIFECYCLE_GATE_BASELINE.md"),
  ]);
  assert.match(flow, /buildGateActivitySnapshot/);
  assert.match(flow, /activitySnapshotFingerprint/);
  assert.match(flow, /G5不投\/不报分支无L2\.9投标结果活动/);
  assert.match(store, /TECHNICAL_COLLABORATION: \["ACT-BID-04A"\]/);
  assert.match(store, /REQUIREMENT_BASELINE_PREPARATION: \["ACT-BID-04A"\]/);
  assert.match(store, /TECHNICAL_SOLUTION_PREPARATION: \["ACT-BID-04B"\]/);
  assert.match(store, /BOM_AND_CLOSURE_PREPARATION: \["ACT-BID-04B"\]/);
  assert.match(store, /BID_PREPARATION: \["ACT-BID-02"\]/);
  assert.match(store, /COMMERCIAL_SOLUTION: \["ACT-BID-03"\]/);
  assert.match(store, /BID_PACKAGE_PREPARATION: \["ACT-BID-05"\]/);
  assert.match(store, /BID_PACKAGE_REVIEW: \["ACT-BID-06"\]/);
  assert.match(migration, /ACT-BID-04A/);
  assert.match(migration, /ACT-BID-06/);
  assert.match(workspace, /活动引用（只读）/);
  assert.match(workspace, /点击展开/);
  assert.match(baseline, /Gate 与双轨活动快照/);
});

test("lifecycle SPM activities are system-created and event-driven", async () => {
  const [flow, schema, migration, baseline] = await Promise.all([
    read("app/api/_lib/p0-flow.ts"),
    read("db/schema.ts"),
    read("drizzle/0017_system_spm_lifecycle.sql"),
    read("LIFECYCLE_GATE_BASELINE.md"),
  ]);
  for (const code of ["ACT-SPM-02", "ACT-SPM-03", "ACT-SPM-04", "ACT-SPM-07", "ACT-SPM-08"]) {
    assert.match(flow, new RegExp(code));
    assert.match(migration, new RegExp(code));
  }
  assert.match(flow, /createSystemActivityStatements/);
  assert.match(flow, /completeSystemActivityStatements/);
  assert.match(schema, /activity_instances_project_lifecycle_uq/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(baseline, /G7.*关闭阈值/);
});
