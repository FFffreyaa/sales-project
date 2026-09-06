import { getD1Binding } from "@/db";
import { isEpcScenarioCode } from "@/app/domain/sales-project-contract";
import { gateScenarioPolicy, professionalReviewTypesForScenario } from "@/app/domain/gate-scenario-policy";
import { ACTIVITY_COMMANDS, DOMAIN_EVENTS, G2_INPUTS, GATE_ACTIVITY_REQUIREMENTS, GATE_DEFINITION_VERSION, nextActivityStatus, nextG1Status, SCENARIO_TYPES, type ActivityCommand, type ActivityExecutionStatus, type BidPackageInput, type BidPreparationInput, type CommercialSolutionInput, type CostingAssessmentInput, type EpcPriceExceptionInput, type EpcQuotationRouteInput, type EpcRouteReadiness, type G1Action, type G1Status, type G2PreparationInput, type G2ReadinessItem, type G2ReadinessSnapshot, type G5DeviationAuthorizationInput, type G5ReadinessItem, type G5ReadinessSnapshot, type G5ReopenRequestInput, type G6ReadinessItem, type G6ReadinessSnapshot, type GateActivitySnapshot, type GateCode, type LossTerminationReviewInput, type PersistedActivityRecord, type PricingAuthorizationInput, type ProfessionalReviewInput, type ProfessionalReviewRemediationInput, type RequirementSourceInput, type ResultType, type S2ReadinessItem, type S2ReadinessSnapshot, type S3ReadinessItem, type S3ReadinessSnapshot, type ScenarioType, type SolutionPreparationInput, type TechnicalAssessmentInput } from "@/app/domain/sales-project-contract";
import { createExternalTask, loadExternalTasks } from "./integration-store";

export type DemoActor = { id: "sales-chen" | "manager-zhou" | "technical-zhao" | "requirement-owner-demo" | "solution-designer-demo" | "technical-reviewer-wang" | "costing-liu" | "authorizer-luo" | "bid-specialist-sun" | "commercial-manager-tang" | "professional-reviewer-wu" | "bid-technical-reviewer-qian" | "qualification-reviewer-he" | "contract-admin-liu" | "system-integration"; role: "sales" | "manager" | "technical" | "technical_reviewer" | "costing" | "authorizer" | "bid" | "commercial" | "professional_reviewer" | "contract" | "system"; name: string };

export const INTEGRATION_SYSTEM_ACTOR: DemoActor = { id: "system-integration", role: "system", name: "系统集成服务" };

const DEMO_PRINCIPALS = [
  { id: "sales-chen", role: "sales", name: "陈晨" },
  { id: "manager-zhou", role: "manager", name: "周主管" },
  { id: "technical-zhao", role: "technical", name: "赵工" },
  { id: "requirement-owner-demo", role: "technical", name: "需求基线责任人（演示）" },
  { id: "solution-designer-demo", role: "technical", name: "方案设计责任人（演示）" },
  { id: "technical-reviewer-wang", role: "technical_reviewer", name: "王评审" },
  { id: "costing-liu", role: "costing", name: "刘工" },
  { id: "authorizer-luo", role: "authorizer", name: "罗总" },
  { id: "bid-specialist-sun", role: "bid", name: "孙投标" },
  { id: "commercial-manager-tang", role: "commercial", name: "唐商务" },
  { id: "professional-reviewer-wu", role: "professional_reviewer", name: "吴评审" },
  { id: "contract-admin-liu", role: "contract", name: "刘倩" },
] as const;

export class FlowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireDemoActor(request: Request, requiredRole?: DemoActor["role"]): Promise<DemoActor> {
  const actorId = request.headers.get("x-demo-actor-id");
  const actor = DEMO_PRINCIPALS.find((item) => item.id === actorId);
  if (!actor) throw new FlowError("缺少有效演示身份。正式部署前必须替换为企业统一身份认证。", 401);
  if (requiredRole && actor.role !== requiredRole) throw new FlowError("当前角色无权执行该业务动作。", 403);
  await ensureDemoPrincipals();
  return actor;
}

async function ensureDemoPrincipals() {
  const db = getD1Binding();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-sales','sales','销售员')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-manager','manager','销售主管')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-technical','technical','技术负责人')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-technical-reviewer','technical_reviewer','技术评审人')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-costing','costing','核价人员')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-authorizer','authorizer','财务授权人')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-bid','bid','投标专员')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-commercial','commercial','商务经理')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-professional-reviewer','professional_reviewer','专业评审人')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-contract','contract','合同管理员')"),
    db.prepare("INSERT OR IGNORE INTO roles (id, code, name) VALUES ('role-system','system','系统集成服务')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('sales-chen','陈晨')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('manager-zhou','周主管')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('technical-zhao','赵工')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('requirement-owner-demo','需求基线责任人（演示）')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('solution-designer-demo','方案设计责任人（演示）')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('technical-reviewer-wang','王评审')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('costing-liu','刘工')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('authorizer-luo','罗总')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('bid-specialist-sun','孙投标')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('commercial-manager-tang','唐商务')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('professional-reviewer-wu','吴评审')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('contract-admin-liu','刘倩')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('system-integration','系统集成服务')"),
    db.prepare("INSERT OR IGNORE INTO users (id, display_name) VALUES ('executive-liu','刘总')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('sales-chen','role-sales')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('manager-zhou','role-manager')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('technical-zhao','role-technical')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('requirement-owner-demo','role-technical')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('solution-designer-demo','role-technical')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('technical-reviewer-wang','role-technical-reviewer')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('costing-liu','role-costing')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('authorizer-luo','role-authorizer')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('bid-specialist-sun','role-bid')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('commercial-manager-tang','role-commercial')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('professional-reviewer-wu','role-professional-reviewer')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('contract-admin-liu','role-contract')"),
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('system-integration','role-system')"),
  ]);
}

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed as T[] : []; }
  catch { return []; }
}

async function commandFingerprint(input: ActivityCommandInput): Promise<string> {
  const normalized = JSON.stringify({ command: input.command, expectedVersion: input.expectedVersion, reason: input.reason, result: input.result ?? null, evidenceRef: input.evidenceRef ?? null });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function liveTimeliness(status: string, plannedEnd: string, actualEnd?: string | null): PersistedActivityRecord["timelinessStatus"] {
  if (status === "completed") return actualEnd && actualEnd.slice(0, 10) > plannedEnd ? "completed_late" : "on_track";
  const today = new Date().toISOString().slice(0, 10);
  if (plannedEnd < today) return "overdue";
  const days = Math.ceil((Date.parse(`${plannedEnd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= 3 ? "due_soon" : "on_track";
}

function projectedExecutionStatus(status: string): PersistedActivityRecord["status"] {
  if (status === "completed") return "completed";
  if (status === "accepted" || status === "in_progress") return "in_progress";
  if (status === "blocked" || status === "returned" || status === "rejected") return "blocked";
  if (status === "cancelled") return "cancelled";
  return "planned";
}

async function loadProjectActivities(projectId: string): Promise<PersistedActivityRecord[]> {
  const db = getD1Binding();
  const [owned, projected] = await Promise.all([
    db.prepare(`SELECT a.*,d.code AS definition_code,d.version AS definition_version,d.track_type,d.ltc_node_code,d.completion_event,d.authority_system
      FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id
      WHERE a.project_id=? ORDER BY a.planned_end,a.created_at`).bind(projectId).all<Record<string, unknown>>(),
    db.prepare(`SELECT p.*,d.code AS definition_code,d.version AS definition_version,d.track_type,d.ltc_node_code,d.name AS definition_name,d.authority_system
      FROM external_activity_projections p JOIN activity_definitions d ON d.id=p.definition_id
      WHERE p.project_id=? ORDER BY COALESCE(p.planned_end,p.source_updated_at),p.created_at`).bind(projectId).all<Record<string, unknown>>(),
  ]);
  const evidenceByActivity = new Map<string, string[]>();
  if (owned.results.length) {
    const evidence = await db.prepare("SELECT activity_instance_id,evidence_ref FROM activity_evidence_refs WHERE activity_instance_id IN (SELECT id FROM activity_instances WHERE project_id=?) ORDER BY created_at").bind(projectId).all<Record<string, unknown>>();
    evidence.results.forEach(item => evidenceByActivity.set(String(item.activity_instance_id), [...(evidenceByActivity.get(String(item.activity_instance_id)) ?? []), String(item.evidence_ref)]));
  }
  const ownedRecords: PersistedActivityRecord[] = owned.results.map(item => ({
    id: String(item.id), version: Number(item.version), definitionCode: String(item.definition_code), definitionVersion: Number(item.definition_version), trackType: "SALES_PROJECT_MANAGEMENT", ltcNodeCode: item.ltc_node_code ? String(item.ltc_node_code) : undefined,
    title: String(item.title), purpose: String(item.purpose), ownerName: String(item.owner_name), status: String(item.status) as PersistedActivityRecord["status"],
    timelinessStatus: liveTimeliness(String(item.status), String(item.planned_end), item.actual_end ? String(item.actual_end) : null), plannedStart: item.planned_start ? String(item.planned_start) : undefined,
    plannedEnd: String(item.planned_end), actualStart: item.actual_start ? String(item.actual_start) : undefined, actualEnd: item.actual_end ? String(item.actual_end) : undefined,
    result: item.result ? String(item.result) : undefined, exceptionReason: item.exception_reason ? String(item.exception_reason) : undefined,
    businessObjectRefs: jsonArray<Record<string, string>>(item.business_object_refs), evidenceRefs: evidenceByActivity.get(String(item.id)) ?? [], gateInstanceId: item.gate_instance_id ? String(item.gate_instance_id) : undefined,
    completionEvent: String(item.completion_event), authoritySystem: String(item.authority_system), readOnly: false,
  }));
  const projectedRecords: PersistedActivityRecord[] = projected.results.map(item => ({
    id: String(item.id), version: Number(item.definition_version), definitionCode: String(item.definition_code), definitionVersion: Number(item.definition_version), trackType: "BID_OPERATION", ltcNodeCode: item.ltc_node_code ? String(item.ltc_node_code) : undefined,
    title: String(item.definition_name), purpose: "外部专业系统作业状态投影", ownerName: String(item.owner_name), status: projectedExecutionStatus(String(item.status)),
    timelinessStatus: liveTimeliness(String(item.status), String(item.planned_end ?? new Date().toISOString().slice(0, 10)), item.actual_end ? String(item.actual_end) : null),
    plannedStart: item.planned_start ? String(item.planned_start) : undefined, plannedEnd: String(item.planned_end ?? item.source_updated_at).slice(0, 10), actualStart: item.actual_start ? String(item.actual_start) : undefined,
    actualEnd: item.actual_end ? String(item.actual_end) : undefined, result: item.completion_event ? String(item.completion_event) : undefined, exceptionReason: item.blocker ? String(item.blocker) : undefined,
    businessObjectRefs: jsonArray<Record<string, string>>(item.business_object_refs), evidenceRefs: jsonArray<string>(item.evidence_refs), completionEvent: String(item.completion_event ?? ""), authoritySystem: String(item.authority_system), readOnly: true,
    sourceSystem: String(item.source_system), externalActivityInstanceId: String(item.external_activity_instance_id), environment: String(item.environment), simulated: Boolean(item.simulated), syncedAt: String(item.synced_at),
  }));
  return [...ownedRecords, ...projectedRecords];
}

function activityStatusReady(status: PersistedActivityRecord["status"], policy: (typeof GATE_ACTIVITY_REQUIREMENTS)[GateCode][number]["readinessPolicy"]) {
  if (policy === "completed") return status === "completed";
  if (policy === "in_progress_or_completed") return status === "in_progress" || status === "completed";
  return status !== "blocked" && status !== "cancelled";
}

async function buildGateActivitySnapshot(projectId: string, gateCode: GateCode): Promise<GateActivitySnapshot> {
  const activities = await loadProjectActivities(projectId);
  const items: GateActivitySnapshot["items"] = [];
  const scenario = gateCode === "G5" ? await getD1Binding().prepare("SELECT i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?").bind(projectId).first<{ scenario_code: string }>() : null;
  const professionalReviewRequired = gateCode !== "G5" || professionalReviewTypesForScenario(scenario?.scenario_code).length > 0;
  const requirements = GATE_ACTIVITY_REQUIREMENTS[gateCode].map(requirement => gateCode === "G5" && requirement.definitionCode === "ACT-BID-06" && !professionalReviewRequired
    ? { ...requirement, purpose: "专业评审按场景条件触发；当前场景企业阈值尚未触发", readinessPolicy: "context" as const, hard: false }
    : requirement);
  for (const requirement of requirements) {
    const matches = activities.filter(activity => activity.definitionCode === requirement.definitionCode);
    if (!matches.length) {
      items.push({ ...requirement, sourceKind: "not_reported", status: "not_reported", ready: !requirement.hard, evidenceRefs: [], businessObjectRefs: [] });
      continue;
    }
    for (const activity of matches) items.push({
        ...requirement,
        sourceKind: activity.readOnly ? "external" : "owned",
        sourceId: activity.readOnly ? activity.externalActivityInstanceId ?? activity.id : activity.id,
        definitionVersion: activity.definitionVersion,
        instanceVersion: activity.version,
        status: activity.status,
        ready: activityStatusReady(activity.status, requirement.readinessPolicy),
        authoritySystem: activity.authoritySystem,
        ownerName: activity.ownerName,
        evidenceRefs: activity.evidenceRefs,
        businessObjectRefs: activity.businessObjectRefs,
        sourceSystem: activity.sourceSystem,
        environment: activity.environment,
        simulated: activity.simulated,
      });
  }
  return { gateCode, definitionVersion: GATE_DEFINITION_VERSION, items, hasHardBlocker: items.some(item => item.hard && !item.ready), capturedAt: new Date().toISOString() };
}

function activitySnapshotFingerprint(snapshot?: GateActivitySnapshot): string {
  if (!snapshot) return "";
  return JSON.stringify(snapshot.items.map(item => ({
    definitionCode: item.definitionCode,
    sourceKind: item.sourceKind,
    sourceId: item.sourceId ?? null,
    definitionVersion: item.definitionVersion ?? null,
    instanceVersion: item.instanceVersion ?? null,
    status: item.status,
    ready: item.ready,
    evidenceRefs: item.evidenceRefs,
    businessObjectRefs: item.businessObjectRefs,
  })).sort((left, right) => `${left.definitionCode}:${left.sourceId}`.localeCompare(`${right.definitionCode}:${right.sourceId}`)));
}

function gateSourceFingerprint(snapshot?: { items?: Array<{ key?: unknown; ready?: unknown; hard?: unknown; sourceType?: unknown; sourceRefs?: unknown; summary?: unknown; owner?: unknown }> }): string {
  if (!snapshot?.items) return "";
  return JSON.stringify(snapshot.items.map(item => ({
    key: String(item.key ?? ""),
    ready: item.ready === true,
    hard: item.hard === true,
    sourceType: String(item.sourceType ?? ""),
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String).sort() : [],
    summary: String(item.summary ?? ""),
    owner: String(item.owner ?? ""),
  })).sort((left, right) => left.key.localeCompare(right.key)));
}

function assertGateActivityReady(snapshot: GateActivitySnapshot, gateCode: GateCode) {
  const blockers = snapshot.items.filter(item => item.hard && !item.ready);
  if (blockers.length) throw new FlowError(`${gateCode}活动轨尚未闭环：${blockers.map(item => `${item.definitionCode}（${item.status === "not_reported" ? "未回传" : item.status}）`).join("、")}。`, 409);
}

type SystemActivityCreateInput = {
  projectId: string;
  projectCode: string;
  definitionCode: "ACT-SPM-02" | "ACT-SPM-03" | "ACT-SPM-04" | "ACT-SPM-07" | "ACT-SPM-08";
  title: string;
  purpose: string;
  ownerUserId: string;
  ownerName: string;
  status: "planned" | "in_progress";
  plannedStart: string;
  plannedEnd: string;
  businessObjectRefs: Array<Record<string, string>>;
  reason: string;
  evidenceRef?: string;
};

/**
 * 系统活动由已经入账的领域事件创建，不能由前端伪造。配套的部分唯一索引
 * 保证一个项目只有一条生命周期级 SPM02/03/04/07/08 实例。
 */
function createSystemActivityStatements(db: D1Database, input: SystemActivityCreateInput): D1PreparedStatement[] {
  const activityId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const payload = JSON.stringify({ projectCode: input.projectCode, definitionCode: input.definitionCode, status: input.status, reason: input.reason, systemTriggered: true });
  return [
    db.prepare(`INSERT INTO activity_instances (id,project_id,definition_id,title,purpose,owner_user_id,owner_name,status,timeliness_status,planned_start,planned_end,actual_start,business_object_refs,created_by)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id WHERE a.project_id=? AND d.code=?
      )`).bind(activityId, input.projectId, `${input.definitionCode}@1`, input.title, input.purpose, input.ownerUserId, input.ownerName, input.status, "on_track", input.plannedStart, input.plannedEnd, input.status === "in_progress" ? new Date().toISOString() : null, JSON.stringify(input.businessObjectRefs), input.ownerUserId, input.projectId, input.definitionCode),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,'ActivityInstance',?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=?)").bind(eventId, activityId, DOMAIN_EVENTS.activityInstanceCreated, payload, input.ownerUserId, activityId),
    db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=?)").bind(crypto.randomUUID(), activityId, null, input.status, input.reason, eventId, input.ownerUserId, activityId),
    ...(input.evidenceRef ? [db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,created_by) SELECT ?,?,'SYSTEM_EVENT',?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=?)").bind(crypto.randomUUID(), activityId, input.evidenceRef, input.ownerUserId, activityId)] : []),
  ];
}

async function addSystemActivityEvidenceStatements(
  db: D1Database,
  projectId: string,
  projectCode: string,
  definitionCode: string,
  objectRef: Record<string, string>,
  evidenceRef: string,
  actorUserId: string,
): Promise<D1PreparedStatement[]> {
  const row = await db.prepare(`SELECT a.id,a.version,a.business_object_refs FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id
    WHERE a.project_id=? AND d.code=? ORDER BY a.created_at LIMIT 1`).bind(projectId, definitionCode).first<Record<string, string | number>>();
  if (!row) return [];
  const refs = jsonArray<Record<string, string>>(row.business_object_refs);
  if (!refs.some(ref => ref.objectType === objectRef.objectType && ref.objectId === objectRef.objectId)) refs.push(objectRef);
  const commandId = `SYS-EVID-${definitionCode}-${crypto.randomUUID()}`;
  const eventId = crypto.randomUUID();
  const payload = JSON.stringify({ projectCode, activityId: row.id, definitionCode, evidenceRef, businessObjectRef: objectRef, systemTriggered: true });
  return [
    db.prepare("UPDATE activity_instances SET business_object_refs=?,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?").bind(JSON.stringify(refs), commandId, row.id, Number(row.version)),
    db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,source_command_id,created_by) SELECT ?,?,'SOURCE_FACT',?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), row.id, evidenceRef, commandId, actorUserId, row.id, commandId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,'ActivityInstance',?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(eventId, row.id, DOMAIN_EVENTS.activityEvidenceAdded, payload, actorUserId, row.id, commandId),
  ];
}

async function completeSystemActivityStatements(
  db: D1Database,
  projectId: string,
  projectCode: string,
  definitionCode: string,
  result: string,
  evidenceRef: string,
  actorUserId: string,
): Promise<D1PreparedStatement[]> {
  const row = await db.prepare(`SELECT a.id,a.status,a.version FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id
    WHERE a.project_id=? AND d.code=? AND a.status IN ('planned','in_progress','blocked') ORDER BY a.created_at LIMIT 1`).bind(projectId, definitionCode).first<Record<string, string | number>>();
  if (!row) return [];
  const commandId = `SYS-${definitionCode}-${crypto.randomUUID()}`;
  const eventId = crypto.randomUUID();
  const payload = JSON.stringify({ projectCode, activityId: row.id, definitionCode, fromStatus: row.status, toStatus: "completed", result, evidenceRef, systemTriggered: true });
  return [
    db.prepare("UPDATE activity_instances SET status='completed',actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP),actual_end=CURRENT_TIMESTAMP,result=?,exception_reason=NULL,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(result, commandId, row.id, row.status, Number(row.version)),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,'ActivityInstance',?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(eventId, row.id, DOMAIN_EVENTS.activityStatusChanged, payload, actorUserId, row.id, commandId),
    db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,command_id,domain_event_id,actor_user_id) SELECT ?,?,?, 'completed',?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), row.id, row.status, result, commandId, eventId, actorUserId, row.id, commandId),
    db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,source_command_id,created_by) SELECT ?,?,'GATE',?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), row.id, evidenceRef, commandId, actorUserId, row.id, commandId),
  ];
}

function addDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export type CreateInput = {
  scenarioCode: ScenarioType; evidence: string; finalCustomer: string; sourceCustomer: string; target: string; amount: number;
  procurementProjectName: string; requestRef: string; requestDate: string; tenderNo?: string; lotNo?: string;
  deliveryLocation?: string; projectCountry?: string; deliveryCountry?: string; inquiryBatch?: string;
  bidDate: string; leadGrade: "S" | "A" | "B" | "C"; organization: string;
  requirementDate?: string; technicalDate?: string; costingDate?: string; firstAction?: string;
  ownerUserId?: "sales-chen";
  leadConversionId?: string;
  /** 主管代建只能保存草稿；销售Owner可选择在转化完成后立即提交G1。 */
  submitG1?: boolean;
};

function normalizedKeyPart(value: string | undefined) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[\s\-—_（）()【】[\]·.,，。/\\]+/g, "");
}

export function buildOpportunityFingerprint(input: Pick<CreateInput, "finalCustomer" | "procurementProjectName" | "tenderNo" | "lotNo" | "deliveryLocation" | "target" | "bidDate">) {
  const tenderNo = normalizedKeyPart(input.tenderNo);
  const components = [normalizedKeyPart(input.finalCustomer), normalizedKeyPart(input.procurementProjectName), tenderNo, normalizedKeyPart(input.lotNo), normalizedKeyPart(input.target)];
  if (!tenderNo) components.push(normalizedKeyPart(input.deliveryLocation), input.bidDate.slice(0, 7));
  return `OPP-V1|${components.join("|")}`;
}

function requiredText(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new FlowError(`${label}不能为空。`);
  if (value.trim().length > max) throw new FlowError(`${label}超过${max}字。`);
  return value.trim();
}

export function parseCreateInput(raw: unknown): CreateInput {
  if (!raw || typeof raw !== "object") throw new FlowError("请求数据格式不正确。");
  const data = raw as Record<string, unknown>;
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000_000) throw new FlowError("预计金额必须大于0且不超过100亿元。");
  const leadGrade = data.leadGrade ?? data.projectGrade;
  if (!["S", "A", "B", "C"].includes(String(leadGrade))) throw new FlowError("线索评级不合法。");
  const date = (key: string, label: string) => {
    const value = requiredText(data[key], label, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FlowError(`${label}格式必须为 YYYY-MM-DD。`);
    return value;
  };
  const optionalDate = (key: string, label: string) => data[key] === undefined || data[key] === "" ? undefined : date(key, label);
  const optionalText = (key: string, label: string, max: number) => data[key] === undefined || data[key] === "" ? undefined : requiredText(data[key], label, max);
  const scenarioCode = String(data.scenarioCode);
  if (!SCENARIO_TYPES.some(item => item.code === scenarioCode)) throw new FlowError("业务场景不合法。");
  const tenderNo = optionalText("tenderNo", "招标编号", 160);
  const deliveryLocation = optionalText("deliveryLocation", "交付地点", 200);
  if (!tenderNo && !deliveryLocation) throw new FlowError("没有招标项目编号时，交付地点是采购机会查重的必要补充字段。");
  return {
    scenarioCode: scenarioCode as ScenarioType, evidence: requiredText(data.evidence, "采购意向证据", 1000),
    finalCustomer: requiredText(data.finalCustomer, "最终客户/业主", 120), sourceCustomer: requiredText(data.sourceCustomer, isEpcScenarioCode(scenarioCode) ? "询价EPC/伙伴客户" : "采购请求客户", 120),
    target: requiredText(data.target, "产品范围", 200), amount, procurementProjectName: requiredText(data.procurementProjectName, "工程/采购项目名称", 200),
    requestRef: requiredText(data.requestRef, scenarioCode === "SCN-01-DIRECT-BID" ? "招标文件编号" : isEpcScenarioCode(scenarioCode) ? "EPC/伙伴询价编号" : "直接询价编号", 160),
    requestDate: date("requestDate", "采购请求日期"), tenderNo,
    lotNo: typeof data.lotNo === "string" && data.lotNo.trim() ? requiredText(data.lotNo, "标包编号", 120) : undefined,
    deliveryLocation,
    projectCountry: scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" ? requiredText(data.projectCountry, "项目国家", 80) : optionalText("projectCountry", "项目国家", 80),
    deliveryCountry: scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" ? requiredText(data.deliveryCountry, "交付国家", 80) : optionalText("deliveryCountry", "交付国家", 80),
    inquiryBatch: isEpcScenarioCode(scenarioCode) ? requiredText(data.inquiryBatch, "EPC/伙伴询价批次", 120) : undefined,
    bidDate: date("bidDate", scenarioCode === "SCN-01-DIRECT-BID" ? "投标截止日期" : "报价截止日期"), leadGrade: leadGrade as CreateInput["leadGrade"], organization: requiredText(data.organization, "所属组织", 120),
    requirementDate: optionalDate("requirementDate", "近期行动截止日期"), technicalDate: optionalDate("technicalDate", "技术方案日期"), costingDate: optionalDate("costingDate", "核价日期"),
    firstAction: typeof data.firstAction === "string" && data.firstAction.trim() ? requiredText(data.firstAction, "近期下一行动", 300) : undefined,
    ownerUserId: data.ownerUserId === undefined || data.ownerUserId === "" ? undefined : String(data.ownerUserId) === "sales-chen" ? "sales-chen" : (() => { throw new FlowError("当前演示Owner不在受控人员目录。", 400); })(),
    leadConversionId: typeof data.leadConversionId === "string" && data.leadConversionId.trim() ? requiredText(data.leadConversionId, "线索转化记录", 120) : undefined,
    submitG1: data.submitG1 === undefined ? true : data.submitG1 === true,
  };
}

export async function checkOpportunityDuplicate(input: CreateInput) {
  const fingerprintKey = buildOpportunityFingerprint(input);
  const match = await getD1Binding().prepare("SELECT p.project_code,p.name,p.stage,p.administrative_status FROM opportunity_fingerprints f JOIN sales_projects p ON p.id=f.project_id WHERE f.fingerprint_key=? LIMIT 1").bind(fingerprintKey).first<Record<string, string>>();
  return { fingerprintKey, duplicate: Boolean(match), match: match ? { projectCode: match.project_code, projectName: match.name, stage: match.stage, administrativeStatus: match.administrative_status } : null, ruleVersion: "OPPORTUNITY_FINGERPRINT_V1" };
}

export async function createIntentProjectAndG1(input: CreateInput, actor: DemoActor) {
  await ensureDemoPrincipals();
  const db = getD1Binding();
  const requestedOwnerId = input.ownerUserId ?? (actor.role === "sales" ? actor.id : "sales-chen");
  const submitG1 = input.submitG1 !== false;
  if (actor.role === "sales" && requestedOwnerId !== actor.id) throw new FlowError("销售员只能为本人提交立项；主管或受控线索接口可以分配Owner。", 403);
  if (actor.role === "manager" && submitG1) throw new FlowError("主管代建只能保存S0草稿；G1必须由项目Owner提交，避免申请人与审批人混同。", 409);
  const projectOwner = await db.prepare("SELECT u.id,u.display_name FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=? AND r.code='sales' AND u.active=1").bind(requestedOwnerId).first<{ id: string; display_name: string }>();
  if (!projectOwner) throw new FlowError("项目Owner不存在、未启用或不具备销售员角色。", 400);
  const leadConversion = input.leadConversionId ? await db.prepare("SELECT * FROM lead_conversion_inbox WHERE id=?").bind(input.leadConversionId).first<Record<string, unknown>>() : null;
  if (input.leadConversionId && !leadConversion) throw new FlowError("线索转化记录不存在。", 404);
  if (leadConversion?.converted_project_id) {
    const existing = await db.prepare("SELECT p.id,p.project_code,p.stage,p.stage_name,g.id AS gate_id,g.status AS gate_status FROM sales_projects p LEFT JOIN stage_gate_instances g ON g.project_id=p.id AND g.gate_code='G1' WHERE p.id=?").bind(leadConversion.converted_project_id).first<Record<string, string>>();
    if (existing) return { projectId: existing.id, projectCode: existing.project_code, gateId: existing.gate_id, gateStatus: existing.gate_status, stage: existing.stage, stageName: existing.stage_name, lifecycleStatus: existing.stage === "S0" ? "待立项" : "已立项", duplicate: true };
  }
  if (leadConversion && actor.role === "sales" && leadConversion.assigned_owner_external_id && leadConversion.assigned_owner_external_id !== actor.id) throw new FlowError("该线索已分配给其他销售员，当前身份不能转化。", 403);
  const opportunityFingerprint = buildOpportunityFingerprint(input);
  const possibleDuplicate = await db.prepare("SELECT p.project_code FROM opportunity_fingerprints f JOIN sales_projects p ON p.id=f.project_id WHERE f.fingerprint_key=? LIMIT 1").bind(opportunityFingerprint).first<{ project_code: string }>();
  if (possibleDuplicate) throw new FlowError(`采购机会指纹命中项目 ${possibleDuplicate.project_code}；同一最终采购机会不得按询价客户重复建项，应关联既有项目或新增EPC报价通路。`, 409);

  const finalCustomerNormalized = normalizedKeyPart(input.finalCustomer);
  const sourceCustomerNormalized = normalizedKeyPart(input.sourceCustomer);
  const existingFinalParty = await db.prepare("SELECT id FROM parties WHERE normalized_name=?").bind(finalCustomerNormalized).first<{ id: string }>();
  const existingSourceParty = sourceCustomerNormalized === finalCustomerNormalized ? existingFinalParty : await db.prepare("SELECT id FROM parties WHERE normalized_name=?").bind(sourceCustomerNormalized).first<{ id: string }>();

  const intentId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const gateId = crypto.randomUUID();
  const priorityActivityId = crypto.randomUUID();
  const priorityActivityEventId = crypto.randomUUID();
  const firstActionActivityId = crypto.randomUUID();
  const firstActionEventId = crypto.randomUUID();
  const finalCustomerPartyId = existingFinalParty?.id ?? crypto.randomUUID();
  const sourceCustomerPartyId = existingSourceParty?.id ?? (sourceCustomerNormalized === finalCustomerNormalized ? finalCustomerPartyId : crypto.randomUUID());
  const procurementRequestId = crypto.randomUUID();
  const fingerprintId = crypto.randomUUID();
  const quotationRouteId = isEpcScenarioCode(input.scenarioCode) ? crypto.randomUUID() : undefined;
  const bidRoundId = input.scenarioCode === "SCN-01-DIRECT-BID" ? crypto.randomUUID() : undefined;
  const leadRequirementSnapshotId = leadConversion ? crypto.randomUUID() : undefined;
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const projectCode = `QJ-${stamp}-${projectId.slice(0, 6).toUpperCase()}`;
  const salesProjectName = /项目$/u.test(input.procurementProjectName) ? input.procurementProjectName : `${input.procurementProjectName}项目`;
  const scenario = SCENARIO_TYPES.find(item => item.code === input.scenarioCode)!;
  const hasInitialPlan = Boolean(input.firstAction);
  const g1DueDate = input.requirementDate ?? input.bidDate;
  const leadSourceSnapshot = leadConversion ? jsonRecord(leadConversion.source_snapshot) : null;
  const leadRequirement = leadConversion
    ? jsonRecord(leadSourceSnapshot?.initialRequirement) ?? {
        originalText: String(leadConversion.product_scope ?? input.target),
        productRequirement: String(leadConversion.product_scope ?? input.target),
        quantity: String(leadConversion.quantity ?? ""),
        qualificationRequirements: "",
        knownConstraints: [],
        unknowns: ["旧版线索事件未提供结构化初始需求，请在项目澄清中补充"],
        sourceRefs: jsonArray(leadConversion.evidence_refs).map(String),
      }
    : null;
  const leadRequirementSources = leadConversion ? (jsonArray(leadRequirement?.sourceRefs).length ? jsonArray(leadRequirement?.sourceRefs).map(String) : jsonArray(leadConversion.evidence_refs).map(String)) : [];
  const sourceSnapshot = JSON.stringify({ ...input, ownerUserId: projectOwner.id, ownerName: projectOwner.display_name, scenarioName: scenario.name, procurementRequestType: scenario.requestType, submissionType: scenario.submissionType, opportunityFingerprint, duplicateStatus: "clear", leadSource: leadConversion ? { inboxId: leadConversion.id, sourceSystem: leadConversion.source_system, leadId: leadConversion.lead_id, leadCode: leadConversion.lead_code, leadGrade: leadConversion.lead_grade, originalSnapshot: leadSourceSnapshot } : null });
  const leadBusinessContext = leadConversion ? jsonRecord(leadConversion.business_context) : null;
  const detailSnapshot = JSON.stringify({ requirementDate: input.requirementDate, technicalDate: input.technicalDate, costingDate: input.costingDate, firstAction: input.firstAction, finalCustomer: input.finalCustomer, sourceCustomer: input.sourceCustomer, procurementProjectName: input.procurementProjectName, requestRef: input.requestRef, deliveryLocation: input.deliveryLocation, projectCountry: input.projectCountry, deliveryCountry: input.deliveryCountry, leadConversionId: input.leadConversionId ?? null, leadCandidateContext: leadConversion ? { businessContext: leadBusinessContext, contacts: jsonArray(leadConversion.contact_snapshot), followups: jsonArray(leadConversion.followup_snapshot), attachments: jsonArray(leadConversion.attachment_snapshot) } : null });
  const projectAfter = JSON.stringify({ projectCode, stage: "S0", lifecycleStatus: "待立项", gate: "G1", gateStatus: submitG1 ? "pending" : "draft" });
  const g1ActivitySnapshot: GateActivitySnapshot = {
    gateCode: "G1",
    definitionVersion: GATE_DEFINITION_VERSION,
    items: [{
      ...GATE_ACTIVITY_REQUIREMENTS.G1[0], sourceKind: "owned", sourceId: priorityActivityId, definitionVersion: 1, instanceVersion: 1,
      status: "in_progress", ready: true, authoritySystem: "SALES_PROJECT_APP", ownerName: projectOwner.display_name, evidenceRefs: [input.evidence],
      businessObjectRefs: [{ objectType: "SalesProject", objectId: projectId }, { objectType: "ProcurementIntent", objectId: intentId }],
    }],
    hasHardBlocker: false,
    capturedAt: new Date().toISOString(),
  };
  const g1Snapshot = JSON.stringify({ procurementIntent: JSON.parse(sourceSnapshot), activitySnapshot: g1ActivitySnapshot, generatedAt: new Date().toISOString() });

  try {
    await db.batch([
    ...(!existingFinalParty ? [db.prepare("INSERT INTO parties (id,display_name,normalized_name,party_kind,master_status,source_system,source_ref) VALUES (?,?,?,?,?,?,?)").bind(finalCustomerPartyId, input.finalCustomer, finalCustomerNormalized, "customer", "temporary", "PROCUREMENT_REQUEST", `${input.requestRef}:FINAL`)] : []),
    ...(!existingSourceParty && sourceCustomerPartyId !== finalCustomerPartyId ? [db.prepare("INSERT INTO parties (id,display_name,normalized_name,party_kind,master_status,source_system,source_ref) VALUES (?,?,?,?,?,?,?)").bind(sourceCustomerPartyId, input.sourceCustomer, sourceCustomerNormalized, "customer", "temporary", "PROCUREMENT_REQUEST", `${input.requestRef}:SOURCE`)] : []),
    db.prepare("INSERT INTO procurement_intents (id,scenario_code,intent_type,evidence,customer_name,target,amount_cents,bid_date,owner_user_id,duplicate_status,source_snapshot,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(intentId, input.scenarioCode, scenario.requestType, input.evidence, input.sourceCustomer, input.target, Math.round(input.amount * 100), input.bidDate, projectOwner.id, "clear", sourceSnapshot, actor.id),
    db.prepare("INSERT INTO sales_projects (id,project_code,procurement_intent_id,name,customer_name,target,amount_cents,project_grade,lead_grade,project_importance,project_importance_reason,organization,owner_user_id,owner_name,stage,stage_name,lifecycle_status,result,administrative_status,bid_date,evidence,detail_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(projectId, projectCode, intentId, salesProjectName, input.finalCustomer, input.target, Math.round(input.amount * 100), input.leadGrade, input.leadGrade, null, null, input.organization, projectOwner.id, projectOwner.display_name, "S0", "待立项", "待立项", "pending", "Active", input.bidDate, input.evidence, detailSnapshot),
    db.prepare("INSERT INTO opportunity_fingerprints (id,project_id,fingerprint_key,final_customer_name,procurement_project_name,tender_no,lot_no,delivery_location,product_scope,procurement_time_window,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(fingerprintId, projectId, opportunityFingerprint, input.finalCustomer, input.procurementProjectName, input.tenderNo ?? null, input.lotNo ?? null, input.deliveryLocation ?? "", input.target, input.tenderNo ? null : input.bidDate.slice(0, 7), "confirmed"),
    db.prepare("INSERT INTO procurement_requests (id,project_id,procurement_intent_id,request_type,request_ref,source_party_id,final_customer_party_id,inquiry_batch,evidence_ref,requested_submission_date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(procurementRequestId, projectId, intentId, scenario.requestType, input.requestRef, sourceCustomerPartyId, finalCustomerPartyId, input.inquiryBatch ?? null, input.evidence, input.bidDate, actor.id),
    db.prepare("INSERT INTO sales_project_party_roles (id,project_id,party_id,role_type,source_request_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), projectId, finalCustomerPartyId, "end_customer", procurementRequestId),
    ...(sourceCustomerPartyId !== finalCustomerPartyId ? [db.prepare("INSERT INTO sales_project_party_roles (id,project_id,party_id,role_type,source_request_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), projectId, sourceCustomerPartyId, "inquiry_customer", procurementRequestId), db.prepare("INSERT INTO sales_project_party_roles (id,project_id,party_id,role_type,source_request_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), projectId, sourceCustomerPartyId, "potential_contract_customer", procurementRequestId)] : [db.prepare("INSERT INTO sales_project_party_roles (id,project_id,party_id,role_type,source_request_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), projectId, finalCustomerPartyId, "potential_contract_customer", procurementRequestId)]),
    ...(quotationRouteId ? [db.prepare("INSERT INTO quotation_routes (id,project_id,epc_customer,inquiry_ref,inquiry_date,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?)").bind(quotationRouteId, projectId, input.sourceCustomer, input.requestRef, input.requestDate, input.evidence, "active", actor.id)] : []),
    ...(bidRoundId ? [db.prepare("INSERT INTO bid_rounds (id,project_id,round_no,round_type,authority_system,status,tender_document_ref,bid_deadline,source_event_id,source_snapshot) VALUES (?,?,1,'initial','BID_MANAGEMENT_APP','registered',?,?,?,?)").bind(bidRoundId, projectId, input.requestRef, input.bidDate, leadConversion?.event_id ?? null, JSON.stringify({ requestRef: input.requestRef, tenderNo: input.tenderNo ?? null, lotNo: input.lotNo ?? null, evidenceRef: input.evidence }))] : []),
    ...(leadConversion ? [db.prepare("INSERT INTO project_source_links (id,project_id,source_system,source_object_type,source_object_id,source_object_code,relation_type,source_snapshot,field_provenance,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), projectId, leadConversion.source_system, "Lead", leadConversion.lead_id, leadConversion.lead_code, "converted_from", String(leadConversion.source_snapshot), String(leadConversion.field_provenance), String(leadConversion.occurred_at)), db.prepare("UPDATE lead_conversion_inbox SET status='manually_converted',converted_project_id=?,converted_by=?,converted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND converted_project_id IS NULL").bind(projectId, actor.id, leadConversion.id)] : []),
    ...(leadRequirementSnapshotId && leadConversion && leadRequirement ? [
      db.prepare("INSERT INTO lead_requirement_snapshots (id,project_id,source_system,lead_id,lead_code,snapshot_version,original_text,requirement_snapshot,source_refs,field_provenance,source_occurred_at,immutable) VALUES (?,?,?,?,?,1,?,?,?,?,?,1)").bind(leadRequirementSnapshotId, projectId, leadConversion.source_system, leadConversion.lead_id, leadConversion.lead_code, String(leadRequirement.originalText ?? leadConversion.product_scope ?? input.target), JSON.stringify(leadRequirement), JSON.stringify(leadRequirementSources), String(leadConversion.field_provenance), String(leadConversion.occurred_at)),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "LeadRequirementSnapshot", leadRequirementSnapshotId, "LeadRequirementSnapshotFrozen", JSON.stringify({ leadId: leadConversion.lead_id, leadCode: leadConversion.lead_code, sourceRefs: leadRequirementSources, immutable: true }), actor.id),
    ] : []),
    db.prepare("INSERT INTO role_assignments (id,project_id,role_name,assignee_name,status,required,evidence_ref,accepted_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "销售Owner", projectOwner.display_name, "已到位", 1, input.leadConversionId ? `线索转化:${String(leadConversion?.lead_code ?? input.leadConversionId)}` : "项目立项申请", new Date().toISOString(), actor.id),
    ...(submitG1 ? [
      db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,definition_version) VALUES (?,?,?,?,?,?,?,?)").bind(gateId, projectId, "G1", "S0", "S1", "pending", actor.id, GATE_DEFINITION_VERSION),
      db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, 1, g1Snapshot, actor.id),
    ] : []),
    ...(submitG1
      ? [db.prepare("INSERT INTO activity_instances (id,project_id,definition_id,title,purpose,owner_user_id,owner_name,status,timeliness_status,planned_start,planned_end,actual_start,business_object_refs,gate_instance_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(priorityActivityId, projectId, "ACT-SPM-01@1", "确认项目价值、等级与Owner", "确认立项价值、项目等级和Owner责任并形成可审计依据", projectOwner.id, projectOwner.display_name, "in_progress", "on_track", new Date().toISOString().slice(0, 10), g1DueDate, new Date().toISOString(), JSON.stringify([{ objectType: "SalesProject", objectId: projectId }, { objectType: "ProcurementIntent", objectId: intentId }]), gateId, actor.id)]
      : [db.prepare("INSERT INTO activity_instances (id,project_id,definition_id,title,purpose,owner_user_id,owner_name,status,timeliness_status,planned_start,planned_end,business_object_refs,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(priorityActivityId, projectId, "ACT-SPM-01@1", "确认项目价值、等级与Owner", "确认立项价值、项目等级和Owner责任并形成可审计依据", projectOwner.id, projectOwner.display_name, "planned", "on_track", new Date().toISOString().slice(0, 10), g1DueDate, JSON.stringify([{ objectType: "SalesProject", objectId: projectId }, { objectType: "ProcurementIntent", objectId: intentId }]), actor.id)]),
    ...(hasInitialPlan ? [db.prepare("INSERT INTO activity_instances (id,project_id,definition_id,title,purpose,owner_user_id,owner_name,status,timeliness_status,planned_start,planned_end,business_object_refs,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(firstActionActivityId, projectId, "ACT-SPM-05@1", input.firstAction!, "完成立项后的首个客户经营事实确认", projectOwner.id, projectOwner.display_name, "planned", "on_track", new Date().toISOString().slice(0, 10), input.requirementDate ?? input.bidDate, JSON.stringify([{ objectType: "SalesProject", objectId: projectId }]), actor.id)] : []),
    db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,created_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), priorityActivityId, "INPUT", input.evidence, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(priorityActivityEventId, "ActivityInstance", priorityActivityId, DOMAIN_EVENTS.activityInstanceCreated, JSON.stringify({ definitionCode: "ACT-SPM-01", status: submitG1 ? "in_progress" : "planned", projectCode }), actor.id),
    ...(hasInitialPlan ? [db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(firstActionEventId, "ActivityInstance", firstActionActivityId, DOMAIN_EVENTS.activityInstanceCreated, JSON.stringify({ definitionCode: "ACT-SPM-05", status: "planned", projectCode }), actor.id)] : []),
    db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), priorityActivityId, null, submitG1 ? "in_progress" : "planned", submitG1 ? "提交立项申请并进入G1" : "保存S0项目草稿，尚未提交G1", priorityActivityEventId, actor.id),
    ...(hasInitialPlan ? [db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), firstActionActivityId, null, "planned", "项目立项时登记首个销售行动", firstActionEventId, actor.id)] : []),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProcurementIntent", intentId, DOMAIN_EVENTS.procurementIntentQualified, sourceSnapshot, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", projectId, DOMAIN_EVENTS.salesProjectCreated, projectAfter, actor.id),
    ...(submitG1 ? [db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGate", gateId, DOMAIN_EVENTS.g1ApprovalRequested, projectAfter, actor.id)] : []),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), projectId, "立项", submitG1 ? "创建项目并提交G1" : "保存S0项目草稿", null, projectAfter, actor.id),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/opportunity_fingerprints_key_uq|opportunity_fingerprints\.fingerprint_key/i.test(message)) {
      throw new FlowError("同一采购机会已被并发创建；请刷新项目列表，并在既有项目中补充EPC报价通路。", 409);
    }
    if (/parties_(normalized_name|source)_uq|parties\.(normalized_name|source_system)/i.test(message)) {
      throw new FlowError("客户主数据刚被其他操作创建；请刷新后重新提交，系统不会自动生成重复客户。", 409);
    }
    throw error;
  }
  return { projectId, projectCode, gateId: submitG1 ? gateId : undefined, gateStatus: submitG1 ? "pending" as const : "draft" as const, stage: "S0" as const, stageName: "待立项", lifecycleStatus: "待立项", opportunityFingerprint, procurementRequestId, quotationRouteId, bidRoundId, leadConversionId: input.leadConversionId, activityIds: hasInitialPlan ? [priorityActivityId, firstActionActivityId] : [priorityActivityId] };
}

type CreateSpmActivityInput = { title: string; purpose: string; ownerName: string; plannedEnd: string; evidenceRef: string; context: "project_operation" | "post_award_responsibility"; riskId?: string; expectedRiskVersion?: number };

export function parseCreateSpmActivity(raw: unknown): CreateSpmActivityInput {
  if (!raw || typeof raw !== "object") throw new FlowError("项目活动格式不正确。");
  const data = raw as Record<string, unknown>;
  const plannedEnd = requiredText(data.plannedEnd, "计划完成日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedEnd) || Number.isNaN(Date.parse(`${plannedEnd}T00:00:00Z`))) throw new FlowError("计划完成日期格式必须为 YYYY-MM-DD。");
  const riskId = typeof data.riskId === "string" && data.riskId.trim() ? requiredText(data.riskId, "关联风险编号", 120) : undefined;
  const expectedRiskVersion = riskId ? Number(data.expectedRiskVersion) : undefined;
  if (riskId && (!Number.isInteger(expectedRiskVersion) || Number(expectedRiskVersion) < 1)) throw new FlowError("关联风险版本号必须是正整数。");
  const context = data.context === "post_award_responsibility" ? "post_award_responsibility" : "project_operation";
  return { title: requiredText(data.title, context === "post_award_responsibility" ? "遗留责任事项" : "活动名称", 300), purpose: requiredText(data.purpose, context === "post_award_responsibility" ? "责任目标" : "活动目的", 1000), ownerName: requiredText(data.ownerName, "活动Owner", 120), plannedEnd, evidenceRef: requiredText(data.evidenceRef, "证据要求", 1000), context, riskId, expectedRiskVersion };
}

export async function createSpmActivity(projectCode: string, input: CreateSpmActivityInput, actor: DemoActor) {
  if (actor.role !== "sales" && actor.role !== "manager") throw new FlowError("只有销售项目Owner或销售主管可以创建销售项目管理活动。", 403);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,owner_user_id,owner_name,stage,result,administrative_status FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (actor.role === "sales" && project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以创建项目经营行动。", 403);
  if (["Closed", "Terminated"].includes(project.administrative_status)) throw new FlowError("已关闭项目不能创建新活动。", 409);
  if (input.context === "project_operation" && project.result !== "pending") throw new FlowError("商业结果已形成；投标前经营活动已冻结，只能通过结果纠错或S6成交后遗留责任流程处理。", 409);
  if (input.context === "post_award_responsibility" && project.stage !== "S6") throw new FlowError("成交后遗留责任只能在完成G6并进入S6后登记。", 409);
  if (input.context === "post_award_responsibility" && actor.role !== "sales") throw new FlowError("成交后遗留责任由项目销售Owner登记和闭环；主管只能查看和督办。", 403);
  const owner = await db.prepare("SELECT id,display_name FROM users WHERE display_name=? AND active=1").bind(input.ownerName).first<{ id: string; display_name: string }>();
  if (!owner) throw new FlowError("活动Owner必须是系统中的有效用户，不能只保存无法识别的人名。", 409);
  if (owner.id !== project.owner_user_id) throw new FlowError("当前销售项目活动必须由项目Owner承担；技术、核价和投标人员应通过外部协同任务参与。", 409);
  const definitionCode = actor.role === "manager" ? "ACT-SPM-06" : "ACT-SPM-05";
  const definition = await db.prepare("SELECT id,completion_event FROM activity_definitions WHERE code=? AND active=1 ORDER BY version DESC LIMIT 1").bind(definitionCode).first<{ id: string; completion_event: string }>();
  if (!definition) throw new FlowError(`${definitionCode}活动定义未生效。`, 500);
  const activityId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const linkedRisk = input.riskId ? await db.prepare("SELECT id,status,version FROM project_risks WHERE id=? AND project_id=?").bind(input.riskId, project.id).first<Record<string, string | number>>() : null;
  if (input.riskId && (!linkedRisk || linkedRisk.status !== "open" || Number(linkedRisk.version) !== input.expectedRiskVersion)) throw new FlowError("关联风险不存在、状态已变化或版本已过期，请刷新后重试。", 409);
  if (input.riskId && actor.role !== "sales") throw new FlowError("主管督办不能替代项目Owner创建风险处置行动。", 403);
  const responsibilityRef = input.context === "post_award_responsibility" ? { objectType: "PostAwardResponsibility", objectId: activityId } : null;
  const payload = JSON.stringify({ projectCode, activityId, definitionCode, context: input.context, ownerUserId: owner.id, ownerName: owner.display_name, status: "planned", plannedEnd: input.plannedEnd });
  const statements = [
    db.prepare("INSERT INTO activity_instances (id,project_id,definition_id,title,purpose,owner_user_id,owner_name,status,timeliness_status,planned_start,planned_end,business_object_refs,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(activityId, project.id, definition.id, input.title, input.purpose, owner.id, owner.display_name, "planned", input.plannedEnd < today ? "overdue" : "on_track", today, input.plannedEnd, JSON.stringify([{ objectType: "SalesProject", objectId: project.id }, ...(responsibilityRef ? [responsibilityRef] : [])]), actor.id),
    db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,created_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), activityId, "EXPECTED", input.evidenceRef, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(eventId, "ActivityInstance", activityId, DOMAIN_EVENTS.activityInstanceCreated, payload, actor.id),
    db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), activityId, null, "planned", input.context === "post_award_responsibility" ? "项目Owner登记成交后遗留责任" : actor.role === "manager" ? "销售主管确认并下发督办" : "销售项目Owner创建经营行动", eventId, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "活动", input.context === "post_award_responsibility" ? "登记成交后遗留责任" : actor.role === "manager" ? "创建主管督办活动" : "创建项目经营活动", null, payload, actor.id),
  ];
  if (linkedRisk) statements.push(
    db.prepare("UPDATE project_risks SET status='mitigating',mitigation_activity_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open' AND version=?").bind(activityId, linkedRisk.id, input.expectedRiskVersion),
    db.prepare("INSERT INTO project_risk_transitions (id,risk_id,from_status,to_status,reason,evidence_ref,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), linkedRisk.id, "open", "mitigating", `已建立处置行动：${input.title}`, activityId, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectRisk", linkedRisk.id, DOMAIN_EVENTS.projectRiskStatusChanged, JSON.stringify({ projectCode, riskId: linkedRisk.id, status: "mitigating", mitigationActivityId: activityId, version: Number(linkedRisk.version) + 1 }), actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "风险", "风险转为处置行动", JSON.stringify({ status: "open", version: linkedRisk.version }), JSON.stringify({ status: "mitigating", mitigationActivityId: activityId, version: Number(linkedRisk.version) + 1 }), actor.id),
  );
  await db.batch(statements);
  const activity = (await loadProjectActivities(project.id)).find(item => item.id === activityId);
  return { projectCode, activity };
}

export type ActivityCommandInput = {
  commandId: string;
  command: ActivityCommand;
  expectedVersion: number;
  reason: string;
  result?: string;
  evidenceRef?: string;
};

export function parseActivityCommand(raw: unknown): ActivityCommandInput {
  if (!raw || typeof raw !== "object") throw new FlowError("活动命令格式不正确。");
  const data = raw as Record<string, unknown>;
  const commandId = requiredText(data.commandId, "命令幂等编号", 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(commandId)) throw new FlowError("命令幂等编号格式不合法。");
  const command = String(data.command);
  if (!ACTIVITY_COMMANDS.includes(command as ActivityCommand)) throw new FlowError("活动命令不合法。");
  const expectedVersion = Number(data.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new FlowError("活动版本号必须是正整数。");
  const reason = requiredText(data.reason, "操作原因", 1000);
  const result = typeof data.result === "string" && data.result.trim() ? requiredText(data.result, "完成结果", 2000) : undefined;
  const evidenceRef = typeof data.evidenceRef === "string" && data.evidenceRef.trim() ? requiredText(data.evidenceRef, "证据引用", 2000) : undefined;
  if (command === "complete" && !result) throw new FlowError("完成活动必须填写可验证的完成结果。");
  if (["block", "resume", "complete", "cancel", "add_evidence"].includes(command) && !evidenceRef) throw new FlowError("该活动操作必须提供证据引用。");
  return { commandId, command: command as ActivityCommand, expectedVersion, reason, result, evidenceRef };
}

export async function commandSpmActivity(projectCode: string, activityId: string, input: ActivityCommandInput, actor: DemoActor) {
  if (actor.role !== "sales" && actor.role !== "manager") throw new FlowError("只有销售项目Owner或销售主管可以操作销售项目活动。", 403);
  const db = getD1Binding();
  const row = await db.prepare(`SELECT a.*,d.code AS definition_code,d.track_type,p.owner_user_id AS project_owner_user_id,p.result AS project_result,p.administrative_status
    FROM activity_instances a
    JOIN activity_definitions d ON d.id=a.definition_id
    JOIN sales_projects p ON p.id=a.project_id
    WHERE p.project_code=? AND a.id=?`).bind(projectCode, activityId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("销售项目活动不存在。", 404);
  if (row.track_type !== "SALES_PROJECT_MANAGEMENT") throw new FlowError("投标作业活动是外部只读投影，销售项目APP无权修改。", 403);
  if (!["ACT-SPM-05", "ACT-SPM-06"].includes(String(row.definition_code))) throw new FlowError("该活动由Gate或领域事件驱动，禁止人工修改状态。", 409);
  if (actor.role === "sales") {
    if (row.project_owner_user_id !== actor.id || row.owner_user_id !== actor.id) throw new FlowError("销售员只能操作本人承担且归属本人项目的活动。", 403);
  } else if (input.command !== "add_evidence" && !(input.command === "cancel" && row.definition_code === "ACT-SPM-06")) {
    throw new FlowError("销售主管可以追加督办证据，并可取消主管督办；不能代替Owner执行或完成活动。", 403);
  }
  if (["Closed", "Terminated"].includes(String(row.administrative_status)) && input.command !== "add_evidence") throw new FlowError("已关闭项目只能追加审计证据，不能继续流转活动。", 409);
  const businessRefs = String(row.business_object_refs ?? "");
  if (String(row.project_result) !== "pending" && !businessRefs.includes("PostAwardResponsibility") && input.command !== "add_evidence") throw new FlowError("商业结果已形成；投标前经营活动已冻结，只能追加审计证据。", 409);
  const fingerprint = await commandFingerprint(input);
  const existingReceipt = await db.prepare("SELECT activity_instance_id,actor_user_id,request_fingerprint,resulting_version FROM activity_command_receipts WHERE command_id=?").bind(input.commandId).first<Record<string, string | number>>();
  if (existingReceipt) {
    if (existingReceipt.activity_instance_id !== activityId || existingReceipt.actor_user_id !== actor.id || existingReceipt.request_fingerprint !== fingerprint) throw new FlowError("同一命令幂等编号已被不同请求使用。", 409);
    return { projectCode, duplicate: true, acknowledgedVersion: Number(existingReceipt.resulting_version), activity: (await loadProjectActivities(String(row.project_id))).find(item => item.id === activityId) };
  }
  if (Number(row.version) !== input.expectedVersion) throw new FlowError("活动已被其他操作更新，请刷新后重试。", 409);

  let targetStatus: ActivityExecutionStatus;
  try { targetStatus = nextActivityStatus(String(row.status) as ActivityExecutionStatus, input.command); }
  catch { throw new FlowError(`不允许从${row.status}执行${input.command}。`, 409); }

  const update = input.command === "start"
    ? db.prepare("UPDATE activity_instances SET status=?,actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP),exception_reason=NULL,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(targetStatus, input.commandId, activityId, row.status, input.expectedVersion)
    : input.command === "block"
      ? db.prepare("UPDATE activity_instances SET status=?,exception_reason=?,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(targetStatus, input.reason, input.commandId, activityId, row.status, input.expectedVersion)
      : input.command === "resume"
        ? db.prepare("UPDATE activity_instances SET status=?,actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP),exception_reason=NULL,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(targetStatus, input.commandId, activityId, row.status, input.expectedVersion)
        : input.command === "complete"
          ? db.prepare("UPDATE activity_instances SET status=?,actual_end=CURRENT_TIMESTAMP,result=?,exception_reason=NULL,timeliness_status=CASE WHEN date(CURRENT_TIMESTAMP)>planned_end THEN 'completed_late' ELSE 'on_track' END,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(targetStatus, input.result, input.commandId, activityId, row.status, input.expectedVersion)
          : input.command === "cancel"
            ? db.prepare("UPDATE activity_instances SET status=?,actual_end=CURRENT_TIMESTAMP,result=?,exception_reason=?,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(targetStatus, `已取消：${input.reason}`, input.reason, input.commandId, activityId, row.status, input.expectedVersion)
            : db.prepare("UPDATE activity_instances SET last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(input.commandId, activityId, row.status, input.expectedVersion);

  const eventId = crypto.randomUUID();
  const nextVersion = input.expectedVersion + 1;
  const eventType = input.command === "add_evidence" ? DOMAIN_EVENTS.activityEvidenceAdded : DOMAIN_EVENTS.activityStatusChanged;
  const payload = JSON.stringify({ projectCode, activityId, definitionCode: row.definition_code, commandId: input.commandId, command: input.command, fromStatus: row.status, toStatus: targetStatus, expectedVersion: input.expectedVersion, version: nextVersion, reason: input.reason, result: input.result, evidenceRef: input.evidenceRef });
  const beforeState = JSON.stringify({ status: row.status, version: input.expectedVersion, result: row.result, exceptionReason: row.exception_reason });
  const afterState = JSON.stringify({ status: targetStatus, version: nextVersion, result: input.result ?? row.result, exceptionReason: input.command === "block" || input.command === "cancel" ? input.reason : null, commandId: input.commandId });
  const statements = [
    update,
    db.prepare("INSERT INTO activity_command_receipts (command_id,activity_instance_id,actor_user_id,command,request_fingerprint,expected_version,resulting_version,resulting_status) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(input.commandId, activityId, actor.id, input.command, fingerprint, input.expectedVersion, nextVersion, targetStatus, activityId, input.commandId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(eventId, "ActivityInstance", activityId, eventType, payload, actor.id, activityId, input.commandId),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), row.project_id, "活动", input.command === "add_evidence" ? "追加活动证据" : `活动命令：${input.command}`, beforeState, afterState, actor.id, activityId, input.commandId),
  ];
  if (input.command !== "add_evidence") statements.push(db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,command_id,domain_event_id,actor_user_id) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), activityId, row.status, targetStatus, input.reason, input.commandId, eventId, actor.id, activityId, input.commandId));
  if (input.evidenceRef) {
    const evidenceType = input.command === "block" ? "BLOCKER" : input.command === "resume" ? "RECOVERY" : input.command === "complete" ? "COMPLETION" : input.command === "cancel" ? "CANCELLATION" : input.command === "add_evidence" ? "SUPPLEMENT" : "PROGRESS";
    statements.push(db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,source_command_id,created_by) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), activityId, evidenceType, input.evidenceRef, input.commandId, actor.id, activityId, input.commandId));
  }
  const executeBatch = () => db.batch(statements);
  let results: Awaited<ReturnType<typeof executeBatch>>;
  try { results = await executeBatch(); }
  catch (error) {
    const receipt = await db.prepare("SELECT activity_instance_id,actor_user_id,request_fingerprint,resulting_version FROM activity_command_receipts WHERE command_id=?").bind(input.commandId).first<Record<string, string | number>>();
    if (receipt) {
      if (receipt.activity_instance_id !== activityId || receipt.actor_user_id !== actor.id || receipt.request_fingerprint !== fingerprint) throw new FlowError("同一命令幂等编号已被不同请求使用。", 409);
      return { projectCode, duplicate: true, acknowledgedVersion: Number(receipt.resulting_version), activity: (await loadProjectActivities(String(row.project_id))).find(item => item.id === activityId) };
    }
    throw error;
  }
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    const receipt = await db.prepare("SELECT activity_instance_id,actor_user_id,request_fingerprint,resulting_version FROM activity_command_receipts WHERE command_id=?").bind(input.commandId).first<Record<string, string | number>>();
    if (!receipt) throw new FlowError("活动已被其他操作更新，请刷新后重试。", 409);
    if (receipt.activity_instance_id !== activityId || receipt.actor_user_id !== actor.id || receipt.request_fingerprint !== fingerprint) throw new FlowError("同一命令幂等编号已被不同请求使用。", 409);
    return { projectCode, duplicate: true, acknowledgedVersion: Number(receipt.resulting_version), activity: (await loadProjectActivities(String(row.project_id))).find(item => item.id === activityId) };
  }
  const activity = (await loadProjectActivities(String(row.project_id))).find(item => item.id === activityId);
  return { projectCode, duplicate: false, activity };
}

export async function listProjectsFor(actor: DemoActor, includeAcceptanceData = false) {
  const db = getD1Binding();
  const conditions = actor.role === "manager" ? [] : ["p.owner_user_id = ?"];
  if (!includeAcceptanceData) conditions.push("p.name NOT LIKE 'G6验收%'", "p.name NOT LIKE 'UI验收%'", "p.name NOT LIKE '线索验收%'", "p.name NOT LIKE '批次二招标线索验收%'", "p.name NOT LIKE 'TST-%'", "p.name NOT LIKE 'EPC验收%'");
  const condition = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const statement = db.prepare(`SELECT p.*, i.scenario_code, i.intent_type, i.source_snapshot, g.id AS gate_id, g.gate_code, g.status AS gate_status, g.execution_status AS gate_execution_status, g.completed_at AS gate_completed_at, g.decision_comment AS gate_comment, g.version AS gate_version, g.definition_version AS gate_definition_version, s.input_snapshot AS gate_input_snapshot
    FROM sales_projects p
    JOIN procurement_intents i ON i.id=p.procurement_intent_id
    LEFT JOIN stage_gate_instances g ON g.project_id=p.id AND g.gate_code=CASE WHEN p.stage='S0' THEN 'G1' WHEN p.stage='S1' THEN 'G2' WHEN p.stage='S2' THEN 'G3' WHEN p.stage='S3' THEN 'G4' WHEN p.stage='S4' THEN 'G5' WHEN p.stage='S5' THEN 'G6' WHEN p.stage='S6' THEN 'G7' ELSE '' END
    LEFT JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=(SELECT MAX(s2.submission_version) FROM gate_submission_snapshots s2 WHERE s2.gate_instance_id=g.id)
    ${condition}
    ORDER BY p.created_at DESC`);
  const result = actor.role === "manager" ? await statement.all<Record<string, unknown>>() : await statement.bind(actor.id).all<Record<string, unknown>>();
  return Promise.all(result.results.map(async row => {
    const projectId = String(row.id);
    const facts = await loadS1SourceFacts(projectId);
    const s2Facts = await loadS2SourceFacts(projectId);
    const s3Facts = await loadS3SourceFacts(projectId);
    const g5Readiness = await buildG5Readiness(projectId);
    const g5RiskAcceptances = await getD1Binding().prepare("SELECT a.*,r.title,r.status AS current_risk_status,r.version AS current_risk_version FROM gate_risk_acceptances a JOIN project_risks r ON r.id=a.risk_id WHERE r.project_id=? ORDER BY a.created_at").bind(projectId).all<Record<string, unknown>>();
    g5Readiness.riskAcceptances = g5RiskAcceptances.results;
    const g5DeviationAuthorizations = await getD1Binding().prepare("SELECT a.*,u.display_name AS authorized_by_name FROM g5_deviation_authorizations a JOIN users u ON u.id=a.authorized_by WHERE a.project_id=? ORDER BY a.gate_version,a.created_at").bind(projectId).all<Record<string, unknown>>();
    g5Readiness.deviationAuthorizations = g5DeviationAuthorizations.results;
    const commercialSubmission = await getD1Binding().prepare("SELECT * FROM commercial_submissions WHERE project_id=? ORDER BY created_at DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const priceAuthorizationRequest = await getD1Binding().prepare("SELECT * FROM price_authorization_requests WHERE project_id=? ORDER BY gate_version DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const g5ReopenRequest = await getD1Binding().prepare("SELECT * FROM g5_reopen_requests WHERE project_id=? ORDER BY created_at DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const g6Readiness = await buildG6Readiness(projectId);
    const awardBaseline = await getD1Binding().prepare("SELECT b.*,u.display_name AS approved_by_name FROM commercial_award_baselines b LEFT JOIN users u ON u.id=b.approved_by WHERE b.project_id=? ORDER BY b.created_at DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const handoverReceipt = await getD1Binding().prepare("SELECT * FROM contract_handover_receipts WHERE project_id=? ORDER BY created_at DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const externalTasks = await loadExternalTasks(projectId);
    const activities = await loadProjectActivities(projectId);
    const milestones = await getD1Binding().prepare("SELECT * FROM project_milestones WHERE project_id=? ORDER BY planned_at,created_at").bind(projectId).all<Record<string, unknown>>();
    const resourceRequests = await getD1Binding().prepare("SELECT * FROM resource_requests WHERE project_id=? ORDER BY created_at DESC").bind(projectId).all<Record<string, unknown>>();
    const resourceCandidates = await getD1Binding().prepare("SELECT * FROM resource_candidates WHERE project_id=? ORDER BY role_name,CASE status WHEN 'selected' THEN 0 WHEN 'candidate' THEN 1 ELSE 2 END,created_at").bind(projectId).all<Record<string, unknown>>();
    const projectRisks = await getD1Binding().prepare("SELECT * FROM project_risks WHERE project_id=? ORDER BY CASE level WHEN '重大' THEN 4 WHEN '高' THEN 3 WHEN '中' THEN 2 ELSE 1 END DESC, due_date, created_at").bind(projectId).all<Record<string, unknown>>();
    const competitorFacts = await getD1Binding().prepare("SELECT * FROM project_competitor_facts WHERE project_id=? ORDER BY observed_at DESC,created_at DESC").bind(projectId).all<Record<string, unknown>>();
    const opportunityFingerprint = await getD1Binding().prepare("SELECT * FROM opportunity_fingerprints WHERE project_id=?").bind(projectId).first<Record<string, unknown>>();
    const procurementRequests = await getD1Binding().prepare("SELECT r.*,sp.display_name AS source_party_name,sp.master_status AS source_party_status,fp.display_name AS final_customer_name,fp.master_status AS final_customer_status FROM procurement_requests r JOIN parties sp ON sp.id=r.source_party_id JOIN parties fp ON fp.id=r.final_customer_party_id WHERE r.project_id=? AND r.status='effective' ORDER BY r.created_at").bind(projectId).all<Record<string, unknown>>();
    const partyRoles = await getD1Binding().prepare("SELECT pr.*,p.display_name,p.party_kind,p.master_status,p.source_system,p.source_ref FROM sales_project_party_roles pr JOIN parties p ON p.id=pr.party_id WHERE pr.project_id=? AND pr.status='active' ORDER BY pr.created_at").bind(projectId).all<Record<string, unknown>>();
    const partnerNeedDecision = await getD1Binding().prepare("SELECT * FROM partner_need_decisions WHERE project_id=?").bind(projectId).first<Record<string, unknown>>();
    const partnerRecords = await getD1Binding().prepare("SELECT e.*,c.id AS contribution_id,c.contribution_type,c.result AS contribution_result,c.evidence_ref AS contribution_evidence_ref,c.occurred_at AS contribution_occurred_at FROM partner_engagements e LEFT JOIN partner_contributions c ON c.partner_engagement_id=e.id WHERE e.project_id=? ORDER BY e.created_at,c.occurred_at").bind(projectId).all<Record<string, unknown>>();
    const downstreamEvents = await getD1Binding().prepare("SELECT * FROM downstream_business_events WHERE project_id=? ORDER BY occurred_at,created_at").bind(projectId).all<Record<string, unknown>>();
    const sourceLinks = await getD1Binding().prepare("SELECT * FROM project_source_links WHERE project_id=? ORDER BY imported_at,created_at").bind(projectId).all<Record<string, unknown>>();
    const leadRequirementSnapshot = await getD1Binding().prepare("SELECT * FROM lead_requirement_snapshots WHERE project_id=? ORDER BY snapshot_version DESC LIMIT 1").bind(projectId).first<Record<string, unknown>>();
    const bidRounds = await getD1Binding().prepare("SELECT * FROM bid_rounds WHERE project_id=? ORDER BY round_no").bind(projectId).all<Record<string, unknown>>();
    const bidPreparationVersions = await getD1Binding().prepare("SELECT * FROM bid_preparation_versions WHERE project_id=? ORDER BY version DESC").bind(projectId).all<Record<string, unknown>>();
    const commercialSolutionVersions = await getD1Binding().prepare("SELECT * FROM commercial_solution_versions WHERE project_id=? ORDER BY version DESC").bind(projectId).all<Record<string, unknown>>();
    const artifactBaselineItems = await getD1Binding().prepare("SELECT * FROM artifact_baseline_items WHERE project_id=? AND status='effective' ORDER BY field_code,artifact_kind").bind(projectId).all<Record<string, unknown>>();
    return {
      ...row,
      strategy_source_record: facts.strategy,
      relationship_source_records: facts.relationships,
      role_assignment_records: facts.assignments,
      solution_preparation_record: facts.preparation,
      g2_readiness_snapshot: readinessFromFacts(facts),
      requirement_clarification_package_record: s2Facts.clarificationPackage,
      requirement_version_record: s2Facts.requirement,
      technical_solution_version_record: s2Facts.solution,
      technical_clarification_records: s2Facts.clarifications,
      technical_deviation_records: s2Facts.deviations,
      s2_readiness_snapshot: s2ReadinessFromFacts(s2Facts),
      quotation_design_bom_record: s3Facts.bom,
      pricing_snapshot_record: s3Facts.pricing,
      costing_solution_version_record: s3Facts.costing,
      s3_readiness_snapshot: s3ReadinessFromFacts(s2Facts.solution, s3Facts),
      g5_readiness_snapshot: g5Readiness,
      commercial_submission_record: commercialSubmission ?? null,
      price_authorization_request_record: priceAuthorizationRequest ?? null,
      g5_reopen_request_record: g5ReopenRequest ?? null,
      g6_readiness_snapshot: g6Readiness,
      commercial_award_baseline_record: awardBaseline ?? null,
      contract_handover_receipt_record: handoverReceipt ?? null,
      external_task_records: externalTasks,
      activity_records: activities,
      milestone_records: milestones.results,
      resource_request_records: resourceRequests.results,
      resource_candidate_records: resourceCandidates.results,
      project_risk_records: projectRisks.results,
      competitor_fact_records: competitorFacts.results,
      opportunity_fingerprint_record: opportunityFingerprint ?? null,
      procurement_request_records: procurementRequests.results,
      party_role_records: partyRoles.results,
      partner_need_decision_record: partnerNeedDecision ?? null,
      partner_records: partnerRecords.results,
      downstream_business_event_records: downstreamEvents.results,
      project_source_link_records: sourceLinks.results,
      lead_requirement_snapshot_record: leadRequirementSnapshot ?? null,
      bid_round_records: bidRounds.results,
      bid_preparation_version_records: bidPreparationVersions.results,
      commercial_solution_version_records: commercialSolutionVersions.results,
      artifact_baseline_item_records: artifactBaselineItems.results,
    };
  }));
}

export function parseG2Input(raw: unknown): G2PreparationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("G2双轨输入格式不正确。");
  const data = raw as Record<string, unknown>;
  return Object.fromEntries(G2_INPUTS.map(item => [item.key, requiredText(data[item.key], item.label, 1000)])) as G2PreparationInput;
}

type StrategyFactInput = {
  objective: string;
  valueProposition: string;
  winPath: string;
  winThemes: string[];
  nonBidConsequence: string;
};
type RelationshipFactInput = { layer: "客户高层" | "商务决策链" | "技术层"; name: string; title: string; attitude: "支持" | "中立" | "反对"; influence: "高" | "中" | "低"; owner: string; evidence: string; lastTouch: string };
type CompetitorFactInput = { name: string; role: "主要对手" | "低价挑战者" | "在位供应商" | "替代方案"; relationship: number; technical: number; price: number; delivery: number; service: number; confidence: "高" | "中" | "低"; evidence: string; observedAt: string };
type RoleAssignmentInput = { candidateId: string; roleName: string; assigneeName: string; status: "缺失" | "待接受" | "已到位"; required: boolean; evidenceRef: string };
type ResourceRequestInput = { roleName: string; requirement: string; requiredBy: string; evidenceRef: string };
type ResourceCandidateInput = { roleName: string; candidateName: string; sourceSystem: string; sourceRef: string; capabilities: string[]; loadPercent?: number; activeProjectCount?: number; availableFrom?: string; evidenceRef: string };
const MANAGEABLE_PROJECT_ROLES = ["技术负责人", "高层伙伴", "渠道经理", "服务协调"] as const;
type PartnerNeedInput = { decision: "needed" | "not_needed"; reason: string; evidenceRef: string };
type PartnerEngagementInput = { partnerName: string; partnerType: string; verificationEvidenceRef: string };
type PartnerVerificationInput = { engagementId: string; decision: "verified" | "rejected"; comment: string; evidenceRef: string };
type PartnerContributionInput = { engagementId: string; contributionType: string; result: string; evidenceRef: string; occurredAt: string };
type CreateProjectRiskInput = { category: string; title: string; level: "低" | "中" | "高" | "重大"; description: string; impact: string; ownerName: string; dueDate: string; evidenceRef: string };
type ProjectRiskCommandInput = { riskId: string; command: "start" | "close"; expectedVersion: number; reason: string; evidenceRef: string; resolution?: string; activityId?: string };

export function parseStrategyFact(raw: unknown): StrategyFactInput {
  if (!raw || typeof raw !== "object") throw new FlowError("策略来源记录格式不正确。");
  const data = raw as Record<string, unknown>;
  const allowedThemes = ["技术匹配", "交付可信", "服务能力", "客户关系", "价格竞争力", "属地伙伴"];
  const winThemes = Array.isArray(data.winThemes) ? [...new Set(data.winThemes.map(String))].filter(item => allowedThemes.includes(item)) : [];
  if (winThemes.length === 0) throw new FlowError("至少选择一项主要赢单主题。");
  return {
    objective: requiredText(data.objective, "赢单目标", 300),
    valueProposition: requiredText(data.valueProposition, "价值主张", 1000),
    winPath: requiredText(data.winPath, "关键赢单路径", 1000),
    winThemes,
    nonBidConsequence: requiredText(data.nonBidConsequence, "不投/不报影响", 200),
  };
}

export function parsePartnerNeed(raw: unknown): PartnerNeedInput {
  if (!raw || typeof raw !== "object") throw new FlowError("伙伴需要性判断格式不正确。");
  const data = raw as Record<string, unknown>;
  const decision = String(data.decision);
  if (decision !== "needed" && decision !== "not_needed") throw new FlowError("伙伴需要性判断不合法。");
  return { decision, reason: requiredText(data.reason, "伙伴需要性判断原因", 1000), evidenceRef: requiredText(data.evidenceRef, "伙伴需要性证据", 1000) };
}

export function parsePartnerEngagement(raw: unknown): PartnerEngagementInput {
  if (!raw || typeof raw !== "object") throw new FlowError("伙伴登记格式不正确。");
  const data = raw as Record<string, unknown>;
  return { partnerName: requiredText(data.partnerName, "伙伴名称", 160), partnerType: requiredText(data.partnerType, "伙伴类型", 160), verificationEvidenceRef: requiredText(data.verificationEvidenceRef, "伙伴关系验证证据", 1000) };
}

export function parsePartnerVerification(raw: unknown): PartnerVerificationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("伙伴验证格式不正确。");
  const data = raw as Record<string, unknown>;
  const decision = String(data.decision);
  if (decision !== "verified" && decision !== "rejected") throw new FlowError("伙伴验证结论不合法。");
  return { engagementId: requiredText(data.engagementId, "伙伴协同编号", 120), decision, comment: requiredText(data.comment, "伙伴验证意见", 1000), evidenceRef: requiredText(data.evidenceRef, "伙伴验证证据", 1000) };
}

export function parsePartnerContribution(raw: unknown): PartnerContributionInput {
  if (!raw || typeof raw !== "object") throw new FlowError("伙伴贡献记录格式不正确。");
  const data = raw as Record<string, unknown>;
  const occurredAt = requiredText(data.occurredAt, "贡献发生时间", 40);
  if (Number.isNaN(Date.parse(occurredAt))) throw new FlowError("伙伴贡献发生时间格式不合法。");
  return { engagementId: requiredText(data.engagementId, "伙伴协同编号", 120), contributionType: requiredText(data.contributionType, "贡献类型", 160), result: requiredText(data.result, "实际贡献结果", 2000), evidenceRef: requiredText(data.evidenceRef, "贡献证据", 1000), occurredAt };
}

export function parseRelationshipFact(raw: unknown): RelationshipFactInput {
  if (!raw || typeof raw !== "object") throw new FlowError("客户关系记录格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!["客户高层", "商务决策链", "技术层"].includes(String(data.layer))) throw new FlowError("关系层级不合法。");
  if (!["支持", "中立", "反对"].includes(String(data.attitude))) throw new FlowError("客户态度不合法。");
  if (!["高", "中", "低"].includes(String(data.influence))) throw new FlowError("影响力不合法。");
  const lastTouch = requiredText(data.lastTouch, "最近Touch日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastTouch)) throw new FlowError("最近Touch日期格式必须为 YYYY-MM-DD。");
  return { layer: String(data.layer) as RelationshipFactInput["layer"], name: requiredText(data.name, "客户人员", 120), title: requiredText(data.title, "客户角色", 120), attitude: String(data.attitude) as RelationshipFactInput["attitude"], influence: String(data.influence) as RelationshipFactInput["influence"], owner: requiredText(data.owner, "覆盖负责人", 120), evidence: requiredText(data.evidence, "关系证据", 1000), lastTouch };
}

export function parseCompetitorFact(raw: unknown): CompetitorFactInput {
  if (!raw || typeof raw !== "object") throw new FlowError("竞争事实格式不正确。");
  const data = raw as Record<string, unknown>;
  const role = String(data.role);
  const confidence = String(data.confidence);
  if (!["主要对手", "低价挑战者", "在位供应商", "替代方案"].includes(role)) throw new FlowError("竞争方角色不合法。");
  if (!["高", "中", "低"].includes(confidence)) throw new FlowError("竞争事实可信度不合法。");
  const score = (key: string, label: string) => { const value = Number(data[key]); if (!Number.isInteger(value) || value < 0 || value > 100) throw new FlowError(`${label}评分必须为0到100的整数。`); return value; };
  const observedAt = requiredText(data.observedAt, "事实日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) throw new FlowError("事实日期格式必须为 YYYY-MM-DD。");
  return { name: requiredText(data.name, "竞争公司", 160), role: role as CompetitorFactInput["role"], relationship: score("relationship", "客户关系"), technical: score("technical", "技术匹配"), price: score("price", "价格竞争力"), delivery: score("delivery", "交付可信度"), service: score("service", "服务与业绩"), confidence: confidence as CompetitorFactInput["confidence"], evidence: requiredText(data.evidence, "竞争事实证据", 1000), observedAt };
}

export function parseRoleAssignment(raw: unknown): RoleAssignmentInput {
  if (!raw || typeof raw !== "object") throw new FlowError("角色指派记录格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!["缺失", "待接受", "已到位"].includes(String(data.status))) throw new FlowError("资源状态不合法。");
  if (!MANAGEABLE_PROJECT_ROLES.includes(String(data.roleName) as typeof MANAGEABLE_PROJECT_ROLES[number])) throw new FlowError("该角色不由销售项目主管直接配置；专业角色应由权威作业系统回传。", 409);
  return { candidateId: requiredText(data.candidateId, "候选记录", 120), roleName: requiredText(data.roleName, "项目角色", 120), assigneeName: requiredText(data.assigneeName, "候选人", 120), status: String(data.status) as RoleAssignmentInput["status"], required: data.required !== false, evidenceRef: requiredText(data.evidenceRef, "资源依据", 500) };
}

export function parseResourceCandidate(raw: unknown): ResourceCandidateInput {
  if (!raw || typeof raw !== "object") throw new FlowError("资源候选记录格式不正确。");
  const data = raw as Record<string, unknown>;
  const roleName = requiredText(data.roleName, "项目角色", 120);
  if (!MANAGEABLE_PROJECT_ROLES.includes(roleName as typeof MANAGEABLE_PROJECT_ROLES[number])) throw new FlowError("该角色不由销售项目主管维护候选；专业角色应由权威作业系统回传。", 409);
  const capabilities = Array.isArray(data.capabilities) ? data.capabilities.map(value => String(value).trim()).filter(Boolean) : String(data.capabilities ?? "").split(/[，,;；]/).map(value => value.trim()).filter(Boolean);
  if (!capabilities.length) throw new FlowError("至少填写一项候选能力依据。");
  const optionalNonnegativeInteger = (value: unknown, label: string, max: number) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new FlowError(`${label}不合法。`);
    return parsed;
  };
  const availableFrom = String(data.availableFrom ?? "").trim();
  if (availableFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(availableFrom) || Number.isNaN(Date.parse(`${availableFrom}T00:00:00Z`)))) throw new FlowError("可投入日期格式必须为 YYYY-MM-DD。");
  return {
    roleName,
    candidateName: requiredText(data.candidateName, "候选人", 120),
    sourceSystem: requiredText(data.sourceSystem, "候选来源系统", 160),
    sourceRef: requiredText(data.sourceRef, "候选来源记录", 300),
    capabilities,
    loadPercent: optionalNonnegativeInteger(data.loadPercent, "人员负荷", 100),
    activeProjectCount: optionalNonnegativeInteger(data.activeProjectCount, "在管项目数", 999),
    availableFrom: availableFrom || undefined,
    evidenceRef: requiredText(data.evidenceRef, "候选依据", 1000),
  };
}

export function parseResourceRequest(raw: unknown): ResourceRequestInput {
  if (!raw || typeof raw !== "object") throw new FlowError("资源申请格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!MANAGEABLE_PROJECT_ROLES.includes(String(data.roleName) as typeof MANAGEABLE_PROJECT_ROLES[number])) throw new FlowError("该角色不通过销售项目资源申请配置；专业角色由权威作业系统派发。", 409);
  const requiredBy = requiredText(data.requiredBy, "要求到位日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requiredBy) || Number.isNaN(Date.parse(`${requiredBy}T00:00:00Z`))) throw new FlowError("要求到位日期格式必须为 YYYY-MM-DD。");
  return { roleName: requiredText(data.roleName, "所需项目角色", 120), requirement: requiredText(data.requirement, "能力与投入要求", 1000), requiredBy, evidenceRef: requiredText(data.evidenceRef, "资源申请依据", 1000) };
}

export function parseCreateProjectRisk(raw: unknown): CreateProjectRiskInput {
  if (!raw || typeof raw !== "object") throw new FlowError("风险记录格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!["低", "中", "高", "重大"].includes(String(data.level))) throw new FlowError("风险等级不合法。");
  const dueDate = requiredText(data.dueDate, "处置期限", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) throw new FlowError("处置期限格式必须为 YYYY-MM-DD。");
  return { category: requiredText(data.category, "风险类别", 120), title: requiredText(data.title, "风险标题", 300), level: String(data.level) as CreateProjectRiskInput["level"], description: requiredText(data.description, "风险事实", 2000), impact: requiredText(data.impact, "可能影响", 2000), ownerName: requiredText(data.ownerName, "风险Owner", 120), dueDate, evidenceRef: requiredText(data.evidenceRef, "风险证据", 1000) };
}

export function parseProjectRiskCommand(raw: unknown): ProjectRiskCommandInput {
  if (!raw || typeof raw !== "object") throw new FlowError("风险操作格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!["start", "close"].includes(String(data.command))) throw new FlowError("风险操作不合法。");
  const expectedVersion = Number(data.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new FlowError("风险版本号必须是正整数。");
  const resolution = typeof data.resolution === "string" && data.resolution.trim() ? requiredText(data.resolution, "处置结论", 2000) : undefined;
  if (data.command === "close" && !resolution) throw new FlowError("关闭风险必须填写可验证的处置结论。");
  const activityId = typeof data.activityId === "string" && data.activityId.trim() ? requiredText(data.activityId, "处置行动编号", 120) : undefined;
  if (data.command === "start" && !activityId) throw new FlowError("开始处置风险必须关联一个已持久化项目行动。");
  return { riskId: requiredText(data.riskId, "风险编号", 120), command: String(data.command) as ProjectRiskCommandInput["command"], expectedVersion, reason: requiredText(data.reason, "操作原因", 1000), evidenceRef: requiredText(data.evidenceRef, "操作证据", 1000), resolution, activityId };
}

export function parseSolutionPreparation(raw: unknown): SolutionPreparationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("方案准备回传格式不正确。");
  const data = raw as Record<string, unknown>;
  return { requirementGaps: requiredText(data.requirementGaps, "需求缺失", 1000), technicalDifficulty: requiredText(data.technicalDifficulty, "技术难度", 1000), solutionResourceNeeds: requiredText(data.solutionResourceNeeds, "方案资源需求", 1000), evidenceRef: requiredText(data.evidenceRef, "作业证据", 500) };
}

export function parseBidPreparation(raw: unknown): BidPreparationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("投标准备回传格式不正确。");
  const data = raw as Record<string, unknown>;
  const sourceType = String(data.sourceType);
  if (!["TenderRequest", "EPCInquiry", "DirectRFQ"].includes(sourceType)) throw new FlowError("采购请求类型不合法。");
  if (!Array.isArray(data.workPlan) || data.workPlan.length === 0) throw new FlowError("投标工作计划至少包含一项任务、责任角色和日期。");
  const workPlan = data.workPlan.slice(0, 50).map((item, index) => {
    if (!item || typeof item !== "object") throw new FlowError(`工作计划第${index + 1}项格式不正确。`);
    const row = item as Record<string, unknown>;
    const dueDate = requiredText(row.dueDate, `工作计划第${index + 1}项截止日期`, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) throw new FlowError(`工作计划第${index + 1}项截止日期不合法。`);
    return { task: requiredText(row.task, `工作计划第${index + 1}项任务`, 500), ownerRole: requiredText(row.ownerRole, `工作计划第${index + 1}项责任角色`, 120), dueDate };
  });
  return {
    sourceType: sourceType as BidPreparationInput["sourceType"],
    sourceRef: requiredText(data.sourceRef, "采购请求/招标文件引用", 1000),
    sourceVersion: requiredText(data.sourceVersion, "来源版本", 120),
    sourceHash: requiredText(data.sourceHash, "来源哈希或不可变标识", 500),
    technicalRequirements: requiredText(data.technicalRequirements, "技术要求摘要", 5000),
    commercialRequirements: requiredText(data.commercialRequirements, "商务要求摘要", 5000),
    evaluationCriteria: requiredText(data.evaluationCriteria, "评审/评标标准", 3000),
    qualificationRequirements: requiredText(data.qualificationRequirements, "资质要求", 3000),
    identifiedRisks: requiredText(data.identifiedRisks, "投标准备风险", 3000),
    bidStrategy: requiredText(data.bidStrategy, "投标策略", 5000),
    workPlan,
    evidenceRef: requiredText(data.evidenceRef, "投标准备证据", 1000),
  };
}

export function parseCommercialSolution(raw: unknown): CommercialSolutionInput {
  if (!raw || typeof raw !== "object") throw new FlowError("商务方案回传格式不正确。");
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.commercialDeviations) || data.commercialDeviations.length === 0) throw new FlowError("必须逐条记录商务偏差；无偏差也要形成显性结论。");
  const commercialDeviations = data.commercialDeviations.slice(0, 100).map((item, index) => {
    if (!item || typeof item !== "object") throw new FlowError(`商务偏差第${index + 1}项格式不正确。`);
    const row = item as Record<string, unknown>;
    const riskLevel = String(row.riskLevel);
    if (!["low", "medium", "high"].includes(riskLevel)) throw new FlowError(`商务偏差第${index + 1}项风险等级不合法。`);
    return { clause: requiredText(row.clause, `商务偏差第${index + 1}项条款`, 1000), response: requiredText(row.response, `商务偏差第${index + 1}项响应`, 2000), riskLevel: riskLevel as "low" | "medium" | "high", mitigation: requiredText(row.mitigation, `商务偏差第${index + 1}项措施`, 2000) };
  });
  return {
    bidPreparationVersionId: requiredText(data.bidPreparationVersionId, "投标准备版本", 120),
    paymentTerms: requiredText(data.paymentTerms, "付款条款响应", 3000),
    deliveryTerms: requiredText(data.deliveryTerms, "交付条款响应", 3000),
    guaranteeTerms: requiredText(data.guaranteeTerms, "保证金/质保条款响应", 3000),
    breachLiability: requiredText(data.breachLiability, "违约责任响应", 3000),
    pricingStrategy: requiredText(data.pricingStrategy, "报价策略", 3000),
    quotationListRef: requiredText(data.quotationListRef, "报价清单引用", 1000),
    commercialDeviations,
    riskAssessment: requiredText(data.riskAssessment, "商务风险评估", 3000),
    mitigationPlan: requiredText(data.mitigationPlan, "商务风险应对方案", 3000),
    evidenceRef: requiredText(data.evidenceRef, "商务方案证据", 1000),
  };
}

export function parseRequirementSource(raw: unknown): RequirementSourceInput {
  if (!raw || typeof raw !== "object") throw new FlowError("客户需求来源格式不正确。");
  const data = raw as Record<string, unknown>;
  return { originalText: requiredText(data.originalText, "客户需求原文", 5000), sourceRef: requiredText(data.sourceRef, "来源定位与证据", 1000) };
}

export function parseTechnicalAssessment(raw: unknown): TechnicalAssessmentInput {
  if (!raw || typeof raw !== "object") throw new FlowError("技术评估格式不正确。");
  const data = raw as Record<string, unknown>;
  const criticalParameterStatus = String(data.criticalParameterStatus);
  const clarificationStatus = String(data.clarificationStatus);
  const deviationStatus = String(data.deviationStatus);
  const bomConfirmationStatus = String(data.bomConfirmationStatus);
  if (!["完整", "存在缺失"].includes(criticalParameterStatus)) throw new FlowError("关键参数完整性状态不合法。");
  if (!["open", "resolved"].includes(clarificationStatus)) throw new FlowError("澄清状态不合法。");
  if (!["none", "recorded"].includes(deviationStatus)) throw new FlowError("偏差结论不合法。");
  if (!["confirmed", "unconfirmed"].includes(bomConfirmationStatus)) throw new FlowError("报价设计BOM确认状态不合法。");
  return {
    standardizedRequirement: requiredText(data.standardizedRequirement, "标准化需求", 5000),
    designAdoptedValue: requiredText(data.designAdoptedValue, "设计采用值", 5000),
    criticalParameterStatus: criticalParameterStatus as TechnicalAssessmentInput["criticalParameterStatus"],
    initialTechnicalSolution: requiredText(data.initialTechnicalSolution, "初步技术方案", 5000),
    solutionEvidenceRef: requiredText(data.solutionEvidenceRef, "技术方案证据", 1000),
    clarificationQuestion: requiredText(data.clarificationQuestion, "澄清问题或无澄清结论", 2000),
    clarificationResponse: requiredText(data.clarificationResponse, "澄清答复或无澄清依据", 2000),
    clarificationStatus: clarificationStatus as TechnicalAssessmentInput["clarificationStatus"],
    clarificationOwnerRole: requiredText(data.clarificationOwnerRole, "澄清责任角色", 200),
    clarificationClosureEvidenceRef: requiredText(data.clarificationClosureEvidenceRef, "澄清关闭证据", 1000),
    deviationDescription: requiredText(data.deviationDescription, "偏差描述或无偏差结论", 2000),
    deviationStatus: deviationStatus as TechnicalAssessmentInput["deviationStatus"],
    deviationEvidenceRef: requiredText(data.deviationEvidenceRef, "偏差证据或核对依据", 1000),
    deviationOwnerRole: requiredText(data.deviationOwnerRole, "偏差责任角色", 200),
    deviationDisposition: requiredText(data.deviationDisposition, "偏差处理结论", 2000),
    deviationClosureEvidenceRef: requiredText(data.deviationClosureEvidenceRef, "偏差关闭证据", 1000),
    configurationSummary: requiredText(data.configurationSummary, "报价设计BOM配置", 5000),
    bomConfirmationStatus: bomConfirmationStatus as TechnicalAssessmentInput["bomConfirmationStatus"],
    bomEvidenceRef: requiredText(data.bomEvidenceRef, "BOM确认依据", 1000),
  };
}

export function parseRequirementBaseline(raw: unknown): Pick<TechnicalAssessmentInput, "standardizedRequirement"> & { sourceRef: string } {
  if (!raw || typeof raw !== "object") throw new FlowError("正式需求基线格式不正确。");
  const data = raw as Record<string, unknown>;
  return { standardizedRequirement: requiredText(data.standardizedRequirement, "标准化需求", 5000), sourceRef: requiredText(data.sourceRef, "需求基线证据", 1000) };
}

export function parseTechnicalSolution(raw: unknown): Pick<TechnicalAssessmentInput, "designAdoptedValue" | "criticalParameterStatus" | "initialTechnicalSolution" | "solutionEvidenceRef"> {
  if (!raw || typeof raw !== "object") throw new FlowError("技术方案格式不正确。");
  const data = raw as Record<string, unknown>;
  const criticalParameterStatus = String(data.criticalParameterStatus);
  if (!["完整", "存在缺失"].includes(criticalParameterStatus)) throw new FlowError("关键参数完整性状态不合法。");
  return { designAdoptedValue: requiredText(data.designAdoptedValue, "设计采用值", 5000), criticalParameterStatus: criticalParameterStatus as TechnicalAssessmentInput["criticalParameterStatus"], initialTechnicalSolution: requiredText(data.initialTechnicalSolution, "初步技术方案", 5000), solutionEvidenceRef: requiredText(data.solutionEvidenceRef, "技术方案证据", 1000) };
}

export function parseBomAndClosure(raw: unknown): Pick<TechnicalAssessmentInput, "clarificationQuestion" | "clarificationResponse" | "clarificationStatus" | "clarificationOwnerRole" | "clarificationClosureEvidenceRef" | "deviationDescription" | "deviationStatus" | "deviationEvidenceRef" | "deviationOwnerRole" | "deviationDisposition" | "deviationClosureEvidenceRef" | "configurationSummary" | "bomConfirmationStatus" | "bomEvidenceRef"> {
  if (!raw || typeof raw !== "object") throw new FlowError("BOM与澄清偏差闭环格式不正确。");
  const data = raw as Record<string, unknown>;
  const clarificationStatus = String(data.clarificationStatus);
  const deviationStatus = String(data.deviationStatus);
  const bomConfirmationStatus = String(data.bomConfirmationStatus);
  if (!["open", "resolved"].includes(clarificationStatus)) throw new FlowError("澄清状态不合法。");
  if (!["none", "recorded"].includes(deviationStatus)) throw new FlowError("偏差结论不合法。");
  if (!["confirmed", "unconfirmed"].includes(bomConfirmationStatus)) throw new FlowError("报价设计BOM确认状态不合法。");
  return { clarificationQuestion: requiredText(data.clarificationQuestion, "澄清问题或无澄清结论", 2000), clarificationResponse: requiredText(data.clarificationResponse, "澄清答复或无澄清依据", 2000), clarificationStatus: clarificationStatus as TechnicalAssessmentInput["clarificationStatus"], clarificationOwnerRole: requiredText(data.clarificationOwnerRole, "澄清责任角色", 200), clarificationClosureEvidenceRef: requiredText(data.clarificationClosureEvidenceRef, "澄清关闭证据", 1000), deviationDescription: requiredText(data.deviationDescription, "偏差描述或无偏差结论", 2000), deviationStatus: deviationStatus as TechnicalAssessmentInput["deviationStatus"], deviationEvidenceRef: requiredText(data.deviationEvidenceRef, "偏差证据或核对依据", 1000), deviationOwnerRole: requiredText(data.deviationOwnerRole, "偏差责任角色", 200), deviationDisposition: requiredText(data.deviationDisposition, "偏差处理结论", 2000), deviationClosureEvidenceRef: requiredText(data.deviationClosureEvidenceRef, "偏差关闭证据", 1000), configurationSummary: requiredText(data.configurationSummary, "报价设计BOM配置", 5000), bomConfirmationStatus: bomConfirmationStatus as TechnicalAssessmentInput["bomConfirmationStatus"], bomEvidenceRef: requiredText(data.bomEvidenceRef, "BOM确认依据", 1000) };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; }
  catch { return {}; }
}

type S1SourceFacts = {
  strategy: Record<string, string | number | null> | null;
  relationships: Record<string, string | number | null>[];
  assignments: Record<string, string | number | null>[];
  preparation: Record<string, string | number | null> | null;
  bidPreparation: Record<string, string | number | null> | null;
  commercialSolution: Record<string, string | number | null> | null;
};

async function loadS1SourceFacts(projectId: string): Promise<S1SourceFacts> {
  const db = getD1Binding();
  const [strategy, relationships, assignments, preparation, bidPreparation, commercialSolution] = await Promise.all([
    db.prepare("SELECT * FROM project_strategy_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM customer_relationship_records WHERE project_id=? ORDER BY created_at").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM role_assignments WHERE project_id=? ORDER BY required DESC,role_name").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM solution_preparation_records WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM bid_preparation_versions WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM commercial_solution_versions WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
  ]);
  return { strategy: strategy ?? null, relationships: relationships.results, assignments: assignments.results, preparation: preparation ?? null, bidPreparation: bidPreparation ?? null, commercialSolution: commercialSolution ?? null };
}

function readinessFromFacts(facts: S1SourceFacts): G2ReadinessSnapshot {
  const relationships = facts.relationships;
  const requiredAssignments = facts.assignments.filter(item => item.role_name !== "销售Owner" && Number(item.required) === 1);
  const strategyPayload = jsonRecord(facts.strategy?.strategy_payload);
  const strategyCurrent = Boolean(facts.strategy && ["draft", "approved"].includes(String(facts.strategy.status)));
  const strategySummary = strategyCurrent ? `目标：${facts.strategy?.objective}｜价值主张：${strategyPayload.valueProposition ?? "待补"}｜竞争判断：${facts.strategy?.competitive_assessment}｜赢单路径：${strategyPayload.winPath ?? "待补"}` : facts.strategy ? "来源事实已变化，当前策略版本需要销售Owner复核后形成新版本" : "";
  const relationshipSummary = relationships.map(item => `${item.layer}：${item.person_name}（${item.title}，${item.attitude}，影响力${item.influence}）`).join("；");
  const customerEngagementSummary = relationships.filter(item => item.last_touch || item.evidence_ref).map(item => `${item.person_name}｜最近接触 ${item.last_touch || "日期待补"}｜证据 ${item.evidence_ref || "待补"}`).join("；");
  const resourcePlan = String(strategyPayload.resourcePlan ?? "");
  const resourceSummary = resourcePlan ? `投入计划：${resourcePlan}${requiredAssignments.length ? `｜责任接受：${requiredAssignments.map(item => `${item.role_name}：${item.assignee_name}（${item.status}）`).join("；")}` : "｜当前计划未要求新增专业角色"}` : "";
  const resourcesReady = Boolean(resourcePlan) && requiredAssignments.every(item => ["已接受", "已到位"].includes(String(item.status)));
  const requirementGaps = String(facts.preparation?.requirement_gaps ?? "");
  const technicalDifficulty = String(facts.preparation?.technical_difficulty ?? "");
  const solutionResourceNeeds = String(facts.preparation?.solution_resource_needs ?? "");
  const bidPreparationSummary = facts.bidPreparation ? `${facts.bidPreparation.source_type}｜${facts.bidPreparation.source_ref}@${facts.bidPreparation.source_version}｜策略：${facts.bidPreparation.bid_strategy}` : "";
  const commercialSolutionSummary = facts.commercialSolution ? `付款：${facts.commercialSolution.payment_terms}｜交付：${facts.commercialSolution.delivery_terms}｜偏差与风险已形成` : "尚未形成商务方案；不阻断G2，但必须在后续商务决策前完成";
  const initiationAssessmentSummary = facts.preparation ? `已知需求范围/缺口：${requirementGaps}｜技术难度：${technicalDifficulty}｜方案与资源需求：${solutionResourceNeeds}` : "";
  const items: G2ReadinessItem[] = [
    { key: "winStrategy", track: "销售项目管理轨", label: "当前赢单策略版本", summary: strategySummary, ready: strategyCurrent, hard: true, sourceType: "ProjectStrategyVersion", sourceRefs: facts.strategy ? [String(facts.strategy.id)] : [], sourceTab: "strategy", owner: "销售项目Owner" },
    { key: "relationshipCoverage", track: "销售项目管理轨", label: "客户决策链与关系覆盖", summary: relationshipSummary, ready: relationships.length > 0, hard: true, sourceType: "CustomerRelationshipRecord", sourceRefs: relationships.map(item => String(item.id)), sourceTab: "relations", owner: "销售项目Owner" },
    { key: "customerEngagement", track: "销售项目管理轨", label: "最近客户接触与覆盖缺口", summary: customerEngagementSummary || "尚未形成可追溯的最近客户接触；演示策略暂列管理缺口，不直接替代客户关系判断", ready: Boolean(customerEngagementSummary), hard: false, sourceType: "CustomerRelationshipRecord", sourceRefs: relationships.map(item => String(item.id)), sourceTab: "relations", owner: "销售项目Owner" },
    { key: "resourceInvestment", track: "销售项目管理轨", label: "本阶段资源投入与接受", summary: resourceSummary, ready: resourcesReady, hard: true, sourceType: "RoleAssignment", sourceRefs: [facts.strategy?.id, ...requiredAssignments.map(item => item.id)].filter(Boolean).map(String), sourceTab: "resources", owner: "销售Owner提出；主管/专业主管确认" },
    { key: "bidWorkInitiationPlan", track: "投标作业轨", label: "采购/投报作业启动计划", summary: bidPreparationSummary, ready: Boolean(facts.bidPreparation), hard: true, sourceType: "BidPreparationVersion", sourceRefs: facts.bidPreparation ? [String(facts.bidPreparation.id)] : [], sourceTab: "actions", owner: "投标专员" },
    { key: "initiationAssessment", track: "投标作业轨", label: "需求与方案启动评估", summary: initiationAssessmentSummary, ready: Boolean(facts.preparation && requirementGaps && technicalDifficulty && solutionResourceNeeds), hard: true, sourceType: "SolutionPreparationRecord", sourceRefs: facts.preparation ? [String(facts.preparation.id)] : [], sourceTab: "actions", owner: "投标作业负责人汇总；销售/技术/方案分别贡献" },
    { key: "commercialContext", track: "投标作业轨", label: "初版商务条款与偏差上下文", summary: commercialSolutionSummary, ready: Boolean(facts.commercialSolution), hard: false, sourceType: "CommercialSolutionVersion", sourceRefs: facts.commercialSolution ? [String(facts.commercialSolution.id)] : [], sourceTab: "actions", owner: "商务经理" },
  ];
  return { input: Object.fromEntries(items.map(item => [item.key, item.summary])) as G2PreparationInput, items, generatedAt: new Date().toISOString() };
}

export async function buildG2Readiness(projectId: string) {
  const readiness = readinessFromFacts(await loadS1SourceFacts(projectId));
  return { ...readiness, activitySnapshot: await buildGateActivitySnapshot(projectId, "G2") };
}

type S2SourceFacts = {
  clarificationPackage: Record<string, string | number | null> | null;
  requirement: Record<string, string | number | null> | null;
  solution: Record<string, string | number | null> | null;
  bom: Record<string, string | number | null> | null;
  clarifications: Record<string, string | number | null>[];
  deviations: Record<string, string | number | null>[];
};

async function loadS2SourceFacts(projectId: string): Promise<S2SourceFacts> {
  const db = getD1Binding();
  const [clarificationPackage, requirement, solution, bom] = await Promise.all([
    db.prepare("SELECT * FROM requirement_clarification_packages WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM customer_requirement_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM technical_solution_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM quotation_design_bom_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
  ]);
  if (!solution) return { clarificationPackage: clarificationPackage ?? null, requirement: requirement ?? null, solution: null, bom: null, clarifications: [], deviations: [] };
  const [clarifications, deviations] = await Promise.all([
    db.prepare("SELECT * FROM technical_clarification_items WHERE project_id=? AND solution_version_id=? ORDER BY created_at").bind(projectId, solution.id).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM technical_deviation_records WHERE project_id=? AND solution_version_id=? ORDER BY created_at").bind(projectId, solution.id).all<Record<string, string | number | null>>(),
  ]);
  return { clarificationPackage: clarificationPackage ?? null, requirement: requirement ?? null, solution, bom: bom ?? null, clarifications: clarifications.results, deviations: deviations.results };
}

function s2ReadinessFromFacts(facts: S2SourceFacts): S2ReadinessSnapshot {
  const clarificationPackageId = facts.clarificationPackage ? String(facts.clarificationPackage.id) : "";
  const requirementId = facts.requirement ? String(facts.requirement.id) : "";
  const requirementMatchesClarification = Boolean(requirementId && clarificationPackageId && facts.requirement?.clarification_package_id === clarificationPackageId);
  const solutionId = facts.solution ? String(facts.solution.id) : "";
  const solutionMatchesRequirement = Boolean(solutionId && facts.solution?.requirement_version_id === requirementId);
  const bomId = facts.bom ? String(facts.bom.id) : "";
  const bomMatchesSolution = Boolean(bomId && facts.bom?.technical_solution_version_id === solutionId);
  const openClarifications = facts.clarifications.filter(item => item.status !== "resolved");
  const unownedClarifications = facts.clarifications.filter(item => !String(item.owner_role ?? "").trim() || !String(item.closure_evidence_ref ?? "").trim() || !String(item.closed_by ?? "").trim());
  const incompleteDeviations = facts.deviations.filter(item => !String(item.owner_role ?? "").trim() || !String(item.disposition ?? "").trim() || !String(item.closure_evidence_ref ?? "").trim() || !String(item.closed_by ?? "").trim());
  const items: S2ReadinessItem[] = [
    { key: "requirementClarification", label: "客户需求澄清包与来源", summary: facts.clarificationPackage ? `${facts.clarificationPackage.original_text}｜${facts.clarificationPackage.source_ref}` : "尚未由销售Owner确认客户需求原文、来源和待澄清边界", ready: Boolean(clarificationPackageId), hard: true, sourceType: "RequirementClarificationPackage", sourceRefs: clarificationPackageId ? [clarificationPackageId] : [], sourceTab: "versions", owner: "销售项目Owner（协调客户确认，不编制技术结论）" },
    { key: "requirementSource", label: "正式客户需求基线", summary: facts.requirement ? `${requirementMatchesClarification ? "" : "未绑定当前需求澄清包｜"}${facts.requirement.original_text}｜${facts.requirement.source_ref}` : "尚未由专业作业形成正式需求基线", ready: requirementMatchesClarification, hard: true, sourceType: "CustomerRequirementVersion", sourceRefs: requirementId ? [requirementId] : [], sourceTab: "versions", owner: "投标/技术责任人（权威系统接口待替换）" },
    { key: "normalizedRequirement", label: "需求基线与设计采用值一致", summary: facts.solution ? `${solutionMatchesRequirement ? "" : "上游需求已变更，原技术版本失效｜"}${facts.solution.standardized_requirement} → ${facts.solution.design_adopted_value}` : "尚未收到技术方案", ready: solutionMatchesRequirement && Boolean(facts.solution?.standardized_requirement) && Boolean(facts.solution?.design_adopted_value), hard: true, sourceType: "TechnicalSolutionVersion", sourceRefs: solutionId ? [solutionId] : [], sourceTab: "versions", owner: "技术/方案负责人" },
    { key: "criticalParameters", label: "关键参数完整", summary: facts.solution ? `${solutionMatchesRequirement ? "" : "上游需求已变更，需重新确认｜原结论："}${String(facts.solution.critical_parameter_status)}` : "未检查", ready: solutionMatchesRequirement && facts.solution?.critical_parameter_status === "完整", hard: true, sourceType: "TechnicalSolutionVersion", sourceRefs: solutionId ? [solutionId] : [], sourceTab: "versions", owner: "技术负责人" },
    { key: "technicalSolution", label: "初步技术方案与证据", summary: facts.solution ? `${solutionMatchesRequirement ? "" : "上游需求已变更，原技术版本失效｜"}${facts.solution.initial_technical_solution}｜${facts.solution.evidence_ref}` : "尚未形成技术方案", ready: solutionMatchesRequirement && Boolean(facts.solution?.initial_technical_solution) && Boolean(facts.solution?.evidence_ref), hard: true, sourceType: "TechnicalSolutionVersion", sourceRefs: solutionId ? [solutionId] : [], sourceTab: "versions", owner: "技术负责人" },
    { key: "quotationDesignBom", label: "报价设计BOM已绑定当前方案", summary: facts.bom ? `${bomMatchesSolution ? "" : "BOM未绑定当前技术方案｜"}${facts.bom.configuration_summary}｜${facts.bom.confirmation_status === "confirmed" ? "已确认" : "未确认"}` : "尚未形成报价设计BOM", ready: solutionMatchesRequirement && bomMatchesSolution && facts.bom?.confirmation_status === "confirmed" && Boolean(facts.bom?.evidence_ref), hard: true, sourceType: "QuotationDesignBOM", sourceRefs: bomId ? [bomId] : [], sourceTab: "versions", owner: "方案/设计责任人" },
    { key: "clarifications", label: "澄清问题已由责任角色关闭并留证", summary: !solutionMatchesRequirement && solutionId ? "上游需求已变更，原澄清结论需要重新核对" : facts.clarifications.length ? openClarifications.length ? `${openClarifications.length}项未关闭` : unownedClarifications.length ? `${unownedClarifications.length}项缺少责任角色、关闭人或关闭证据` : `${facts.clarifications.length}项已按责任闭环` : "尚未记录澄清结论", ready: solutionMatchesRequirement && facts.clarifications.length > 0 && openClarifications.length === 0 && unownedClarifications.length === 0, hard: true, sourceType: "TechnicalClarificationItem", sourceRefs: facts.clarifications.map(item => String(item.id)), sourceTab: "versions", owner: "对应问题责任人；投标作业汇总" },
    { key: "deviations", label: "技术偏差已定责、处置并留证", summary: !solutionMatchesRequirement && solutionId ? "上游需求已变更，原偏差结论需要重新核对" : facts.deviations.length ? incompleteDeviations.length ? `${incompleteDeviations.length}项缺少责任角色、处置结论或关闭证据` : String(facts.deviations.at(-1)?.disposition ?? facts.deviations.at(-1)?.description ?? "已闭环") : "尚未记录有/无偏差结论", ready: solutionMatchesRequirement && facts.deviations.length > 0 && incompleteDeviations.length === 0, hard: true, sourceType: "TechnicalDeviationRecord", sourceRefs: facts.deviations.map(item => String(item.id)), sourceTab: "versions", owner: "对应专业责任人；投标作业汇总" },
  ];
  return { items, requirementClarificationPackage: facts.clarificationPackage ?? undefined, requirementVersion: facts.requirement ?? undefined, technicalSolutionVersion: facts.solution ?? undefined, quotationDesignBom: facts.bom ?? undefined, clarificationItems: facts.clarifications, deviationRecords: facts.deviations, generatedAt: new Date().toISOString() };
}

export async function buildS2Readiness(projectId: string) {
  const readiness = s2ReadinessFromFacts(await loadS2SourceFacts(projectId));
  return { ...readiness, activitySnapshot: await buildGateActivitySnapshot(projectId, "G3") };
}

type S3SourceFacts = {
  bom: Record<string, string | number | null> | null;
  pricing: Record<string, string | number | null> | null;
  costing: Record<string, string | number | null> | null;
};

async function loadS3SourceFacts(projectId: string): Promise<S3SourceFacts> {
  const db = getD1Binding();
  const [bom, pricing, costing] = await Promise.all([
    db.prepare("SELECT * FROM quotation_design_bom_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM pricing_snapshot_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM costing_solution_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
  ]);
  return { bom: bom ?? null, pricing: pricing ?? null, costing: costing ?? null };
}

function s3ReadinessFromFacts(technical: Record<string, string | number | null> | null, facts: S3SourceFacts): S3ReadinessSnapshot {
  const technicalId = technical ? String(technical.id) : "";
  const bomId = facts.bom ? String(facts.bom.id) : "";
  const pricingId = facts.pricing ? String(facts.pricing.id) : "";
  const costingId = facts.costing ? String(facts.costing.id) : "";
  const lineageValid = Boolean(technicalId && technical?.status === "approved" && facts.bom?.technical_solution_version_id === technicalId && facts.costing?.technical_solution_version_id === technicalId && facts.costing?.design_bom_version_id === bomId && facts.costing?.pricing_snapshot_id === pricingId);
  const snapshotValid = Boolean(pricingId && facts.pricing?.status === "effective" && String(facts.pricing?.valid_until ?? "") >= new Date().toISOString().slice(0, 10));
  const pricingContextComplete = Boolean(facts.pricing?.source && facts.pricing?.source_version && facts.pricing?.snapshot_date && facts.pricing?.currency && facts.pricing?.tax_basis && facts.pricing?.trade_terms && facts.pricing?.evidence_ref && (facts.pricing?.currency === "CNY" || facts.pricing?.exchange_rate_basis));
  const componentKeys = ["material_cost_cents", "labor_cost_cents", "manufacturing_cost_cents", "transport_cost_cents", "tax_cost_cents", "risk_reserve_cents"] as const;
  const totalCostCents = facts.costing ? componentKeys.reduce((sum, key) => sum + Number(facts.costing?.[key] ?? 0), 0) : 0;
  const items: S3ReadinessItem[] = [
    { key: "technicalBaseline", label: "需求与核价技术基线一致", summary: technical ? `${technicalId}｜${technical.status === "approved" ? "S2已批准" : `当前状态${technical.status}`}` : "尚无S2批准技术方案", ready: Boolean(technicalId && technical?.status === "approved" && lineageValid), hard: true, sourceType: "TechnicalSolutionVersion", sourceRefs: technicalId ? [technicalId] : [], owner: "技术负责人" },
    { key: "quotationDesignBom", label: "报价设计BOM已确认并绑定技术方案", summary: facts.bom ? `${facts.bom.configuration_summary}｜${facts.bom.confirmation_status === "confirmed" ? "已确认" : "未确认"}` : "尚无报价设计BOM", ready: lineageValid && facts.bom?.confirmation_status === "confirmed" && Boolean(facts.bom?.evidence_ref), hard: true, sourceType: "QuotationDesignBOM", sourceRefs: bomId ? [bomId] : [], owner: "技术/采购" },
    { key: "pricingSnapshot", label: "价格来源版本、币种税费、贸易条件和有效期已冻结", summary: facts.pricing ? `${facts.pricing.source}@${facts.pricing.source_version}｜${facts.pricing.currency}｜${facts.pricing.tax_basis}｜${facts.pricing.trade_terms}｜${facts.pricing.snapshot_date} 至 ${facts.pricing.valid_until}${facts.pricing.currency !== "CNY" ? `｜汇率依据：${facts.pricing.exchange_rate_basis || "缺失"}` : ""}` : "尚无价格快照", ready: lineageValid && snapshotValid && pricingContextComplete, hard: true, sourceType: "PricingSnapshot", sourceRefs: pricingId ? [pricingId] : [], owner: "采购/财务" },
    { key: "completeCost", label: "完整成本可追溯", summary: facts.costing ? `材料、人工、制造、运输、税费、风险储备合计 ¥${(totalCostCents / 100).toLocaleString("zh-CN")}` : "尚无完整成本构成", ready: lineageValid && totalCostCents > 0 && componentKeys.every(key => Number(facts.costing?.[key] ?? -1) >= 0), hard: true, sourceType: "CostingSolutionVersion", sourceRefs: costingId ? [costingId] : [], owner: "财务/核价人员" },
    { key: "profitAndMargin", label: "目标利润率、测算依据与毛利已记录", summary: facts.costing ? `目标利润率 ${(Number(facts.costing.target_profit_rate_bp) / 100).toFixed(2)}%｜测算毛利率 ${(Number(facts.costing.gross_margin_bp) / 100).toFixed(2)}%｜${facts.costing.calculation_basis}` : "尚无利润测算", ready: lineageValid && Number(facts.costing?.target_profit_rate_bp ?? 0) > 0 && Boolean(facts.costing?.calculation_basis) && Number(facts.costing?.costing_sales_price_cents ?? 0) > 0 && Number.isFinite(Number(facts.costing?.gross_margin_bp)), hard: true, sourceType: "CostingSolutionVersion", sourceRefs: costingId ? [costingId] : [], owner: "财务/核价人员" },
    { key: "deliveryRisk", label: "交期评估与风险结论已形成", summary: facts.costing ? `${facts.costing.delivery_assessment}｜${facts.costing.delivery_risk_conclusion}` : "尚无交期结论", ready: lineageValid && Boolean(facts.costing?.delivery_assessment) && Boolean(facts.costing?.delivery_risk_conclusion), hard: true, sourceType: "CostingSolutionVersion", sourceRefs: costingId ? [costingId] : [], owner: "财务/核价人员" },
  ];
  return { items, technicalSolutionVersion: technical ?? undefined, quotationDesignBom: facts.bom ?? undefined, pricingSnapshot: facts.pricing ?? undefined, costingSolutionVersion: facts.costing ?? undefined, generatedAt: new Date().toISOString() };
}

export async function buildS3Readiness(projectId: string) {
  const s2 = await loadS2SourceFacts(projectId);
  const readiness = s3ReadinessFromFacts(s2.solution, await loadS3SourceFacts(projectId));
  return { ...readiness, activitySnapshot: await buildGateActivitySnapshot(projectId, "G4") };
}

function isoDate(value: unknown, label: string): string {
  const date = requiredText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new FlowError(`${label}格式必须为 YYYY-MM-DD。`);
  return date;
}

function money(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000_000) throw new FlowError(`${label}必须大于0且不超过100亿元。`);
  return Math.round(amount * 100) / 100;
}

export function parsePricingAuthorization(raw: unknown): PricingAuthorizationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("G4批准必须同时形成价格授权。", 400);
  const data = raw as Record<string, unknown>;
  const floorPriceYuan = money(data.floorPriceYuan, "授权底价");
  const authorizedQuotePriceYuan = money(data.authorizedQuotePriceYuan, "授权报价");
  if (authorizedQuotePriceYuan < floorPriceYuan) throw new FlowError("授权报价不得低于授权底价；低于底价必须先走价格例外授权。", 409);
  const validUntil = isoDate(data.validUntil, "价格授权有效期");
  if (validUntil < new Date().toISOString().slice(0, 10)) throw new FlowError("价格授权有效期已过，不能批准G4。", 409);
  return {
    floorPriceYuan,
    authorizedQuotePriceYuan,
    currency: requiredText(data.currency, "授权币种", 3).toUpperCase(),
    taxBasis: requiredText(data.taxBasis, "授权税费口径", 500),
    tradeTerms: requiredText(data.tradeTerms, "授权贸易/交付条件", 500),
    routeScope: requiredText(data.routeScope, "授权报价通路", 500),
    exceptionConditions: requiredText(data.exceptionConditions, "价格授权例外条件", 1000),
    scopeAlignmentConclusion: requiredText(data.scopeAlignmentConclusion, "项目范围与报价范围核对结论", 2000),
    amountVarianceExplanation: requiredText(data.amountVarianceExplanation, "项目预计金额与授权报价差异说明", 2000),
    validUntil,
    evidenceRef: requiredText(data.evidenceRef, "价格授权证据", 1000),
  };
}

export function parseBidPackage(raw: unknown): BidPackageInput {
  if (!raw || typeof raw !== "object") throw new FlowError("投标提交包格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  const submissionType = String(data.submissionType);
  if (!["DirectBidSubmission", "CustomerRouteQuotation", "DirectQuotation"].includes(submissionType)) throw new FlowError("提交类型不符合当前业务场景口径。", 400);
  const packageHash = requiredText(data.packageHash, "提交包哈希", 256);
  if (!/^[A-Za-z0-9:_-]{8,256}$/.test(packageHash)) throw new FlowError("提交包哈希格式不合法。", 400);
  return {
    submissionType: submissionType as BidPackageInput["submissionType"],
    routeId: requiredText(data.routeId, "提交通路编号", 160),
    quotedPriceYuan: money(data.quotedPriceYuan, "最终报价"),
    packageHash,
    evidenceRef: requiredText(data.evidenceRef, "投标包形成证据", 1000),
  };
}

export function parseProfessionalReview(raw: unknown): ProfessionalReviewInput {
  if (!raw || typeof raw !== "object") throw new FlowError("专业评审结论格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  const reviewType = String(data.reviewType);
  if (!["business", "technical", "qualification"].includes(reviewType)) throw new FlowError("专业评审类型必须为商务、技术或资质。", 400);
  const reviewConclusion = String(data.reviewConclusion);
  if (!["approved", "rejected"].includes(reviewConclusion)) throw new FlowError("专业评审结论只能为通过或不通过。", 400);
  const deviationConclusion = String(data.deviationConclusion);
  if (!["none", "authorized"].includes(deviationConclusion)) throw new FlowError("偏差结论必须为无偏差或存在偏差并提交G5授权。", 400);
  const openRiskCount = Number(data.openRiskCount);
  if (!Number.isInteger(openRiskCount) || openRiskCount < 0 || openRiskCount > 9999) throw new FlowError("未关闭风险数量不合法。", 400);
  if (reviewConclusion === "approved" && openRiskCount !== 0) throw new FlowError("专业评审通过时未关闭问题数必须为0。", 400);
  const remediationId = String(data.remediationId ?? "").trim();
  return { bidPackageVersionId: requiredText(data.bidPackageVersionId, "投标包版本", 120), reviewType: reviewType as ProfessionalReviewInput["reviewType"], reviewConclusion: reviewConclusion as ProfessionalReviewInput["reviewConclusion"], openRiskCount, deviationConclusion: deviationConclusion as ProfessionalReviewInput["deviationConclusion"], reviewSummary: requiredText(data.reviewSummary, "专业评审意见", 2000), evidenceRef: requiredText(data.evidenceRef, "专业评审证据", 1000), ...(remediationId ? { remediationId } : {}) };
}

export function parseProfessionalReviewRemediation(raw: unknown): ProfessionalReviewRemediationInput {
  if (!raw || typeof raw !== "object") throw new FlowError("评审整改回传格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  return {
    professionalReviewId: requiredText(data.professionalReviewId, "原专业评审记录", 120),
    issueResponse: requiredText(data.issueResponse, "问题整改说明", 2000),
    evidenceRef: requiredText(data.evidenceRef, "整改证据", 1000),
  };
}

type G5SourceFacts = {
  project: Record<string, string | number | null> | null;
  g4: Record<string, string | number | null> | null;
  costing: Record<string, string | number | null> | null;
  authorization: Record<string, string | number | null> | null;
  bidPackages: Array<Record<string, string | number | null>>;
  reviews: Array<Record<string, string | number | null>>;
  quotationRoutes: Array<Record<string, string | number | null>>;
  priceExceptions: Array<Record<string, string | number | null>>;
  projectRisks: Array<Record<string, string | number | null>>;
  strategy: Record<string, string | number | null> | null;
  relationships: Array<Record<string, string | number | null>>;
};

async function loadG5SourceFacts(projectId: string): Promise<G5SourceFacts> {
  const db = getD1Binding();
  const [project, g4, costing, authorization, packages, reviews, routes, exceptions, projectRisks, strategy, relationships] = await Promise.all([
    db.prepare("SELECT p.*,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM stage_gate_instances WHERE project_id=? AND gate_code='G4' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM costing_solution_versions WHERE project_id=? AND status='approved' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM pricing_authorizations WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM bid_package_versions WHERE project_id=? AND status IN ('prepared','frozen','submitted') ORDER BY version DESC").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM professional_reviews WHERE project_id=? AND status='effective' ORDER BY created_at DESC").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM quotation_routes WHERE project_id=? AND status='active' ORDER BY inquiry_date,created_at").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM epc_price_exceptions WHERE project_id=? AND status IN ('pending','approved') ORDER BY created_at DESC").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT id,category,title,level,status,owner_name,due_date,evidence_ref,version,mitigation_activity_id FROM project_risks WHERE project_id=? AND status!='closed' ORDER BY CASE level WHEN '重大' THEN 4 WHEN '高' THEN 3 WHEN '中' THEN 2 ELSE 1 END DESC,due_date").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM project_strategy_versions WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT id,layer,person_name,title,attitude,influence,owner_name,evidence_ref,last_touch_at FROM customer_relationship_records WHERE project_id=? ORDER BY created_at").bind(projectId).all<Record<string, string | number | null>>(),
  ]);
  const latestByRoute = new Map<string, Record<string, string | number | null>>();
  for (const item of packages.results) if (!latestByRoute.has(String(item.route_id))) latestByRoute.set(String(item.route_id), item);
  return { project: project ?? null, g4: g4 ?? null, costing: costing ?? null, authorization: authorization ?? null, bidPackages: [...latestByRoute.values()], reviews: reviews.results, quotationRoutes: routes.results, priceExceptions: exceptions.results, projectRisks: projectRisks.results, strategy: strategy ?? null, relationships: relationships.results };
}

function expectedSubmissionType(scenarioCode: unknown): BidPackageInput["submissionType"] | "" {
  return SCENARIO_TYPES.find(item => item.code === scenarioCode)?.submissionType ?? "";
}

const PROFESSIONAL_REVIEW_LABELS: Record<ProfessionalReviewInput["reviewType"], string> = { business: "商务评审", technical: "技术评审", qualification: "资质评审" };

function routeAuthorized(scope: unknown, routeId: unknown): boolean {
  const normalizedScope = String(scope ?? "").split(/[，,;；\s]+/).filter(Boolean);
  const normalizedRoute = String(routeId ?? "");
  return normalizedScope.includes("*") || normalizedScope.includes("ALL-EPC-ROUTES") || normalizedScope.includes(normalizedRoute);
}

export function parseEpcQuotationRoute(raw: unknown): EpcQuotationRouteInput {
  if (!raw || typeof raw !== "object") throw new FlowError("EPC报价通路格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  return {
    epcCustomer: requiredText(data.epcCustomer, "EPC客户名称", 200),
    inquiryRef: requiredText(data.inquiryRef, "EPC询价编号", 200),
    inquiryDate: isoDate(data.inquiryDate, "EPC询价日期"),
    evidenceRef: requiredText(data.evidenceRef, "EPC询价证据", 1000),
  };
}

export function parseEpcPriceException(raw: unknown): EpcPriceExceptionInput {
  if (!raw || typeof raw !== "object") throw new FlowError("EPC通路价格例外格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  return {
    routeId: requiredText(data.routeId, "EPC报价通路", 160),
    requestedPriceYuan: money(data.requestedPriceYuan, "通路例外报价"),
    reason: requiredText(data.reason, "通路差异原因", 2000),
    evidenceRef: requiredText(data.evidenceRef, "价格例外证据", 1000),
    validUntil: isoDate(data.validUntil, "价格例外有效期"),
  };
}

export function parseG5ReopenRequest(raw: unknown): G5ReopenRequestInput {
  if (!raw || typeof raw !== "object") throw new FlowError("G5解冻申请格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  const changeType = String(data.changeType);
  if (!["add_route", "withdraw_route", "route_material_change", "route_price_change"].includes(changeType)) throw new FlowError("G5解冻变更类型不合法。", 400);
  const routeId = String(data.routeId ?? "").trim();
  if (changeType !== "add_route" && !routeId) throw new FlowError("当前变更类型必须指定EPC报价通路。", 400);
  return { changeType: changeType as G5ReopenRequestInput["changeType"], routeId, reason: requiredText(data.reason, "解冻原因", 2000), evidenceRef: requiredText(data.evidenceRef, "解冻依据", 1000) };
}

export function parseG5DeviationAuthorizations(raw: unknown): G5DeviationAuthorizationInput[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new FlowError("G5偏差授权必须为逐项清单。", 400);
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") throw new FlowError(`第${index + 1}项偏差授权格式不正确。`, 400);
    const data = item as Record<string, unknown>;
    return {
      deviationRef: requiredText(data.deviationRef, `第${index + 1}项偏差来源`, 160),
      scope: requiredText(data.scope, `第${index + 1}项授权范围`, 2000),
      risk: requiredText(data.risk, `第${index + 1}项剩余风险`, 2000),
      applicableVersionId: requiredText(data.applicableVersionId, `第${index + 1}项适用版本`, 160),
      validUntil: isoDate(data.validUntil, `第${index + 1}项授权有效期`),
      evidenceRef: requiredText(data.evidenceRef, `第${index + 1}项授权证据`, 1000),
    };
  });
}

function g5ReadinessFromFacts(facts: G5SourceFacts): G5ReadinessSnapshot {
  const g4Id = facts.g4 ? String(facts.g4.id) : "";
  const costingId = facts.costing ? String(facts.costing.id) : "";
  const authorizationId = facts.authorization ? String(facts.authorization.id) : "";
  const today = new Date().toISOString().slice(0, 10);
  const g4Ready = Boolean(g4Id && facts.g4?.status === "approved" && costingId);
  const authorizationReady = Boolean(authorizationId && facts.authorization?.status === "effective" && facts.authorization?.costing_solution_version_id === costingId && String(facts.authorization?.valid_until ?? "") >= today);
  const expectedType = expectedSubmissionType(facts.project?.scenario_code);
  const isEpc = isEpcScenarioCode(String(facts.project?.scenario_code ?? ""));
  const scenarioPolicy = gateScenarioPolicy(facts.project?.scenario_code);
  const requiredReviewTypes = professionalReviewTypesForScenario(facts.project?.scenario_code);
  const effectiveRoutes = isEpc ? facts.quotationRoutes : [{ id: String(facts.bidPackages[0]?.route_id ?? "") }];
  const reviewsByPackage = new Map<string, Array<Record<string, string | number | null>>>();
  for (const review of facts.reviews) {
    const packageId = String(review.bid_package_version_id);
    reviewsByPackage.set(packageId, [...(reviewsByPackage.get(packageId) ?? []), review]);
  }
  const routeReadiness: EpcRouteReadiness[] = effectiveRoutes.map(route => {
    const routeId = String(route.id ?? "");
    const bidPackage = facts.bidPackages.find(item => String(item.route_id) === routeId);
    const reviews = bidPackage ? reviewsByPackage.get(String(bidPackage.id)) ?? [] : [];
    const currentReviews = reviews.filter(review => requiredReviewTypes.includes(String(review.review_type) as ProfessionalReviewInput["reviewType"]));
    const missingReviewTypes = requiredReviewTypes.filter(type => !currentReviews.some(review => review.review_type === type));
    const failedReviews = currentReviews.filter(review => review.conclusion !== "approved" || Number(review.open_risk_count ?? -1) !== 0 || !["none", "authorized"].includes(String(review.deviation_conclusion)));
    const approvedException = facts.priceExceptions.find(item => item.status === "approved" && String(item.route_id) === routeId && String(item.pricing_authorization_id) === authorizationId && String(item.valid_until) >= today);
    const pendingException = facts.priceExceptions.find(item => item.status === "pending" && String(item.route_id) === routeId);
    const expectedPriceCents = approvedException ? Number(approvedException.requested_price_cents) : Number(facts.authorization?.authorized_quote_price_cents ?? 0);
    const blockers: string[] = [];
    if (!bidPackage) blockers.push("尚未形成该通路提交包");
    if (bidPackage && (bidPackage.costing_solution_version_id !== costingId || bidPackage.pricing_authorization_id !== authorizationId || bidPackage.submission_type !== expectedType)) blockers.push("提交包未绑定当前核价/授权/场景");
    if (missingReviewTypes.length) blockers.push(`缺少${missingReviewTypes.map(type => PROFESSIONAL_REVIEW_LABELS[type]).join("、")}`);
    if (failedReviews.length) blockers.push(`${failedReviews.map(review => PROFESSIONAL_REVIEW_LABELS[String(review.review_type) as ProfessionalReviewInput["reviewType"]]).join("、")}未通过或仍有开放问题`);
    if (pendingException) blockers.push("通路价格例外仍在审批中");
    if (bidPackage && (Number(bidPackage.quoted_price_cents) < Number(facts.authorization?.floor_price_cents ?? Number.MAX_SAFE_INTEGER) || Number(bidPackage.quoted_price_cents) !== expectedPriceCents)) blockers.push("报价不符合统一授权价或已批准例外价");
    if (bidPackage && (!routeAuthorized(facts.authorization?.route_scope, routeId) || String(bidPackage.package_hash ?? "").length < 8 || !bidPackage.evidence_ref)) blockers.push("通路、包哈希或签审证据不完整");
    return { route, bidPackage: bidPackage ?? undefined, professionalReview: currentReviews[0], professionalReviews: currentReviews, priceException: approvedException ?? pendingException, expectedPriceCents, ready: authorizationReady && blockers.length === 0, blockers };
  });
  const packages = routeReadiness.map(item => item.bidPackage).filter((item): item is Record<string, unknown> => Boolean(item));
  const professionalReviews = routeReadiness.flatMap(item => item.professionalReviews ?? []);
  const allRoutesReady = effectiveRoutes.length > 0 && routeReadiness.every(item => item.ready);
  const packageReady = effectiveRoutes.length > 0 && routeReadiness.every(item => Boolean(item.bidPackage) && !item.blockers.some(blocker => blocker.includes("核价/授权/场景")));
  const reviewReady = effectiveRoutes.length > 0 && routeReadiness.every(item => !item.blockers.some(blocker => blocker.includes("评审") || blocker.includes("开放问题")));
  const priceReady = effectiveRoutes.length > 0 && routeReadiness.every(item => !item.blockers.some(blocker => blocker.includes("价格例外") || blocker.includes("报价不符合")));
  const signatureReady = effectiveRoutes.length > 0 && routeReadiness.every(item => !item.blockers.some(blocker => blocker.includes("通路、包哈希")));
  const routeIds = effectiveRoutes.map(item => String(item.id ?? "")).filter(Boolean);
  const packageIds = packages.map(item => String(item.id));
  const reviewIds = professionalReviews.map(item => String(item.id));
  const deviationItems = professionalReviews.filter(item => item.deviation_conclusion === "authorized").map(item => ({
    ref: String(item.id),
    sourceType: "ProfessionalReview" as const,
    reviewType: String(item.review_type) as ProfessionalReviewInput["reviewType"],
    description: String(item.review_summary),
    applicableVersionIds: [String(item.bid_package_version_id)],
  }));
  const residualHighRisks = facts.projectRisks.filter(item => item.level === "高" || item.level === "重大");
  const riskIds = facts.projectRisks.map(item => String(item.id));
  const strategyPayload = jsonRecord(facts.strategy?.strategy_payload);
  const businessDecisionContext = {
    customer: facts.project?.customer_name,
    finalCustomer: facts.project?.final_customer_name,
    winProbability: facts.project?.probability,
    strategyVersionId: facts.strategy?.id,
    objective: facts.strategy?.objective,
    customerDecisionPreference: facts.strategy?.decision_preference,
    competitiveAssessment: facts.strategy?.competitive_assessment,
    winPath: strategyPayload.winPath,
    relationshipCoverage: facts.relationships.map(item => ({ id: item.id, layer: item.layer, personName: item.person_name, attitude: item.attitude, influence: item.influence, evidenceRef: item.evidence_ref, lastTouchAt: item.last_touch_at })),
    residualRiskIds: riskIds,
    nonBidConsequence: strategyPayload.nonBidConsequence,
    strategyEvidenceRef: facts.strategy?.evidence_ref,
  };
  const strategyCurrent = Boolean(facts.strategy && ["draft", "approved"].includes(String(facts.strategy.status)));
  const businessContextReady = Boolean(strategyCurrent && facts.strategy?.id && facts.strategy?.objective && facts.strategy?.competitive_assessment && strategyPayload.winPath && strategyPayload.nonBidConsequence && facts.strategy?.evidence_ref && facts.relationships.length);
  const items: G5ReadinessItem[] = [
    { key: "g4Baseline", label: "G4核价基线已批准且仍为当前版本", summary: g4Ready ? `${g4Id}｜核价版本 ${costingId}` : "尚无有效G4批准核价基线", ready: g4Ready, hard: true, sourceType: "StageGateInteraction", sourceRefs: [g4Id, costingId].filter(Boolean), owner: "财务/价格授权人" },
    { key: "priceAuthorization", label: "底价、报价通路和有效期已授权", summary: authorizationReady ? `底价 ¥${(Number(facts.authorization?.floor_price_cents) / 100).toLocaleString("zh-CN")}｜有效至 ${facts.authorization?.valid_until}` : "价格授权缺失、过期或未绑定当前核价版本", ready: authorizationReady, hard: true, sourceType: "PricingAuthorization", sourceRefs: authorizationId ? [authorizationId] : [], owner: "财务/价格授权人" },
    { key: "bidPackage", label: isEpc ? "全部有效EPC通路均已形成提交包" : "最终提交包已形成并匹配业务场景", summary: packageReady ? `${packages.length}/${effectiveRoutes.length} 个通路提交包齐套` : `${packages.length}/${effectiveRoutes.length} 个通路已形成当前版本提交包`, ready: packageReady, hard: true, sourceType: "BidPackageVersion", sourceRefs: packageIds, owner: "投标专员" },
    { key: "professionalReview", label: requiredReviewTypes.length ? "商务、技术、资质评审分别通过且无开放问题" : "本场景专业评审条件尚未触发", summary: requiredReviewTypes.length ? `${professionalReviews.length}/${effectiveRoutes.length * requiredReviewTypes.length} 项分专业结论已形成；${routeReadiness.filter(item => item.ready).length} 个通路已整体就绪｜${scenarioPolicy?.g5ReviewBasis ?? "按场景策略执行"}` : scenarioPolicy?.g5ReviewBasis ?? "场景策略缺失，禁止将未评审解释为免评审", ready: reviewReady, hard: requiredReviewTypes.length > 0, sourceType: "ProfessionalReview", sourceRefs: reviewIds, owner: "商务/技术/资质评审人" },
    { key: "businessDecisionContext", label: "赢单策略、客户关系、竞争与不投后果已形成决策快照", summary: businessContextReady ? `策略V${facts.strategy?.version}｜关系记录${facts.relationships.length}项｜竞争：${facts.strategy?.competitive_assessment}｜不投后果：${strategyPayload.nonBidConsequence}` : facts.strategy?.status === "stale" ? "客户、需求、竞对、资源或风险事实已变化，必须更新赢单策略后再决策" : "缺少当前策略、客户关系、竞争判断、策略证据或不投/不报后果", ready: businessContextReady, hard: true, sourceType: "ProjectStrategyVersion", sourceRefs: [facts.strategy?.id, ...facts.relationships.map(item => item.id)].filter(Boolean).map(String), owner: "销售项目Owner/销售主管" },
    { key: "deviationAuthorization", label: "专业评审偏差进入G5逐项授权", summary: deviationItems.length ? `${deviationItems.length}项偏差待主管在本次投/报决策中逐项确认范围、风险、适用版本、有效期和证据` : "专业评审未报告需授权偏差", ready: deviationItems.length === 0, hard: false, sourceType: "ProfessionalReview", sourceRefs: deviationItems.map(item => item.ref), owner: "销售项目Owner/销售主管" },
    { key: "projectRisk", label: "销售项目剩余风险已进入商务决策", summary: facts.projectRisks.length ? `未关闭${facts.projectRisks.length}项，其中重大/高风险${residualHighRisks.length}项；批准投/报时须在本次G5中显式接受` : "当前没有未关闭的销售项目经营风险", ready: residualHighRisks.length === 0, hard: false, sourceType: "ProjectRisk", sourceRefs: riskIds, owner: "销售项目Owner/销售主管" },
    { key: "priceFloor", label: isEpc ? "各通路采用统一授权价或已批准例外价，且不低于底价" : "最终报价等于授权报价且不低于底价", summary: facts.authorization ? `项目统一授权报价 ¥${(Number(facts.authorization.authorized_quote_price_cents) / 100).toLocaleString("zh-CN")}｜已批准例外 ${routeReadiness.filter(item => item.priceException && item.priceException.status === "approved").length} 条` : "缺少可比对的报价和授权", ready: priceReady, hard: true, sourceType: "PricingAuthorization", sourceRefs: [authorizationId, ...packageIds].filter(Boolean), owner: "系统一致性校验" },
    { key: "signatureConsistency", label: "提交通路、签审证据与包哈希一致", summary: signatureReady ? `${effectiveRoutes.length} 个通路均完成一致性校验` : "存在未授权通路或提交包签审证据不完整", ready: signatureReady, hard: true, sourceType: "BidPackageVersion", sourceRefs: packageIds, owner: "系统一致性校验" },
  ];
  if (isEpc) items.splice(2, 0, { key: "epcRoutes", label: "EPC报价批次已覆盖全部有效通路", summary: effectiveRoutes.length ? `${routeReadiness.filter(item => item.ready).length}/${effectiveRoutes.length} 个有效通路就绪` : "尚未登记有效EPC报价通路", ready: allRoutesReady, hard: true, sourceType: "QuotationRoute", sourceRefs: routeIds, owner: "系统一致性校验" });
  return { items, pricingAuthorization: facts.authorization ?? undefined, bidPackageVersion: packages[0], bidPackageVersions: packages, professionalReview: professionalReviews[0], professionalReviews, quotationRoutes: facts.quotationRoutes, routeReadiness, priceExceptions: facts.priceExceptions, projectRisks: facts.projectRisks, residualHighRisks, businessDecisionContext, deviationItems, generatedAt: new Date().toISOString() };
}

export async function buildG5Readiness(projectId: string) {
  const readiness = g5ReadinessFromFacts(await loadG5SourceFacts(projectId));
  return { ...readiness, activitySnapshot: await buildGateActivitySnapshot(projectId, "G5") };
}

export function parseCostingAssessment(raw: unknown): CostingAssessmentInput {
  if (!raw || typeof raw !== "object") throw new FlowError("核价评估格式不正确。");
  const data = raw as Record<string, unknown>;
  const date = (key: string, label: string) => { const value = requiredText(data[key], label, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FlowError(`${label}格式必须为 YYYY-MM-DD。`); return value; };
  const amount = (key: string, label: string, positive = false) => { const value = Number(data[key]); if (!Number.isFinite(value) || value < 0 || value > 10_000_000_000 || (positive && value <= 0)) throw new FlowError(`${label}金额不合法。`); return Math.round(value * 100) / 100; };
  const targetProfitRate = Number(data.targetProfitRate);
  if (!Number.isFinite(targetProfitRate) || targetProfitRate <= 0 || targetProfitRate >= 100) throw new FlowError("目标利润率必须大于0且小于100%。");
  const snapshotDate = date("snapshotDate", "价格快照日期");
  const validUntil = date("validUntil", "价格有效期");
  if (validUntil < snapshotDate) throw new FlowError("价格有效期不能早于快照日期。");
  const currency = requiredText(data.currency, "价格币种", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new FlowError("价格币种必须使用三位大写币种代码。", 400);
  const exchangeRateBasis = String(data.exchangeRateBasis ?? "").trim();
  if (currency !== "CNY" && !exchangeRateBasis) throw new FlowError("非人民币价格必须提供汇率基准、日期和来源。", 400);
  return {
    priceSource: requiredText(data.priceSource, "价格来源", 1000), priceSourceVersion: requiredText(data.priceSourceVersion, "价格来源版本", 200), snapshotDate, validUntil, currency, taxBasis: requiredText(data.taxBasis, "税费口径", 500), tradeTerms: requiredText(data.tradeTerms, "贸易/交付条件", 500), ...(exchangeRateBasis ? { exchangeRateBasis } : {}), priceEvidenceRef: requiredText(data.priceEvidenceRef, "价格快照证据", 1000),
    materialCostYuan: amount("materialCostYuan", "材料成本"), laborCostYuan: amount("laborCostYuan", "人工成本"), manufacturingCostYuan: amount("manufacturingCostYuan", "制造成本"), transportCostYuan: amount("transportCostYuan", "运输成本"), taxCostYuan: amount("taxCostYuan", "税费"), riskReserveYuan: amount("riskReserveYuan", "风险储备"), costingSalesPriceYuan: amount("costingSalesPriceYuan", "核价销售价", true), targetProfitRate: Math.round(targetProfitRate * 100) / 100,
    calculationBasis: requiredText(data.calculationBasis, "利润测算依据", 2000), deliveryAssessment: requiredText(data.deliveryAssessment, "交期评估", 2000), deliveryRiskConclusion: requiredText(data.deliveryRiskConclusion, "交期风险结论", 2000),
  };
}

async function editableProject(projectCode: string, actor: DemoActor, requiredRole?: DemoActor["role"]) {
  if (requiredRole && actor.role !== requiredRole) throw new FlowError("当前角色无权维护该来源记录。", 403);
  const project = await getD1Binding().prepare("SELECT id,project_code,owner_user_id,stage,bid_date FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (actor.role === "sales" && project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以维护该项目事实。", 403);
  if (!["S1", "S2"].includes(project.stage)) throw new FlowError("当前阶段不允许维护S1方案启动来源记录。", 409);
  return project;
}

async function operatingProject(projectCode: string, actor: DemoActor) {
  const project = await getD1Binding().prepare("SELECT id,project_code,owner_user_id,owner_name,stage,result,bid_date,administrative_status FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (actor.role === "sales" && project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以维护该项目经营事实。", 403);
  if (!["sales", "manager"].includes(actor.role)) throw new FlowError("当前角色无权维护销售项目经营事实。", 403);
  if (["Closed", "Terminated"].includes(project.administrative_status)) throw new FlowError("已关闭项目不能新增或流转经营事实。", 409);
  if (project.result !== "pending") throw new FlowError("商业结果已形成；客户关系、竞争、风险、伙伴与投标前资源事实均已冻结。", 409);
  return project;
}

export async function requestProjectResource(projectCode: string, input: ResourceRequestInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("资源需求必须由项目Owner提出，主管负责后续指派。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  const existingAssignment = await db.prepare("SELECT status FROM role_assignments WHERE project_id=? AND role_name=?").bind(project.id, input.roleName).first<{ status: string }>();
  if (existingAssignment?.status === "已到位") throw new FlowError(`${input.roleName}已经到位，无需重复申请。`, 409);
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, ...input, status: "pending" });
  try {
    await db.batch([
      db.prepare("INSERT INTO resource_requests (id,project_id,role_name,requirement,required_by,evidence_ref,status,requested_by) VALUES (?,?,?,?,?,?,?,?)").bind(id, project.id, input.roleName, input.requirement, input.requiredBy, input.evidenceRef, "pending", actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ResourceRequest", id, DOMAIN_EVENTS.resourceRequested, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "资源", "提交关键资源申请", null, after, actor.id),
    ]);
  } catch (error) {
    if (String(error).includes("resource_requests_project_role_open_uq") || String(error).includes("UNIQUE constraint failed")) throw new FlowError(`${input.roleName}已有待处理申请，不能重复提交。`, 409);
    throw error;
  }
  return { projectCode, request: { id, ...input, status: "pending" as const } };
}

export async function decidePartnerNeed(projectCode: string, input: PartnerNeedInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("伙伴需要性必须由项目Owner基于客户与项目事实判断。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  if (input.decision === "not_needed") {
    const active = await db.prepare("SELECT partner_name FROM partner_engagements WHERE project_id=? AND verification_status!='rejected' LIMIT 1").bind(project.id).first<{ partner_name: string }>();
    if (active) throw new FlowError(`项目仍有未驳回伙伴 ${active.partner_name}；应先完成关系核实，不能直接改成不需要。`, 409);
  }
  const existing = await db.prepare("SELECT id,decision,reason,evidence_ref FROM partner_need_decisions WHERE project_id=?").bind(project.id).first<Record<string, string>>();
  const id = existing?.id ?? crypto.randomUUID();
  const before = existing ? JSON.stringify(existing) : null;
  const after = JSON.stringify({ id, projectCode, ...input });
  await db.batch([
    db.prepare("INSERT INTO partner_need_decisions (id,project_id,decision,reason,evidence_ref,decided_by) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET decision=excluded.decision,reason=excluded.reason,evidence_ref=excluded.evidence_ref,decided_by=excluded.decided_by,updated_at=CURRENT_TIMESTAMP").bind(id, project.id, input.decision, input.reason, input.evidenceRef, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", project.id, DOMAIN_EVENTS.partnerNeedDecided, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "伙伴", "记录伙伴需要性判断", before, after, actor.id),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, partnerNeed: { id, ...input } };
}

export async function registerPartnerEngagement(projectCode: string, input: PartnerEngagementInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("候选伙伴必须由项目Owner登记。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  const need = await db.prepare("SELECT decision FROM partner_need_decisions WHERE project_id=?").bind(project.id).first<{ decision: string }>();
  if (need?.decision !== "needed") throw new FlowError("请先形成‘需要伙伴’的可审计判断，再登记候选伙伴。", 409);
  const parties = await db.prepare("SELECT p.display_name FROM sales_project_party_roles r JOIN parties p ON p.id=r.party_id WHERE r.project_id=? AND r.status='active'").bind(project.id).all<{ display_name: string }>();
  const normalizedPartner = normalizedKeyPart(input.partnerName);
  if (parties.results.some(item => normalizedKeyPart(item.display_name) === normalizedPartner)) throw new FlowError("客户、EPC询价方或潜在合同客户属于Party角色，不能同时登记为经营伙伴。", 409);
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, ...input, verificationStatus: "verification_pending" });
  try {
    await db.batch([
      db.prepare("INSERT INTO partner_engagements (id,project_id,partner_name,partner_type,need_status,verification_status,verification_evidence_ref,created_by) VALUES (?,?,?,?,?,?,?,?)").bind(id, project.id, input.partnerName, input.partnerType, "needed", "verification_pending", input.verificationEvidenceRef, actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "PartnerEngagement", id, DOMAIN_EVENTS.partnerEngagementRegistered, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "伙伴", "登记候选伙伴并申请验证", null, after, actor.id),
    ]);
  } catch (error) {
    if (/partner_engagements_project_name_uq|UNIQUE constraint failed/i.test(String(error))) throw new FlowError("该伙伴已在当前项目登记，不能重复创建。", 409);
    throw error;
  }
  return { projectCode, engagement: { id, ...input, verificationStatus: "verification_pending" as const } };
}

export async function decidePartnerVerification(projectCode: string, input: PartnerVerificationInput, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("伙伴关系证据由销售主管复核，项目Owner不能自证通过。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  const row = await db.prepare("SELECT * FROM partner_engagements WHERE id=? AND project_id=?").bind(input.engagementId, project.id).first<Record<string, string | null>>();
  if (!row) throw new FlowError("伙伴协同记录不存在。", 404);
  if (row.verification_status !== "verification_pending") throw new FlowError("只有待验证伙伴可以形成验证结论。", 409);
  const after = JSON.stringify({ engagementId: input.engagementId, decision: input.decision, comment: input.comment, evidenceRef: input.evidenceRef });
  const result = await db.batch([
    db.prepare("UPDATE partner_engagements SET verification_status=?,verification_decision_evidence_ref=?,verification_comment=?,verified_by=?,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND verification_status='verification_pending'").bind(input.decision, input.evidenceRef, input.comment, actor.id, input.engagementId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM partner_engagements WHERE id=? AND verification_status=?)").bind(crypto.randomUUID(), "PartnerEngagement", input.engagementId, DOMAIN_EVENTS.partnerVerificationDecided, after, actor.id, input.engagementId, input.decision),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM partner_engagements WHERE id=? AND verification_status=?)").bind(crypto.randomUUID(), project.id, "伙伴", input.decision === "verified" ? "确认伙伴关系有效" : "驳回伙伴关系", JSON.stringify(row), after, actor.id, input.engagementId, input.decision),
  ]);
  if (Number(result[0]?.meta?.changes ?? 0) !== 1) throw new FlowError("伙伴状态已变化，请刷新后重试。", 409);
  return { projectCode, engagementId: input.engagementId, verificationStatus: input.decision };
}

export async function recordPartnerContribution(projectCode: string, input: PartnerContributionInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("伙伴实际贡献由项目Owner基于事实记录。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  const engagement = await db.prepare("SELECT partner_name,verification_status FROM partner_engagements WHERE id=? AND project_id=?").bind(input.engagementId, project.id).first<Record<string, string>>();
  if (!engagement) throw new FlowError("伙伴协同记录不存在。", 404);
  if (engagement.verification_status === "rejected") throw new FlowError("已驳回伙伴不能继续登记贡献。", 409);
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, partnerName: engagement.partner_name, verificationStatus: engagement.verification_status, ...input });
  await db.batch([
    db.prepare("INSERT INTO partner_contributions (id,partner_engagement_id,project_id,contribution_type,result,evidence_ref,occurred_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)").bind(id, input.engagementId, project.id, input.contributionType, input.result, input.evidenceRef, input.occurredAt, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "PartnerContribution", id, DOMAIN_EVENTS.partnerContributionRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "伙伴", "记录伙伴实际贡献", null, after, actor.id),
  ]);
  return { projectCode, contribution: { id, ...input } };
}

export async function createProjectRisk(projectCode: string, input: CreateProjectRiskInput, actor: DemoActor) {
  const project = await operatingProject(projectCode, actor);
  if (input.ownerName !== project.owner_name) throw new FlowError("当前项目经营风险必须由销售项目Owner承担；专业风险结论应作为来源证据回传。", 409);
  const db = getD1Binding();
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, ...input, status: "open", version: 1 });
  await db.batch([
    db.prepare("INSERT INTO project_risks (id,project_id,category,title,level,description,impact,owner_name,due_date,status,evidence_ref,version,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, input.category, input.title, input.level, input.description, input.impact, input.ownerName, input.dueDate, "open", input.evidenceRef, 1, actor.id),
    db.prepare("INSERT INTO project_risk_transitions (id,risk_id,from_status,to_status,reason,evidence_ref,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, null, "open", actor.role === "manager" ? "销售主管识别并下发项目风险" : "项目Owner登记经营风险", input.evidenceRef, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectRisk", id, DOMAIN_EVENTS.projectRiskCreated, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "风险", "登记项目经营风险", null, after, actor.id),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, risk: { id, ...input, status: "open" as const, version: 1 } };
}

export async function commandProjectRisk(projectCode: string, input: ProjectRiskCommandInput, actor: DemoActor) {
  const project = await operatingProject(projectCode, actor);
  if (actor.role !== "sales") throw new FlowError("销售主管可以识别并下发风险，但不能代替项目Owner开始处置或关闭风险。", 403);
  const db = getD1Binding();
  const row = await db.prepare("SELECT * FROM project_risks WHERE id=? AND project_id=?").bind(input.riskId, project.id).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("项目风险不存在。", 404);
  if (Number(row.version) !== input.expectedVersion) throw new FlowError("风险已被其他操作更新，请刷新后重试。", 409);
  const targetStatus = input.command === "start" ? "mitigating" : "closed";
  if (input.command === "start" && row.status !== "open") throw new FlowError("只有开放风险可以开始处置。", 409);
  if (input.command === "close" && !["open", "mitigating"].includes(String(row.status))) throw new FlowError("只有开放或处理中的风险可以关闭。", 409);
  const nextVersion = input.expectedVersion + 1;
  if (input.command === "start") {
    const activity = await db.prepare("SELECT id FROM activity_instances WHERE id=? AND project_id=?").bind(input.activityId, project.id).first();
    if (!activity) throw new FlowError("处置行动不存在或不属于当前项目。", 409);
  }
  const before = JSON.stringify({ status: row.status, version: row.version });
  const after = JSON.stringify({ status: targetStatus, version: nextVersion, reason: input.reason, resolution: input.resolution ?? null, evidenceRef: input.evidenceRef });
  const update = targetStatus === "closed"
    ? db.prepare("UPDATE project_risks SET status='closed',resolution=?,closure_evidence_ref=?,closed_by=?,closed_at=CURRENT_TIMESTAMP,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(input.resolution, input.evidenceRef, actor.id, input.riskId, row.status, input.expectedVersion)
    : db.prepare("UPDATE project_risks SET status='mitigating',mitigation_activity_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='open' AND version=?").bind(input.activityId, input.riskId, input.expectedVersion);
  await db.batch([
    update,
    db.prepare("INSERT INTO project_risk_transitions (id,risk_id,from_status,to_status,reason,evidence_ref,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM project_risks WHERE id=? AND status=? AND version=?)").bind(crypto.randomUUID(), input.riskId, row.status, targetStatus, input.reason, input.evidenceRef, actor.id, input.riskId, targetStatus, nextVersion),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM project_risks WHERE id=? AND status=? AND version=?)").bind(crypto.randomUUID(), "ProjectRisk", input.riskId, DOMAIN_EVENTS.projectRiskStatusChanged, after, actor.id, input.riskId, targetStatus, nextVersion),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM project_risks WHERE id=? AND status=? AND version=?)").bind(crypto.randomUUID(), project.id, "风险", targetStatus === "closed" ? "关闭项目经营风险" : "开始处置项目经营风险", before, after, actor.id, input.riskId, targetStatus, nextVersion),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  const risk = await db.prepare("SELECT * FROM project_risks WHERE id=?").bind(input.riskId).first<Record<string, unknown>>();
  return { projectCode, risk };
}

export async function saveStrategyFact(projectCode: string, input: StrategyFactInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("只有项目Owner可以维护赢单策略版本。", 403);
  const project = await operatingProject(projectCode, actor);
  if (!["S1", "S2", "S3", "S4"].includes(project.stage)) throw new FlowError("只有已立项且尚未进入结果阶段的项目可以维护赢单策略。", 409);
  const db = getD1Binding();
  const frozenGate = await db.prepare("SELECT gate_code FROM stage_gate_instances WHERE project_id=? AND gate_code IN ('G2','G5') AND status='pending' ORDER BY gate_code DESC LIMIT 1").bind(project.id).first<{ gate_code: string }>();
  if (frozenGate) throw new FlowError(`${frozenGate.gate_code}已提交审查，冻结期间不能静默改写赢单策略；请先由审批人退回，再形成新版本并重新提交。`, 409);
  const [relationshipsResult, assignmentsResult, preparation, competitorsResult, risksResult, leadSnapshot, partnerNeed] = await Promise.all([
    db.prepare("SELECT id,layer,person_name,title,attitude,influence,evidence_ref,last_touch_at FROM customer_relationship_records WHERE project_id=? ORDER BY created_at").bind(project.id).all<Record<string, unknown>>(),
    db.prepare("SELECT id,role_name,assignee_name,status,required,evidence_ref FROM role_assignments WHERE project_id=? ORDER BY required DESC,role_name").bind(project.id).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM solution_preparation_records WHERE project_id=? ORDER BY version DESC LIMIT 1").bind(project.id).first<Record<string, unknown>>(),
    db.prepare("SELECT id,competitor_name,competitor_role,confidence,evidence_ref,observed_at FROM project_competitor_facts WHERE project_id=? ORDER BY observed_at DESC").bind(project.id).all<Record<string, unknown>>(),
    db.prepare("SELECT id,level,title,status,evidence_ref FROM project_risks WHERE project_id=? AND status!='closed' ORDER BY due_date").bind(project.id).all<Record<string, unknown>>(),
    db.prepare("SELECT id,original_text,requirement_snapshot,source_refs FROM lead_requirement_snapshots WHERE project_id=? ORDER BY snapshot_version DESC LIMIT 1").bind(project.id).first<Record<string, unknown>>(),
    db.prepare("SELECT id,decision,reason,evidence_ref FROM partner_need_decisions WHERE project_id=?").bind(project.id).first<Record<string, unknown>>(),
  ]);
  const relationships = relationshipsResult.results;
  const assignments = assignmentsResult.results;
  const competitors = competitorsResult.results;
  const risks = risksResult.results;
  const leadRequirement = jsonRecord(leadSnapshot?.requirement_snapshot);
  const highInfluence = relationships.filter(item => item.influence === "高");
  const coveredLayers = new Set(relationships.map(item => String(item.layer)));
  const relationshipGaps = ["客户高层", "商务决策链", "技术层"].filter(layer => !coveredLayers.has(layer));
  const decisionPreference = highInfluence.length ? highInfluence.map(item => `${item.layer} ${item.person_name}：${item.evidence_ref}`).join("；") : "尚无高影响力客户角色的有效偏好证据";
  const competitiveAssessment = competitors.length ? competitors.map(item => `${item.competitor_name}（${item.competitor_role}，可信度${item.confidence}）：${item.evidence_ref}`).join("；") : "尚无已核实竞对事实";
  const relationshipPlan = relationshipGaps.length ? `待覆盖：${relationshipGaps.join("、")}` : `三层决策链已有记录；最近接触 ${relationships.map(item => String(item.last_touch_at)).sort().at(-1) ?? "待补"}`;
  const resourcePlan = `${assignments.filter(item => Number(item.required) === 1).map(item => `${item.role_name}：${item.assignee_name}（${item.status}）`).join("；") || "当前阶段未提出新增必需角色"}${partnerNeed ? `｜伙伴判断：${partnerNeed.decision}（${partnerNeed.reason}）` : "｜伙伴需要性待判断"}`;
  const requirementScope = preparation ? `已知需求范围/缺口：${preparation.requirement_gaps}` : `${leadSnapshot?.original_text ?? leadRequirement.productRequirement ?? "线索初始需求待补"}`;
  const keyRisks = risks.length ? risks.map(item => `${item.level}：${item.title}`).join("；") : "当前风险台账无开放项";
  const evidenceRef = [...new Set([...(leadSnapshot ? jsonArray<string>(leadSnapshot.source_refs) : []), ...relationships.map(item => String(item.evidence_ref)), ...assignments.map(item => String(item.evidence_ref)), ...competitors.map(item => String(item.evidence_ref)), ...risks.map(item => String(item.evidence_ref)), preparation?.evidence_ref ? String(preparation.evidence_ref) : "", partnerNeed?.evidence_ref ? String(partnerNeed.evidence_ref) : ""].filter(Boolean))].join("；").slice(0, 500) || `SalesProject:${projectCode}`;
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM project_strategy_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const sourceSnapshot = { decisionPreference, competitiveAssessment, relationshipPlan, resourcePlan, requirementScope, keyRisks, evidenceRef, generatedAt: new Date().toISOString() };
  const after = JSON.stringify({ id, version, ...input, sourceSnapshot });
  const activityStatements = await addSystemActivityEvidenceStatements(db, project.id, projectCode, "ACT-SPM-02", { objectType: "ProjectStrategyVersion", objectId: id, version: String(version) }, evidenceRef, actor.id);
  await db.batch([
    db.prepare("UPDATE project_strategy_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved','stale')").bind(project.id),
    db.prepare("INSERT INTO project_strategy_versions (id,project_id,version,status,decision_preference,objective,competitive_assessment,strategy_payload,evidence_ref,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, version, "draft", decisionPreference, input.objective, competitiveAssessment, JSON.stringify({ valueProposition: input.valueProposition, relationshipPlan, resourcePlan, winPath: input.winPath, winThemes: input.winThemes, requirementScope, keyRisks, nonBidConsequence: input.nonBidConsequence, sourceSnapshot }), evidenceRef, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectStrategyVersion", id, DOMAIN_EVENTS.s1StrategyRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "策略", "保存S1策略来源版本", null, after, actor.id),
    ...activityStatements,
  ]);
  return { projectCode, id, version, readiness: await buildG2Readiness(project.id) };
}

type MilestoneInput = { title: string; milestoneType: string; ownerName: string; plannedAt: string; completionCriteria: string; evidenceRequirement: string; dependencyRef?: string; changeReason: string };

export function parseMilestoneInput(raw: unknown): MilestoneInput {
  if (!raw || typeof raw !== "object") throw new FlowError("里程碑格式不正确。");
  const data = raw as Record<string, unknown>;
  const milestoneType = String(data.milestoneType);
  if (!["项目管理", "客户节点", "外部作业", "Gate锚点"].includes(milestoneType)) throw new FlowError("里程碑类型不合法。");
  const plannedAt = requiredText(data.plannedAt, "计划日期", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedAt)) throw new FlowError("里程碑计划日期格式不正确。");
  return { title: requiredText(data.title, "里程碑名称", 200), milestoneType, ownerName: requiredText(data.ownerName, "里程碑负责人", 120), plannedAt, completionCriteria: requiredText(data.completionCriteria, "完成标准", 1000), evidenceRequirement: requiredText(data.evidenceRequirement, "证据要求", 1000), dependencyRef: data.dependencyRef ? requiredText(data.dependencyRef, "前置依赖", 300) : undefined, changeReason: requiredText(data.changeReason, "建立或调整原因", 500) };
}

export async function saveProjectMilestone(projectCode: string, input: MilestoneInput, actor: DemoActor) {
  const project = await editableProject(projectCode, actor, actor.role === "manager" ? "manager" : "sales");
  const db = getD1Binding();
  const id = crypto.randomUUID();
  const payload = JSON.stringify({ id, projectCode, ...input, status: "planned", sourceType: "management" });
  await db.batch([
    db.prepare("INSERT INTO project_milestones (id,project_id,title,milestone_type,owner_name,planned_at,status,completion_criteria,evidence_requirement,dependency_ref,source_type,change_reason,created_by) VALUES (?,?,?,?,?,?,'planned',?,?,?,'management',?,?)").bind(id, project.id, input.title, input.milestoneType, input.ownerName, input.plannedAt, input.completionCriteria, input.evidenceRequirement, input.dependencyRef ?? null, input.changeReason, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectMilestone", id, "ProjectMilestonePlanned", payload, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "行动", "建立项目里程碑", null, payload, actor.id),
  ]);
  return { projectCode, milestone: await db.prepare("SELECT * FROM project_milestones WHERE id=?").bind(id).first<Record<string, unknown>>() };
}

export async function saveRelationshipFact(projectCode: string, input: RelationshipFactInput, actor: DemoActor) {
  const project = await editableProject(projectCode, actor, "sales");
  const db = getD1Binding();
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, ...input });
  const activityStatements = await addSystemActivityEvidenceStatements(db, project.id, projectCode, "ACT-SPM-03", { objectType: "CustomerRelationshipRecord", objectId: id }, input.evidence, actor.id);
  await db.batch([
    db.prepare("INSERT INTO customer_relationship_records (id,project_id,layer,person_name,title,attitude,influence,owner_name,evidence_ref,last_touch_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, input.layer, input.name, input.title, input.attitude, input.influence, input.owner, input.evidence, input.lastTouch, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CustomerRelationshipRecord", id, DOMAIN_EVENTS.customerRelationshipRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "关系", "新增客户关系来源记录", null, after, actor.id),
    ...activityStatements,
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, id, relationship: input, readiness: await buildG2Readiness(project.id) };
}

export async function saveCompetitorFact(projectCode: string, input: CompetitorFactInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("竞争事实由项目Owner核实并记录；主管负责审查策略，不代替录入。", 403);
  const project = await operatingProject(projectCode, actor);
  if (!["S1", "S2", "S3", "S4"].includes(project.stage)) throw new FlowError("只有已立项且尚未进入结果阶段的项目可以新增竞争事实。", 409);
  const db = getD1Binding();
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, ...input });
  await db.batch([
    db.prepare("INSERT INTO project_competitor_facts (id,project_id,competitor_name,competitor_role,relationship_score,technical_score,price_score,delivery_score,service_score,confidence,evidence_ref,observed_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, input.name, input.role, input.relationship, input.technical, input.price, input.delivery, input.service, input.confidence, input.evidence, input.observedAt, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectCompetitorFact", id, "ProjectCompetitorFactRecorded", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "策略", "新增项目竞争事实", null, after, actor.id),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, id, competitor: input };
}

export async function saveResourceCandidate(projectCode: string, input: ResourceCandidateInput, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("只有销售主管可以登记和维护项目资源候选。", 403);
  const project = await operatingProject(projectCode, actor);
  const db = getD1Binding();
  const existing = await db.prepare("SELECT id,status FROM resource_candidates WHERE project_id=? AND role_name=? AND candidate_name=?").bind(project.id, input.roleName, input.candidateName).first<{ id: string; status: string }>();
  if (existing?.status === "withdrawn" || existing?.status === "rejected") throw new FlowError("该候选已经撤回或拒绝；如需重新纳入必须形成新的企业资源池记录。", 409);
  const id = existing?.id ?? crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, ...input, status: existing?.status ?? "candidate", environment: "demo", simulated: true });
  const statement = existing
    ? db.prepare("UPDATE resource_candidates SET source_system=?,source_ref=?,capabilities=?,load_percent=?,active_project_count=?,available_from=?,evidence_ref=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('candidate','selected')").bind(input.sourceSystem, input.sourceRef, JSON.stringify(input.capabilities), input.loadPercent ?? null, input.activeProjectCount ?? null, input.availableFrom ?? null, input.evidenceRef, id)
    : db.prepare("INSERT INTO resource_candidates (id,project_id,role_name,candidate_name,source_system,source_ref,capabilities,load_percent,active_project_count,available_from,status,evidence_ref,proposed_by,environment,simulated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, input.roleName, input.candidateName, input.sourceSystem, input.sourceRef, JSON.stringify(input.capabilities), input.loadPercent ?? null, input.activeProjectCount ?? null, input.availableFrom ?? null, "candidate", input.evidenceRef, actor.id, "demo", 1);
  await db.batch([
    statement,
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ResourceCandidate", id, DOMAIN_EVENTS.resourceCandidateRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "资源", existing ? "更新资源候选快照" : "登记资源候选", existing ? JSON.stringify(existing) : null, after, actor.id),
  ]);
  return { projectCode, candidate: { id, ...input, status: existing?.status ?? "candidate", environment: "demo", simulated: true } };
}

export async function saveRoleAssignment(projectCode: string, input: RoleAssignmentInput, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("只有销售主管可以确认项目角色指派。", 403);
  const project = await operatingProject(projectCode, actor);
  if (input.status !== "待接受") throw new FlowError("销售主管只能完成候选人指派并置为待接受；已到位必须由被指派人接受任务后产生。", 409);
  const db = getD1Binding();
  const candidate = await db.prepare("SELECT * FROM resource_candidates WHERE id=? AND project_id=? AND role_name=? AND candidate_name=? AND status IN ('candidate','selected')").bind(input.candidateId, project.id, input.roleName, input.assigneeName).first<Record<string, string | number | null>>();
  if (!candidate) throw new FlowError("候选记录不存在、已失效或与当前角色不匹配；请先从候选池选择。", 409);
  const request = await db.prepare("SELECT id,status FROM resource_requests WHERE project_id=? AND role_name=? AND status IN ('pending','assigned') ORDER BY created_at LIMIT 1").bind(project.id, input.roleName).first<{ id: string; status: string }>();
  const existing = await db.prepare("SELECT id FROM role_assignments WHERE project_id=? AND role_name=?").bind(project.id, input.roleName).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const proactiveRequestId = request?.id ?? crypto.randomUUID();
  const after = JSON.stringify({ id, ...input, candidateSnapshot: candidate, requestId: proactiveRequestId, requestOrigin: request ? "owner_or_system" : "manager_proactive" });
  const activityStatements = await addSystemActivityEvidenceStatements(db, project.id, projectCode, "ACT-SPM-04", { objectType: "RoleAssignment", objectId: id }, input.evidenceRef, actor.id);
  const statements = [
    ...(!request ? [db.prepare("INSERT INTO resource_requests (id,project_id,role_name,requirement,required_by,evidence_ref,status,requested_by) VALUES (?,?,?,?,?,?,?,?)").bind(proactiveRequestId, project.id, input.roleName, `${input.roleName}由销售主管基于当前阶段与项目事实主动配置`, project.bid_date, input.evidenceRef, "assigned", actor.id)] : []),
    db.prepare("INSERT INTO role_assignments (id,project_id,role_name,assignee_name,status,required,evidence_ref,accepted_at,created_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,role_name) DO UPDATE SET assignee_name=excluded.assignee_name,status=excluded.status,required=excluded.required,evidence_ref=excluded.evidence_ref,accepted_at=excluded.accepted_at,updated_at=CURRENT_TIMESTAMP").bind(id, project.id, input.roleName, input.assigneeName, input.status, input.required ? 1 : 0, input.evidenceRef, null, actor.id),
    db.prepare("UPDATE resource_candidates SET status='candidate',selected_by=NULL,selected_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND role_name=? AND status='selected' AND id<>?").bind(project.id, input.roleName, input.candidateId),
    db.prepare("UPDATE resource_candidates SET status='selected',selected_by=?,selected_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('candidate','selected')").bind(actor.id, input.candidateId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "RoleAssignment", id, DOMAIN_EVENTS.roleAssignmentRecorded, after, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ResourceCandidate", input.candidateId, DOMAIN_EVENTS.resourceCandidateSelected, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "资源", existing ? "更新角色指派" : request ? "依据资源需求新增角色指派" : "主管主动新增角色需求并指派", null, after, actor.id),
    db.prepare("UPDATE resource_requests SET status='assigned',assignment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','assigned')").bind(id, proactiveRequestId),
    ...activityStatements,
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ];
  await db.batch(statements);
  if (input.roleName === "技术负责人" && input.status === "待接受") {
    await createExternalTask({
      projectId: project.id,
      projectCode,
      taskType: "TECHNICAL_COLLABORATION",
      assigneeExternalId: String(candidate.source_ref),
      assigneeName: input.assigneeName,
      requestPayload: { roleName: input.roleName, evidenceRef: input.evidenceRef, requestedBy: actor.name },
    });
  }
  return { projectCode, id, assignment: input, readiness: await buildG2Readiness(project.id) };
}

export async function saveSolutionPreparation(projectCode: string, input: SolutionPreparationInput, actor: DemoActor) {
  const project = await editableProject(projectCode, actor, "technical");
  const db = getD1Binding();
  const assignment = await db.prepare("SELECT id FROM role_assignments WHERE project_id=? AND role_name='技术负责人' AND assignee_name=? AND status='已到位'").bind(project.id, actor.name).first();
  if (!assignment) throw new FlowError("当前技术身份不是该项目已指派且已到位的技术负责人。", 403);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM solution_preparation_records WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, version, sourceSystem: "TECHNICAL_COLLABORATION_SIMULATOR", environment: "demo", simulated: true, ...input });
  await db.batch([
    db.prepare("INSERT INTO solution_preparation_records (id,project_id,version,requirement_gaps,technical_difficulty,solution_resource_needs,evidence_ref,source_system,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, version, input.requirementGaps, input.technicalDifficulty, input.solutionResourceNeeds, input.evidenceRef, "TECHNICAL_COLLABORATION_SIMULATOR", "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SolutionPreparationRecord", id, DOMAIN_EVENTS.solutionPreparationRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "投标准备", "接收方案启动准备回传", null, after, actor.id),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, id, version, preparation: input, readiness: await buildG2Readiness(project.id) };
}

export async function saveBidPreparation(projectCode: string, input: BidPreparationInput, actor: DemoActor) {
  const project = await editableProject(projectCode, actor, "bid");
  const db = getD1Binding();
  const context = await db.prepare(`SELECT i.scenario_code,i.intent_type,i.source_snapshot,
    (SELECT id FROM bid_rounds WHERE project_id=p.id AND status='active' ORDER BY round_no DESC LIMIT 1) AS bid_round_id,
    (SELECT tender_document_ref FROM bid_rounds WHERE project_id=p.id AND status='active' ORDER BY round_no DESC LIMIT 1) AS tender_document_ref,
    (SELECT request_ref FROM procurement_requests WHERE project_id=p.id AND status='effective' ORDER BY created_at DESC LIMIT 1) AS procurement_request_ref
    FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?`).bind(project.id).first<Record<string, string | null>>();
  if (!context) throw new FlowError("采购请求上下文不存在。", 409);
  const scenario = SCENARIO_TYPES.find(item => item.code === context.scenario_code);
  if (!scenario || scenario.requestType !== input.sourceType) throw new FlowError("回传的采购请求类型与销售项目业务场景不一致。", 409);
  const sourceSnapshot = jsonRecord(context.source_snapshot);
  const expectedRef = String(context.tender_document_ref ?? context.procurement_request_ref ?? sourceSnapshot.requestRef ?? sourceSnapshot.tenderNo ?? "");
  if (!expectedRef || input.sourceRef !== expectedRef) throw new FlowError("投标准备必须绑定销售项目已登记的采购请求/招标文件引用，不能另填一个无血缘来源。", 409);
  if (input.sourceType === "TenderRequest" && !context.bid_round_id) throw new FlowError("正式招投标必须先由投标管理登记并激活招标轮次。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM bid_preparation_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, version, projectCode, scenarioCode: context.scenario_code, bidRoundId: context.bid_round_id, sourceSystem: "BID_COLLABORATION_SIMULATOR", environment: "demo", simulated: true, ...input });
  await db.batch([
    db.prepare("UPDATE bid_preparation_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO bid_preparation_versions (id,project_id,version,scenario_code,source_type,source_ref,source_version,source_hash,bid_round_id,technical_requirements,commercial_requirements,evaluation_criteria,qualification_requirements,identified_risks,bid_strategy,work_plan,evidence_ref,source_system,status,prepared_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, version, context.scenario_code, input.sourceType, input.sourceRef, input.sourceVersion, input.sourceHash, context.bid_round_id, input.technicalRequirements, input.commercialRequirements, input.evaluationCriteria, input.qualificationRequirements, input.identifiedRisks, input.bidStrategy, JSON.stringify(input.workPlan), input.evidenceRef, "BID_COLLABORATION_SIMULATOR", "effective", actor.id),
    db.prepare("UPDATE bid_rounds SET tender_document_version=COALESCE(tender_document_version,?),tender_document_hash=COALESCE(tender_document_hash,?),latest_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.sourceVersion, input.sourceHash, context.bid_round_id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "BidPreparationVersion", id, DOMAIN_EVENTS.bidPreparationCompleted, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "投标准备", "接收采购请求拆解、投标策略与工作计划", null, after, actor.id),
  ]);
  const commercialTask = await createExternalTask({ projectId: project.id, projectCode, taskType: "COMMERCIAL_SOLUTION", correlationKey: id, assigneeExternalId: "commercial-manager-tang", assigneeName: "唐商务", requestPayload: { bidPreparationVersionId: id, sourceType: input.sourceType, sourceRef: input.sourceRef, sourceVersion: input.sourceVersion, commercialRequirements: input.commercialRequirements, identifiedRisks: input.identifiedRisks } });
  return { projectCode, bidPreparationVersionId: id, version, commercialTask, readiness: await buildG2Readiness(project.id) };
}

export async function saveCommercialSolution(projectCode: string, input: CommercialSolutionInput, actor: DemoActor) {
  const project = await editableProject(projectCode, actor, "commercial");
  const db = getD1Binding();
  const preparation = await db.prepare("SELECT id,version,status FROM bid_preparation_versions WHERE id=? AND project_id=?").bind(input.bidPreparationVersionId, project.id).first<Record<string, string | number>>();
  if (!preparation || preparation.status !== "effective") throw new FlowError("商务方案必须绑定当前有效的投标准备版本。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM commercial_solution_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, version, projectCode, bidPreparationVersion: preparation.version, costingStatus: "pending_costing", sourceSystem: "BID_COLLABORATION_SIMULATOR", environment: "demo", simulated: true, ...input });
  await db.batch([
    db.prepare("UPDATE commercial_solution_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO commercial_solution_versions (id,project_id,version,bid_preparation_version_id,payment_terms,delivery_terms,guarantee_terms,breach_liability,pricing_strategy,quotation_list_ref,commercial_deviations,risk_assessment,mitigation_plan,costing_status,evidence_ref,source_system,status,prepared_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, version, input.bidPreparationVersionId, input.paymentTerms, input.deliveryTerms, input.guaranteeTerms, input.breachLiability, input.pricingStrategy, input.quotationListRef, JSON.stringify(input.commercialDeviations), input.riskAssessment, input.mitigationPlan, "pending_costing", input.evidenceRef, "BID_COLLABORATION_SIMULATOR", "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CommercialSolutionVersion", id, DOMAIN_EVENTS.commercialSolutionCompleted, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "商务方案", "接收商务条款响应、报价清单引用、偏差与风险方案", null, after, actor.id),
  ]);
  return { projectCode, commercialSolutionVersionId: id, version, costingStatus: "pending_costing", readiness: await buildG2Readiness(project.id) };
}

export async function submitG2(projectCode: string, actor: DemoActor) {
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,project_code,owner_user_id,stage,stage_name FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以提交G2双轨输入。", 403);
  if (project.stage !== "S1") throw new FlowError("只有S1项目可以申请G2投入启动门。", 409);
  const readiness = await buildG2Readiness(project.id);
  const missing = readiness.items.filter(item => item.hard && !item.ready);
  if (missing.length) throw new FlowError(`G2来源事实尚未齐套：${missing.map(item => item.label).join("、")}。请回到来源页面补充，阶段门不接受重复录入。`, 409);
  assertGateActivityReady(readiness.activitySnapshot!, "G2");
  const input = readiness.input;
  const existing = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G2'").bind(project.id).first<Record<string, string | number>>();
  if (existing && existing.status !== "returned") throw new FlowError(`G2当前为${existing.status}，不能重复提交。`, 409);
  const gateId = existing ? String(existing.id) : crypto.randomUUID();
  const snapshot = JSON.stringify(readiness);
  const latest = existing ? await db.prepare("SELECT COALESCE(MAX(submission_version),0) AS latest FROM gate_submission_snapshots WHERE gate_instance_id=?").bind(gateId).first<{ latest: number }>() : { latest: 0 };
  const submissionVersion = Number(latest?.latest ?? 0) + 1;
  const before = JSON.stringify({ stage: "S1", gateStatus: existing?.status ?? null });
  const after = JSON.stringify({ stage: "S1", gate: "G2", gateStatus: "pending", submissionVersion, sourceRefs: readiness.items.flatMap(item => item.sourceRefs), input });
  const eventType = existing ? DOMAIN_EVENTS.g2Resubmitted : DOMAIN_EVENTS.g2ApprovalRequested;
  const statements = existing ? [
    db.prepare("UPDATE stage_gate_instances SET status='pending',requested_by=?,requested_at=CURRENT_TIMESTAMP,decided_by=NULL,decision_comment=NULL,decided_at=NULL,updated_at=CURRENT_TIMESTAMP,version=?,definition_version=? WHERE id=? AND status='returned'").bind(actor.id, submissionVersion, GATE_DEFINITION_VERSION, gateId),
  ] : [
    db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,definition_version) VALUES (?,?,?,?,?,?,?,?)").bind(gateId, project.id, "G2", "S1", "S2", "pending", actor.id, GATE_DEFINITION_VERSION),
  ];
  statements.push(
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, submissionVersion, snapshot, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGate", gateId, eventType, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G2", existing ? "重新提交投入启动门" : "提交投入启动门", before, after, actor.id),
  );
  await db.batch(statements);
  return { projectCode, gateId, gateCode: "G2", gateStatus: "pending" as const, stage: "S1" as const, stageName: "立项与策略", input, readiness, submissionVersion };
}

export async function decideG2(gateId: string, action: "approve" | "return", comment: string, actor: DemoActor, decisionContext: { investmentScope: string; priorityAndDeadline: string; returnItems: string }) {
  if (actor.role !== "manager") throw new FlowError("只有销售主管可以批准或退回G2。", 403);
  if (!comment.trim()) throw new FlowError(action === "return" ? "退回必须填写判断意见。" : "批准必须填写投入启动判断意见。", 400);
  if (action === "approve" && !decisionContext.investmentScope) throw new FlowError("批准G2必须明确本阶段投入范围。", 400);
  if (action === "approve" && !decisionContext.priorityAndDeadline) throw new FlowError("批准G2必须明确优先级和期限。", 400);
  if (action === "return" && !decisionContext.returnItems) throw new FlowError("退回G2必须逐项写明需补充的对象和整改要求。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.stage FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G2'").bind(gateId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G2审批实例不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S1") throw new FlowError("G2状态已变化，请刷新后重试。", 409);
  const frozen = jsonRecord(row.input_snapshot) as G2ReadinessSnapshot;
  const currentReadiness = await buildG2Readiness(String(row.project_id));
  if (action === "approve") {
    if (gateSourceFingerprint(currentReadiness) !== gateSourceFingerprint(frozen)) throw new FlowError("G2业务来源在提交后发生变化，必须退回并重新冻结策略、关系、资源和作业启动事实。", 409);
    assertGateActivityReady(currentReadiness.activitySnapshot!, "G2");
    if (activitySnapshotFingerprint(currentReadiness.activitySnapshot) !== activitySnapshotFingerprint(frozen.activitySnapshot)) throw new FlowError("G2活动来源在提交后发生变化，必须退回并重新冻结快照。", 409);
  }
  const next = action === "approve" ? "approved" : "returned";
  const before = JSON.stringify({ stage: "S1", gateStatus: "pending" });
  const decisionOutput = { investmentScope: decisionContext.investmentScope || null, priorityAndDeadline: decisionContext.priorityAndDeadline || null, returnItems: decisionContext.returnItems || null, acceptedRoles: currentReadiness.items.filter(item => item.key === "resourceInvestment").flatMap(item => item.sourceRefs) };
  const after = JSON.stringify({ stage: action === "approve" ? "S2" : "S1", stageName: action === "approve" ? "需求与方案" : "立项与策略", lifecycleStatus: action === "approve" ? "方案中" : "已立项", gateStatus: next, comment, decisionOutput });
  const statements = [
    db.prepare("UPDATE stage_gate_instances SET status=?,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(next, actor.id, comment, gateId, Number(row.version)),
    db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), gateId, Number(row.version), action, comment, actor.id),
  ];
  if (action === "approve") {
    const completedActivities = [
      ...(await completeSystemActivityStatements(db, String(row.project_id), String(row.project_code), "ACT-SPM-02", "G2确认首版策略可支撑本阶段投入", `G2:${gateId}@V${Number(row.version)}`, actor.id)),
      ...(await completeSystemActivityStatements(db, String(row.project_id), String(row.project_code), "ACT-SPM-04", "G2确认当前范围所需责任资源已接受", `G2:${gateId}@V${Number(row.version)}`, actor.id)),
    ];
    statements.push(
      db.prepare("UPDATE sales_projects SET stage='S2',stage_name='需求与方案',lifecycle_status='方案中',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S1'").bind(row.project_id),
      db.prepare("UPDATE project_strategy_versions SET status='approved',approved_by=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND version=(SELECT MAX(version) FROM project_strategy_versions WHERE project_id=?)").bind(actor.id, row.project_id, row.project_id),
      ...completedActivities,
    );
  }
  statements.push(
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, action === "approve" ? DOMAIN_EVENTS.workInitiationApproved : DOMAIN_EVENTS.g2Returned, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G2", action, before, after, actor.id),
  );
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|UNIQUE constraint/i.test(message)) throw new FlowError("审批状态已被其他操作更新，请刷新后重试。", 409);
    throw error;
  }
  return { projectCode: row.project_code, gateCode: "G2", gateStatus: next, stage: action === "approve" ? "S2" : "S1", stageName: action === "approve" ? "需求与方案" : "立项与策略", lifecycleStatus: action === "approve" ? "方案中" : "已立项", comment, decisionOutput };
}

async function s2Project(projectCode: string) {
  const project = await getD1Binding().prepare("SELECT id,project_code,owner_user_id,stage FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S2") throw new FlowError("只有S2项目可以维护需求与方案来源或申请阶段出口确认。", 409);
  return project;
}

export async function saveRequirementSource(projectCode: string, input: RequirementSourceInput, actor: DemoActor) {
  const project = await s2Project(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以记录客户需求原文与来源。", 403);
  const db = getD1Binding();
  const pending = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G3' AND status='pending'").bind(project.id).first();
  if (pending) throw new FlowError("G3需求方案基线门已提交，当前快照不可修改；请等待技术评审人结论或退回。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM requirement_clarification_packages WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, version, originalText: input.originalText, sourceRef: input.sourceRef });
  await db.batch([
    db.prepare("UPDATE requirement_clarification_packages SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO requirement_clarification_packages (id,project_id,version,original_text,source_ref,status,created_by) VALUES (?,?,?,?,?,?,?)").bind(id, project.id, version, input.originalText, input.sourceRef, "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "RequirementClarificationPackage", id, DOMAIN_EVENTS.requirementClarificationRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S2需求澄清", "保存客户需求原文、来源与澄清边界", null, after, actor.id),
    db.prepare("UPDATE project_strategy_versions SET status='stale',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('draft','approved')").bind(project.id),
  ]);
  return { projectCode, id, version, readiness: await buildS2Readiness(project.id) };
}

async function assignedTechnicalProject(projectCode: string, actor: DemoActor, professionalTaskType?: "REQUIREMENT_BASELINE_PREPARATION" | "TECHNICAL_SOLUTION_PREPARATION" | "BOM_AND_CLOSURE_PREPARATION") {
  const project = await s2Project(projectCode);
  if (actor.role !== "technical") throw new FlowError("技术评估必须由技术负责人形成；销售员和销售主管不能代填专业结论。", 403);
  const db = getD1Binding();
  const responsibility = professionalTaskType
    ? await db.prepare("SELECT id FROM external_tasks WHERE project_id=? AND task_type=? AND assignee_external_id=? AND status='accepted' ORDER BY created_at DESC LIMIT 1").bind(project.id, professionalTaskType, actor.id).first()
    : await db.prepare("SELECT id FROM role_assignments WHERE project_id=? AND role_name='技术负责人' AND assignee_name=? AND status='已到位'").bind(project.id, actor.name).first();
  if (!responsibility) throw new FlowError(professionalTaskType ? "当前身份未接受该专业工作包，不能代替其他责任角色回传。" : "当前技术身份不是该项目已指派且已到位的技术负责人。", 403);
  const pending = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G3' AND status='pending'").bind(project.id).first();
  if (pending) throw new FlowError("G3需求方案基线门已提交，当前快照不可修改；请等待技术评审人结论或退回。", 409);
  return project;
}

export async function saveRequirementBaselineCandidate(projectCode: string, input: Pick<TechnicalAssessmentInput, "standardizedRequirement"> & { sourceRef: string }, actor: DemoActor, professionalTaskType?: "REQUIREMENT_BASELINE_PREPARATION") {
  const project = await assignedTechnicalProject(projectCode, actor, professionalTaskType);
  const db = getD1Binding();
  const clarificationPackage = await db.prepare("SELECT id FROM requirement_clarification_packages WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(project.id).first<{ id: string }>();
  if (!clarificationPackage) throw new FlowError("请先由销售Owner确认客户需求原文、来源和待澄清边界，再形成正式需求基线。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM customer_requirement_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const id = crypto.randomUUID();
  const after = JSON.stringify({ id, version, standardizedRequirement: input.standardizedRequirement, sourceRef: input.sourceRef, objectState: "baseline_candidate", sourceSystem: "TECHNICAL_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("UPDATE customer_requirement_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO customer_requirement_versions (id,project_id,version,clarification_package_id,original_text,source_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?)").bind(id, project.id, version, clarificationPackage.id, input.standardizedRequirement, input.sourceRef, "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CustomerRequirementVersion", id, DOMAIN_EVENTS.customerRequirementRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S2需求基线", "形成正式需求基线候选", null, after, actor.id),
  ]);
  return { projectCode, requirementVersionId: id, version, readiness: await buildS2Readiness(project.id) };
}

export async function saveTechnicalSolutionCandidate(projectCode: string, input: Pick<TechnicalAssessmentInput, "designAdoptedValue" | "criticalParameterStatus" | "initialTechnicalSolution" | "solutionEvidenceRef">, actor: DemoActor, professionalTaskType?: "TECHNICAL_SOLUTION_PREPARATION") {
  const project = await assignedTechnicalProject(projectCode, actor, professionalTaskType);
  const db = getD1Binding();
  const requirement = await db.prepare("SELECT id,original_text FROM customer_requirement_versions WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(project.id).first<{ id: string; original_text: string }>();
  if (!requirement) throw new FlowError("请先形成正式需求基线候选。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM technical_solution_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const solutionId = crypto.randomUUID();
  const after = JSON.stringify({ solutionId, version, requirementVersionId: requirement.id, ...input, objectState: "solution_candidate", sourceSystem: "TECHNICAL_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("UPDATE technical_solution_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("UPDATE quotation_design_bom_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO technical_solution_versions (id,project_id,version,requirement_version_id,standardized_requirement,design_adopted_value,critical_parameter_status,initial_technical_solution,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(solutionId, project.id, version, requirement.id, requirement.original_text, input.designAdoptedValue, input.criticalParameterStatus, input.initialTechnicalSolution, input.solutionEvidenceRef, "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "TechnicalSolutionVersion", solutionId, DOMAIN_EVENTS.technicalSolutionRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S2技术方案", "形成绑定当前需求基线的技术方案", null, after, actor.id),
  ]);
  return { projectCode, solutionId, version, readiness: await buildS2Readiness(project.id) };
}

export async function saveBomAndClosure(projectCode: string, input: Pick<TechnicalAssessmentInput, "clarificationQuestion" | "clarificationResponse" | "clarificationStatus" | "clarificationOwnerRole" | "clarificationClosureEvidenceRef" | "deviationDescription" | "deviationStatus" | "deviationEvidenceRef" | "deviationOwnerRole" | "deviationDisposition" | "deviationClosureEvidenceRef" | "configurationSummary" | "bomConfirmationStatus" | "bomEvidenceRef">, actor: DemoActor, professionalTaskType?: "BOM_AND_CLOSURE_PREPARATION") {
  const project = await assignedTechnicalProject(projectCode, actor, professionalTaskType);
  const db = getD1Binding();
  const solution = await db.prepare("SELECT id,requirement_version_id FROM technical_solution_versions WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(project.id).first<{ id: string; requirement_version_id: string }>();
  if (!solution) throw new FlowError("请先形成绑定当前需求基线的技术方案。", 409);
  const latestBom = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM quotation_design_bom_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const bomVersion = Number(latestBom?.latest ?? 0) + 1;
  const bomId = crypto.randomUUID();
  const clarificationId = crypto.randomUUID();
  const deviationId = crypto.randomUUID();
  const after = JSON.stringify({ bomId, bomVersion, technicalSolutionVersionId: solution.id, requirementVersionId: solution.requirement_version_id, ...input, objectState: "closure_candidate", sourceSystem: "TECHNICAL_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("UPDATE quotation_design_bom_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO quotation_design_bom_versions (id,project_id,version,technical_solution_version_id,configuration_summary,confirmation_status,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(bomId, project.id, bomVersion, solution.id, input.configurationSummary, input.bomConfirmationStatus, input.bomEvidenceRef, "effective", actor.id),
    db.prepare("INSERT INTO technical_clarification_items (id,project_id,requirement_version_id,solution_version_id,question,response,status,owner_role,closure_evidence_ref,closed_by,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(clarificationId, project.id, solution.requirement_version_id, solution.id, input.clarificationQuestion, input.clarificationResponse, input.clarificationStatus, input.clarificationOwnerRole, input.clarificationClosureEvidenceRef, input.clarificationStatus === "resolved" ? actor.id : null, actor.id),
    db.prepare("INSERT INTO technical_deviation_records (id,project_id,solution_version_id,description,status,evidence_ref,owner_role,disposition,closure_evidence_ref,closed_by,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(deviationId, project.id, solution.id, input.deviationDescription, input.deviationStatus, input.deviationEvidenceRef, input.deviationOwnerRole, input.deviationDisposition, input.deviationClosureEvidenceRef, actor.id, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "QuotationDesignBOM", bomId, DOMAIN_EVENTS.quotationDesignBomConfirmed, after, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "TechnicalClarificationItem", clarificationId, DOMAIN_EVENTS.technicalClarificationRecorded, after, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "TechnicalDeviationRecord", deviationId, DOMAIN_EVENTS.technicalDeviationRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S2设计与闭环", "形成报价设计BOM及澄清偏差闭环", null, after, actor.id),
  ]);
  return { projectCode, bomId, bomVersion, readiness: await buildS2Readiness(project.id) };
}

export async function saveTechnicalAssessment(projectCode: string, input: TechnicalAssessmentInput, actor: DemoActor) {
  await saveRequirementBaselineCandidate(projectCode, { standardizedRequirement: input.standardizedRequirement, sourceRef: input.solutionEvidenceRef }, actor);
  await saveTechnicalSolutionCandidate(projectCode, input, actor);
  return saveBomAndClosure(projectCode, input, actor);
}

export async function requestG3(projectCode: string, actor: DemoActor) {
  const project = await s2Project(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以提交G3评审申请。", 403);
  const readiness = await buildS2Readiness(project.id);
  const blockers = readiness.items.filter(item => item.hard && !item.ready);
  if (blockers.length) throw new FlowError(`S2来源事实尚未齐套：${blockers.map(item => item.label).join("、")}。请先由对应责任人更新来源，硬阻断未关闭时不能通过G3。`, 409);
  assertGateActivityReady(readiness.activitySnapshot!, "G3");
  const db = getD1Binding();
  const assignment = await db.prepare("SELECT assignee_name FROM role_assignments WHERE project_id=? AND role_name='技术负责人' AND status='已到位' ORDER BY updated_at DESC LIMIT 1").bind(project.id).first<{ assignee_name: string }>();
  if (!assignment) throw new FlowError("尚无已到位的技术负责人，不能确认技术基线。", 409);
  const existing = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G3'").bind(project.id).first<Record<string, string | number>>();
  if (existing && existing.status !== "returned") throw new FlowError(`G3当前为${existing.status}，不能重复提交。`, 409);
  const reviewId = existing ? String(existing.id) : crypto.randomUUID();
  const version = existing ? Number(existing.version) + 1 : 1;
  const snapshot = JSON.stringify(readiness);
  const after = JSON.stringify({ stage: "S2", reviewId, status: "pending", version, submittedBy: actor.name, preparedBy: assignment.assignee_name, reviewerRole: "技术评审人", sourceRefs: readiness.items.flatMap(item => item.sourceRefs) });
  const statements = existing ? [
    db.prepare("UPDATE stage_gate_instances SET status='pending',execution_status='not_required',completed_at=NULL,requested_by=?,requested_at=CURRENT_TIMESTAMP,decided_by=NULL,decision_comment=NULL,decided_at=NULL,version=?,definition_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='returned'").bind(actor.id, version, GATE_DEFINITION_VERSION, reviewId),
  ] : [
    db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,version,definition_version) VALUES (?,?,?,?,?,?,?,?,?)").bind(reviewId, project.id, "G3", "S2", "S3", "pending", actor.id, version, GATE_DEFINITION_VERSION),
  ];
  statements.push(
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), reviewId, version, snapshot, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGate", reviewId, existing ? DOMAIN_EVENTS.g3Resubmitted : DOMAIN_EVENTS.g3ApprovalRequested, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G3", existing ? "重新提交需求方案基线评审" : "提交需求方案基线评审", JSON.stringify({ stage: "S2" }), after, actor.id),
  );
  await db.batch(statements);
  await createExternalTask({ projectId: project.id, projectCode, taskType: "G3_GATE_REVIEW", correlationKey: `${reviewId}:${version}`, assigneeExternalId: "technical-reviewer-wang", assigneeName: "王评审", requestPayload: { gateId: reviewId, gateVersion: version, preparedBy: assignment.assignee_name, sourceRefs: readiness.items.flatMap(item => item.sourceRefs) } });
  return { projectCode, gateId: reviewId, gateCode: "G3" as const, gateStatus: "pending" as const, stage: "S2" as const, stageName: "需求与方案", lifecycleStatus: "方案中", readiness, version, preparedBy: assignment.assignee_name, decisionRole: "技术评审人" };
}

export async function decideG3(reviewId: string, action: "approve" | "return", comment: string, actor: DemoActor) {
  if (actor.role !== "technical_reviewer") throw new FlowError("G3必须由技术评审人确认；技术负责人、销售员和销售主管均无权代批。", 403);
  if (action !== "approve" && action !== "return") throw new FlowError("G3决策动作不合法。", 400);
  if (action === "return" && !comment.trim()) throw new FlowError("退回必须填写补充要求。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.stage FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G3'").bind(reviewId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G3需求方案基线门不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S2") throw new FlowError("G3状态已变化，请刷新后重试。", 409);
  const snapshot = jsonRecord(row.input_snapshot);
  const solution = snapshot.technicalSolutionVersion as Record<string, unknown> | undefined;
  if (String(solution?.created_by ?? "") === actor.id) throw new FlowError("技术方案编制人与技术评审人不能是同一身份。", 409);
  const items = Array.isArray(snapshot.items) ? snapshot.items as Array<Record<string, unknown>> : [];
  const blockers = items.filter(item => item.hard === true && item.ready !== true);
  if (action === "approve" && blockers.length) throw new FlowError(`S2出口硬条件未满足：${blockers.map(item => String(item.label)).join("、")}。BR03关键参数缺失或BR04澄清未闭环时禁止确认。`, 409);
  if (action === "approve" && row.definition_version === GATE_DEFINITION_VERSION) {
    const currentReadiness = await buildS2Readiness(String(row.project_id));
    if (gateSourceFingerprint(currentReadiness) !== gateSourceFingerprint(snapshot as S2ReadinessSnapshot)) throw new FlowError("G3需求、方案、BOM、澄清或偏差来源在提交后发生变化，必须退回并重新冻结技术基线。", 409);
    assertGateActivityReady(currentReadiness.activitySnapshot!, "G3");
    if (activitySnapshotFingerprint(currentReadiness.activitySnapshot) !== activitySnapshotFingerprint((snapshot as S2ReadinessSnapshot).activitySnapshot)) throw new FlowError("G3双轨活动来源在提交后发生变化，必须退回并重新冻结快照。", 409);
  }
  const next = action === "approve" ? "approved" : "returned";
  const before = JSON.stringify({ stage: "S2", reviewStatus: "pending", reviewVersion: row.version });
  const after = JSON.stringify({ stage: action === "approve" ? "S3" : "S2", stageName: action === "approve" ? "核价评审" : "需求与方案", lifecycleStatus: action === "approve" ? "核价定价中" : "方案中", reviewStatus: next, comment, confirmedBy: actor.name, sourceRefs: items.flatMap(item => Array.isArray(item.sourceRefs) ? item.sourceRefs : []) });
  const statements = [
    db.prepare("UPDATE stage_gate_instances SET status=?,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(next, actor.id, comment, reviewId, Number(row.version)),
    db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), reviewId, Number(row.version), action, comment, actor.id),
  ];
  if (action === "approve") {
    statements.push(
      db.prepare("UPDATE sales_projects SET stage='S3',stage_name='核价评审',lifecycle_status='核价定价中',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S2'").bind(row.project_id),
      db.prepare("UPDATE technical_solution_versions SET status='approved',approved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id, String((snapshot.technicalSolutionVersion as Record<string, unknown> | undefined)?.id ?? "")),
      db.prepare("UPDATE quotation_design_bom_versions SET status='approved',approved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id, String((snapshot.quotationDesignBom as Record<string, unknown> | undefined)?.id ?? "")),
    );
  }
  statements.push(
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, action === "approve" ? DOMAIN_EVENTS.customerRequirementBaselined : DOMAIN_EVENTS.g3Returned, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G3", action === "approve" ? "需求方案基线确认通过" : "需求方案基线退回补充", before, after, actor.id),
  );
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|UNIQUE constraint/i.test(message)) throw new FlowError("G3确认状态已被其他操作更新，请刷新后重试。", 409);
    throw error;
  }
  return { projectCode: row.project_code, gateId: reviewId, gateCode: "G3", gateStatus: next, stage: action === "approve" ? "S3" : "S2", stageName: action === "approve" ? "核价评审" : "需求与方案", lifecycleStatus: action === "approve" ? "核价定价中" : "方案中", comment, confirmedBy: actor.name };
}

export async function requestCostingCollaboration(projectCode: string, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("只有销售主管可以依据G3批准基线启动核价专业协同。", 403);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,project_code,stage FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S3") throw new FlowError("只有已通过G3并进入S3的项目可以启动核价专业协同。", 409);
  const baseline = await db.prepare(`SELECT g.id AS gate_id,g.version,s.id AS solution_id,b.id AS bom_id
    FROM stage_gate_instances g
    JOIN technical_solution_versions s ON s.project_id=g.project_id AND s.status='approved'
    JOIN quotation_design_bom_versions b ON b.project_id=g.project_id AND b.technical_solution_version_id=s.id AND b.status='approved' AND b.confirmation_status='confirmed'
    WHERE g.project_id=? AND g.gate_code='G3' AND g.status='approved'
    ORDER BY g.version DESC,s.version DESC,b.version DESC LIMIT 1`).bind(project.id).first<Record<string, string | number>>();
  if (!baseline) throw new FlowError("G3批准技术基线或报价设计BOM不完整，不能启动核价。", 409);
  const existing = await db.prepare("SELECT external_task_id,status FROM external_tasks WHERE project_id=? AND task_type='COSTING_COLLABORATION' AND status IN ('pending','accepted','completed') ORDER BY created_at DESC LIMIT 1").bind(project.id).first<Record<string, string>>();
  if (existing) throw new FlowError(`核价协同任务当前为${existing.status}，不能重复启动。`, 409);
  const task = await createExternalTask({
    projectId: project.id,
    projectCode,
    taskType: "COSTING_COLLABORATION",
    correlationKey: `G3:${String(baseline.gate_id)}@V${String(baseline.version)}`,
    assigneeExternalId: "costing-liu",
    assigneeName: "刘工",
    requestPayload: { gateId: baseline.gate_id, gateVersion: baseline.version, technicalSolutionVersionId: baseline.solution_id, designBomVersionId: baseline.bom_id, initiatedBy: actor.name, assignmentBoundary: "演示适配器固定身份；生产环境由专业资源/核价系统映射实际责任人" },
  });
  return { projectCode, task, initiatedBy: actor.name, authorityBoundary: "销售主管只启动协同，不代替核价人员接受任务或形成核价结果。" };
}

async function s3Project(projectCode: string) {
  const project = await getD1Binding().prepare("SELECT id,project_code,owner_user_id,stage FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S3") throw new FlowError("只有S3项目可以维护核价来源或申请阶段出口确认。", 409);
  return project;
}

export async function saveCostingAssessment(projectCode: string, input: CostingAssessmentInput, actor: DemoActor) {
  const project = await s3Project(projectCode);
  if (actor.role !== "costing") throw new FlowError("核价方案必须由核价专业人员形成；销售角色不能代填成本和利润结论。", 403);
  const db = getD1Binding();
  const pending = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G4' AND status='pending'").bind(project.id).first();
  if (pending) throw new FlowError("G4核价授权门快照已冻结；请先由财务授权人退回后再形成新版本。", 409);
  const technical = await db.prepare("SELECT id FROM technical_solution_versions WHERE project_id=? AND status='approved' ORDER BY version DESC LIMIT 1").bind(project.id).first<{ id: string }>();
  if (!technical) throw new FlowError("尚无S2批准技术方案，不能启动正式核价。", 409);
  const bom = await db.prepare("SELECT id FROM quotation_design_bom_versions WHERE project_id=? AND technical_solution_version_id=? AND status='approved' AND confirmation_status='confirmed' ORDER BY version DESC LIMIT 1").bind(project.id, technical.id).first<{ id: string }>();
  if (!bom) throw new FlowError("当前批准技术方案没有已确认的报价设计BOM；BOM必须返回04B技术方案作业形成，核价人员不能代建。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0) AS latest FROM costing_solution_versions WHERE project_id=?").bind(project.id).first<{ latest: number }>();
  const version = Number(latest?.latest ?? 0) + 1;
  const pricingId = crypto.randomUUID();
  const costingId = crypto.randomUUID();
  const cents = (yuan: number) => Math.round(yuan * 100);
  const totalCostCents = cents(input.materialCostYuan + input.laborCostYuan + input.manufacturingCostYuan + input.transportCostYuan + input.taxCostYuan + input.riskReserveYuan);
  const salesPriceCents = cents(input.costingSalesPriceYuan);
  const grossMarginBp = Math.round(((salesPriceCents - totalCostCents) / salesPriceCents) * 10_000);
  const after = JSON.stringify({ bomId: bom.id, pricingId, costingId, version, technicalSolutionVersionId: technical.id, totalCostCents, salesPriceCents, grossMarginBp, ...input, sourceSystem: "COSTING_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("UPDATE pricing_snapshot_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("UPDATE costing_solution_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(project.id),
    db.prepare("INSERT INTO pricing_snapshot_versions (id,project_id,version,source,source_version,snapshot_date,valid_until,currency,tax_basis,trade_terms,exchange_rate_basis,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(pricingId, project.id, version, input.priceSource, input.priceSourceVersion, input.snapshotDate, input.validUntil, input.currency, input.taxBasis, input.tradeTerms, input.exchangeRateBasis ?? null, input.priceEvidenceRef, "effective", actor.id),
    db.prepare("INSERT INTO costing_solution_versions (id,project_id,version,technical_solution_version_id,design_bom_version_id,pricing_snapshot_id,material_cost_cents,labor_cost_cents,manufacturing_cost_cents,transport_cost_cents,tax_cost_cents,risk_reserve_cents,costing_sales_price_cents,target_profit_rate_bp,gross_margin_bp,calculation_basis,delivery_assessment,delivery_risk_conclusion,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(costingId, project.id, version, technical.id, bom.id, pricingId, cents(input.materialCostYuan), cents(input.laborCostYuan), cents(input.manufacturingCostYuan), cents(input.transportCostYuan), cents(input.taxCostYuan), cents(input.riskReserveYuan), salesPriceCents, Math.round(input.targetProfitRate * 100), grossMarginBp, input.calculationBasis, input.deliveryAssessment, input.deliveryRiskConclusion, "effective", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "PricingSnapshot", pricingId, DOMAIN_EVENTS.pricingSnapshotFrozen, after, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CostingSolutionVersion", costingId, DOMAIN_EVENTS.costingSolutionRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S3核价", "接收核价专业结果回传", null, after, actor.id),
  ]);
  return { projectCode, bomId: bom.id, pricingId, costingId, version, totalCostCents, grossMarginBp, readiness: await buildS3Readiness(project.id) };
}

export async function requestG4(projectCode: string, actor: DemoActor) {
  const project = await s3Project(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以申请G4核价授权门。", 403);
  const readiness = await buildS3Readiness(project.id);
  const blockers = readiness.items.filter(item => item.hard && !item.ready);
  if (blockers.length) throw new FlowError(`G4核价来源尚未齐套：${blockers.map(item => item.label).join("、")}。Gate只引用专业来源，不接受销售重复填写。`, 409);
  assertGateActivityReady(readiness.activitySnapshot!, "G4");
  const db = getD1Binding();
  const scenario = await db.prepare("SELECT i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?").bind(project.id).first<{ scenario_code: ScenarioType }>();
  const activeRoutes = isEpcScenarioCode(String(scenario?.scenario_code ?? "")) ? await db.prepare("SELECT id FROM quotation_routes WHERE project_id=? AND status='active' ORDER BY inquiry_date,created_at").bind(project.id).all<{ id: string }>() : { results: [] as { id: string }[] };
  if (isEpcScenarioCode(String(scenario?.scenario_code ?? "")) && activeRoutes.results.length === 0) throw new FlowError("EPC询价场景必须先登记至少一条有效报价通路，再提交G4价格授权申请。", 409);
  const existing = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G4'").bind(project.id).first<Record<string, string | number>>();
  if (existing && existing.status !== "returned") throw new FlowError(`G4当前为${existing.status}，不能重复提交。`, 409);
  const reviewId = existing ? String(existing.id) : crypto.randomUUID();
  const version = existing ? Number(existing.version) + 1 : 1;
  const pricingSnapshot = readiness.pricingSnapshot as Record<string, unknown>;
  const costingSolution = readiness.costingSolutionVersion as Record<string, unknown>;
  const authorizationRequestId = crypto.randomUUID();
  const pricingAuthorizationRequest = { id: authorizationRequestId, gateId: reviewId, gateVersion: version, costingSolutionVersionId: String(costingSolution.id), pricingSnapshotId: String(pricingSnapshot.id), proposedQuotePriceCents: Number(costingSolution.costing_sales_price_cents), currency: String(pricingSnapshot.currency), taxBasis: String(pricingSnapshot.tax_basis), tradeTerms: String(pricingSnapshot.trade_terms), proposedRouteScope: activeRoutes.results.length ? activeRoutes.results.map(item => item.id).join(",") : "DIRECT", status: "pending" };
  const snapshot = JSON.stringify({ ...readiness, pricingAuthorizationRequest });
  const after = JSON.stringify({ stage: "S3", reviewId, status: "pending", version, sourceRefs: readiness.items.flatMap(item => item.sourceRefs) });
  const externalTaskId = `G4-${projectCode.slice(-6)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const outboxEventId = crypto.randomUUID();
  const statements = existing ? [
    db.prepare("UPDATE stage_gate_instances SET status='pending',requested_by=?,requested_at=CURRENT_TIMESTAMP,decided_by=NULL,decision_comment=NULL,decided_at=NULL,version=?,definition_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='returned'").bind(actor.id, version, GATE_DEFINITION_VERSION, reviewId),
  ] : [
    db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,version,definition_version) VALUES (?,?,?,?,?,?,?,?,?)").bind(reviewId, project.id, "G4", "S3", "S4", "pending", actor.id, version, GATE_DEFINITION_VERSION),
  ];
  statements.push(
    db.prepare("UPDATE price_authorization_requests SET status='returned',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='pending'").bind(project.id),
    db.prepare("INSERT INTO price_authorization_requests (id,project_id,gate_instance_id,gate_version,costing_solution_version_id,pricing_snapshot_id,proposed_quote_price_cents,currency,tax_basis,trade_terms,proposed_route_scope,status,requested_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(authorizationRequestId, project.id, reviewId, version, costingSolution.id, pricingSnapshot.id, costingSolution.costing_sales_price_cents, pricingSnapshot.currency, pricingSnapshot.tax_basis, pricingSnapshot.trade_terms, pricingAuthorizationRequest.proposedRouteScope, actor.id),
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), reviewId, version, snapshot, actor.id),
    db.prepare("INSERT INTO external_tasks (id,project_id,task_type,target_system,external_task_id,assignee_external_id,assignee_name,status,environment,simulated,request_payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G4_GATE_REVIEW", "COSTING_COLLABORATION_SIMULATOR", externalTaskId, "authorizer-luo", "罗总", "pending", "demo", 1, JSON.stringify({ projectCode, gateId: reviewId, gateVersion: version, scenarioCode: scenario?.scenario_code, readinessRefs: readiness.items.flatMap(item => item.sourceRefs), pricingAuthorizationRequest, environment: "demo", simulated: true })),
    db.prepare("INSERT INTO integration_outbox (id,project_id,event_id,event_type,target_system,external_task_id,payload,status,attempts) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, outboxEventId, "G4ReviewRequested", "COSTING_COLLABORATION_SIMULATOR", externalTaskId, JSON.stringify({ eventId: outboxEventId, eventType: "G4ReviewRequested", sourceSystem: "SALES_PROJECT_APP", targetSystem: "COSTING_COLLABORATION_SIMULATOR", projectCode, externalTaskId, assigneeExternalId: "authorizer-luo", assigneeName: "罗总", environment: "demo", simulated: true }), "pending", 0),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", reviewId, existing ? DOMAIN_EVENTS.g4Resubmitted : DOMAIN_EVENTS.g4ApprovalRequested, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G4", existing ? "重新提交核价授权门" : "申请核价授权门", null, after, actor.id),
  );
  await db.batch(statements);
  return { projectCode, gateId: reviewId, gateCode: "G4" as const, gateStatus: "pending" as const, readiness: { ...readiness, pricingAuthorizationRequest }, version, decisionRole: "财务/价格授权人" };
}

export async function decideG4(reviewId: string, action: "approve" | "return", comment: string, actor: DemoActor, authorizationInput?: PricingAuthorizationInput) {
  if (actor.role !== "authorizer") throw new FlowError("G4必须由财务/价格授权人确认，销售员和销售主管无权代批。", 403);
  if (action !== "approve" && action !== "return") throw new FlowError("G4决策动作不合法。", 400);
  if (action === "return" && !comment.trim()) throw new FlowError("退回必须填写补充要求。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.stage,p.amount_cents FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G4'").bind(reviewId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G4核价授权门不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S3") throw new FlowError("G4状态已变化，请刷新后重试。", 409);
  const snapshot = jsonRecord(row.input_snapshot);
  const items = Array.isArray(snapshot.items) ? snapshot.items as Array<Record<string, unknown>> : [];
  const blockers = items.filter(item => item.hard === true && item.ready !== true);
  if (action === "approve" && blockers.length) throw new FlowError(`S3出口硬条件未满足：${blockers.map(item => String(item.label)).join("、")}。`, 409);
  if (action === "approve" && row.definition_version === GATE_DEFINITION_VERSION) {
    const currentReadiness = await buildS3Readiness(String(row.project_id));
    if (gateSourceFingerprint(currentReadiness) !== gateSourceFingerprint(snapshot as S3ReadinessSnapshot)) throw new FlowError("G4技术基线、BOM、价格来源或核价结果在提交后发生变化，必须退回并重新冻结授权申请。", 409);
    assertGateActivityReady(currentReadiness.activitySnapshot!, "G4");
    if (activitySnapshotFingerprint(currentReadiness.activitySnapshot) !== activitySnapshotFingerprint((snapshot as S3ReadinessSnapshot).activitySnapshot)) throw new FlowError("G4双轨活动来源在提交后发生变化，必须退回并重新冻结快照。", 409);
  }
  const costingVersionId = String((snapshot.costingSolutionVersion as Record<string, unknown> | undefined)?.id ?? "");
  const pricingSnapshot = (snapshot.pricingSnapshot as Record<string, unknown> | undefined);
  const authorizationRequest = (snapshot.pricingAuthorizationRequest as Record<string, unknown> | undefined);
  if (action === "approve" && !costingVersionId) throw new FlowError("G4快照缺少核价方案版本，不能形成价格授权。", 409);
  if (action === "approve" && (!pricingSnapshot?.id || !authorizationRequest?.id)) throw new FlowError("G4快照缺少价格来源或独立价格授权申请，必须退回重提。", 409);
  if (action === "approve" && !authorizationInput) throw new FlowError("批准G4必须同时给出底价、授权报价、报价通路、有效期和证据。", 400);
  if (action === "approve" && authorizationInput!.currency !== pricingSnapshot!.currency) throw new FlowError("授权币种必须与冻结价格来源币种一致；币种变化必须退回重新核价。", 409);
  if (action === "approve" && (authorizationInput!.taxBasis !== pricingSnapshot!.tax_basis || authorizationInput!.tradeTerms !== pricingSnapshot!.trade_terms)) throw new FlowError("授权税费或贸易/交付条件必须与冻结价格来源一致；条件变化必须退回重新核价。", 409);
  if (action === "approve" && authorizationInput!.validUntil > String(pricingSnapshot!.valid_until)) throw new FlowError("价格授权有效期不能超过冻结价格来源有效期。", 409);
  const next = action === "approve" ? "approved" : "returned";
  const authorizationId = action === "approve" ? crypto.randomUUID() : null;
  const after = JSON.stringify({ stage: action === "approve" ? "S4" : "S3", stageName: action === "approve" ? "定价与投标" : "核价评审", lifecycleStatus: action === "approve" ? "待商务决策" : "核价定价中", reviewStatus: next, comment, confirmedBy: actor.name, pricingAuthorizationId: authorizationId, authorization: authorizationInput, sourceRefs: items.flatMap(item => Array.isArray(item.sourceRefs) ? item.sourceRefs : []) });
  let bidTaskSeeds: Array<{ correlationKey: string; routeId: string; epcCustomer?: string; expectedSubmissionType: string }> = [];
  const statements = [
    db.prepare("UPDATE stage_gate_instances SET status=?,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(next, actor.id, comment, reviewId, Number(row.version)),
    db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), reviewId, Number(row.version), action, comment, actor.id),
  ];
  if (action === "approve") {
    const authorizationVersion = await db.prepare("SELECT COALESCE(MAX(version),0)+1 AS next_version FROM pricing_authorizations WHERE project_id=?").bind(row.project_id).first<{ next_version: number }>();
    const scenario = await db.prepare("SELECT i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?").bind(row.project_id).first<{ scenario_code: ScenarioType }>();
    const expectedType = expectedSubmissionType(scenario?.scenario_code);
    if (isEpcScenarioCode(String(scenario?.scenario_code ?? ""))) {
      const routes = await db.prepare("SELECT id,epc_customer FROM quotation_routes WHERE project_id=? AND status='active' ORDER BY inquiry_date,created_at").bind(row.project_id).all<{ id: string; epc_customer: string }>();
      const frozenRouteIds = String(authorizationRequest!.proposedRouteScope).split(",").filter(Boolean).sort();
      const currentRouteIds = routes.results.map(route => route.id).sort();
      if (JSON.stringify(currentRouteIds) !== JSON.stringify(frozenRouteIds)) throw new FlowError("G4提交后有效报价通路发生变化，必须退回并重新冻结价格授权申请。", 409);
      if (!routes.results.length) throw new FlowError("EPC询价场景在G4批准前必须至少登记一条有效报价通路。", 409);
      if (routes.results.some(route => !routeAuthorized(authorizationInput!.routeScope, route.id))) throw new FlowError("G4报价通路授权范围未覆盖全部当前有效EPC通路；可使用 ALL-EPC-ROUTES 或明确列出全部通路编号。", 409);
      bidTaskSeeds = routes.results.map(route => ({ correlationKey: route.id, routeId: route.id, epcCustomer: route.epc_customer, expectedSubmissionType: expectedType }));
    } else {
      bidTaskSeeds = [{ correlationKey: String(authorizationInput!.routeScope), routeId: String(authorizationInput!.routeScope).split(/[，,;；\s]+/)[0], expectedSubmissionType: expectedType }];
    }
    statements.push(
      db.prepare("UPDATE sales_projects SET stage='S4',stage_name='定价与投标',lifecycle_status='待商务决策',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S3'").bind(row.project_id),
      db.prepare("UPDATE costing_solution_versions SET status='approved',approved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id, costingVersionId),
      db.prepare("UPDATE pricing_authorizations SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective'").bind(row.project_id),
      db.prepare("INSERT INTO pricing_authorizations (id,project_id,version,costing_solution_version_id,pricing_snapshot_id,floor_price_cents,authorized_quote_price_cents,currency,tax_basis,trade_terms,route_scope,exception_conditions,scope_alignment_conclusion,amount_variance_explanation,valid_until,evidence_ref,status,authorized_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(authorizationId, row.project_id, Number(authorizationVersion?.next_version ?? 1), costingVersionId, pricingSnapshot!.id, Math.round(authorizationInput!.floorPriceYuan * 100), Math.round(authorizationInput!.authorizedQuotePriceYuan * 100), authorizationInput!.currency, authorizationInput!.taxBasis, authorizationInput!.tradeTerms, authorizationInput!.routeScope, authorizationInput!.exceptionConditions, authorizationInput!.scopeAlignmentConclusion, authorizationInput!.amountVarianceExplanation, authorizationInput!.validUntil, authorizationInput!.evidenceRef, "effective", actor.id),
      db.prepare("UPDATE price_authorization_requests SET status='decided',decided_authorization_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(authorizationId, authorizationRequest!.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "PricingAuthorization", authorizationId, DOMAIN_EVENTS.pricingAuthorizationGranted, after, actor.id),
    );
  }
  statements.push(
    ...(action === "return" && authorizationRequest?.id ? [db.prepare("UPDATE price_authorization_requests SET status='returned',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(authorizationRequest.id)] : []),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, action === "approve" ? DOMAIN_EVENTS.costingSolutionApproved : DOMAIN_EVENTS.g4Returned, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G4", action === "approve" ? "核价授权确认通过" : "核价授权退回补充", JSON.stringify({ stage: "S3", gateStatus: "pending", gateVersion: row.version }), after, actor.id),
  );
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|UNIQUE constraint/i.test(message)) throw new FlowError("G4审批状态已被其他操作更新，请刷新后重试。", 409);
    throw error;
  }
  if (action === "approve") {
    for (const seed of bidTaskSeeds) await createExternalTask({ projectId: String(row.project_id), projectCode: String(row.project_code), taskType: "BID_PACKAGE_PREPARATION", correlationKey: seed.correlationKey, assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标", requestPayload: { pricingAuthorizationId: authorizationId, costingSolutionVersionId: costingVersionId, expectedSubmissionType: seed.expectedSubmissionType, routeId: seed.routeId, epcCustomer: seed.epcCustomer, routeScope: authorizationInput!.routeScope, authorizedQuotePriceYuan: authorizationInput!.authorizedQuotePriceYuan, validUntil: authorizationInput!.validUntil } });
  }
  return { projectCode: row.project_code, gateId: reviewId, gateCode: "G4", gateStatus: next, stage: action === "approve" ? "S4" : "S3", stageName: action === "approve" ? "定价与投标" : "核价评审", lifecycleStatus: action === "approve" ? "待商务决策" : "核价定价中", comment, confirmedBy: actor.name, pricingAuthorizationId: authorizationId };
}

async function s4Project(projectCode: string) {
  const project = await getD1Binding().prepare("SELECT p.id,p.project_code,p.owner_user_id,p.stage,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S4") throw new FlowError("只有S4项目可以形成提交包或处理G5。", 409);
  return project;
}

async function epcProject(projectCode: string) {
  const project = await getD1Binding().prepare("SELECT p.id,p.project_code,p.owner_user_id,p.stage,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (!isEpcScenarioCode(String(project.scenario_code))) throw new FlowError("报价通路只适用于EPC或海外伙伴询价场景。", 409);
  return project;
}

export async function createEpcQuotationRoute(projectCode: string, input: EpcQuotationRouteInput, actor: DemoActor) {
  const project = await epcProject(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以登记EPC报价通路。", 403);
  if (!["S1", "S2", "S3", "S4"].includes(project.stage)) throw new FlowError("当前阶段不能新增EPC报价通路。", 409);
  const db = getD1Binding();
  const gate = await db.prepare("SELECT status FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<{ status: string }>();
  if (gate && gate.status !== "returned") throw new FlowError("G5已冻结通路批次；新增通路必须先退回G5。", 409);
  const routeId = crypto.randomUUID();
  const after = JSON.stringify({ routeId, ...input, status: "active", samePricePolicy: "INHERIT_PROJECT_AUTHORIZED_PRICE" });
  try {
    await db.batch([
      db.prepare("INSERT INTO quotation_routes (id,project_id,epc_customer,inquiry_ref,inquiry_date,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?)").bind(routeId, project.id, input.epcCustomer, input.inquiryRef, input.inquiryDate, input.evidenceRef, "active", actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "QuotationRoute", routeId, "EpcQuotationRouteCreated", after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "EPC报价通路", "登记EPC客户询价通路", null, after, actor.id),
    ]);
  } catch (error) {
    if (/quotation_routes_project_customer_uq|UNIQUE constraint/i.test(error instanceof Error ? error.message : String(error))) throw new FlowError("同一项目不能重复登记同一家EPC客户。", 409);
    throw error;
  }
  if (project.stage === "S4") {
    const authorization = await db.prepare("SELECT * FROM pricing_authorizations WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(project.id).first<Record<string, unknown>>();
    if (authorization && routeAuthorized(authorization.route_scope, routeId)) await createExternalTask({
      projectId: project.id, projectCode, taskType: "BID_PACKAGE_PREPARATION", correlationKey: routeId,
      assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标",
      requestPayload: { routeId, epcCustomer: input.epcCustomer, pricingAuthorizationId: authorization.id, expectedSubmissionType: "CustomerRouteQuotation", authorizedQuotePriceYuan: Number(authorization.authorized_quote_price_cents) / 100, validUntil: authorization.valid_until },
    });
  }
  return { projectCode, routeId, status: "active", samePricePolicy: "INHERIT_PROJECT_AUTHORIZED_PRICE" };
}

export async function requestG5Reopen(projectCode: string, input: G5ReopenRequestInput, actor: DemoActor) {
  const project = await epcProject(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以发起G5解冻申请。", 403);
  if (project.stage !== "S4") throw new FlowError("只有仍处于S4的项目可以申请解冻G5；已形成对客提交事实的批次不能回滚。", 409);
  const db = getD1Binding();
  const gate = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<Record<string, string | number>>();
  if (!gate || gate.status === "returned") throw new FlowError("当前G5尚未冻结或已经退回，无需申请解冻，可直接按权限维护通路后重新提交。", 409);
  if (gate.status !== "pending" && gate.status !== "approved") throw new FlowError("当前G5状态不支持解冻申请。", 409);
  if (input.routeId) {
    const route = await db.prepare("SELECT id FROM quotation_routes WHERE id=? AND project_id=? AND status='active'").bind(input.routeId, project.id).first();
    if (!route) throw new FlowError("待变更的EPC报价通路不存在或已停用。", 404);
  }
  const submitted = await db.prepare("SELECT COUNT(*) AS count FROM commercial_submissions WHERE gate_instance_id=? AND gate_version=? AND status='accepted'").bind(gate.id, Number(gate.version)).first<{ count: number }>();
  if (Number(submitted?.count ?? 0) > 0) throw new FlowError("当前G5批次已有正式对客提交回执，不能解冻或撤销。新增、撤回和变价必须按后到询价/跨批次规则处理，该企业规则尚未确认。", 409);
  const existing = await db.prepare("SELECT id,change_type,route_id,status FROM g5_reopen_requests WHERE project_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(project.id).first<Record<string, string | null>>();
  if (existing) {
    if (existing.change_type === input.changeType && String(existing.route_id ?? "") === input.routeId) return { projectCode, requestId: existing.id, status: existing.status, duplicate: true, gateId: gate.id, gateVersion: Number(gate.version) };
    throw new FlowError("该项目已有一项待处理的G5解冻申请，不能并行提交另一项范围变更。", 409);
  }
  const requestId = crypto.randomUUID();
  const after = JSON.stringify({ requestId, projectCode, gateId: gate.id, gateVersion: Number(gate.version), ...input, status: "pending", requestedBy: actor.name });
  await db.batch([
    db.prepare("INSERT INTO g5_reopen_requests (id,project_id,gate_instance_id,gate_version,change_type,route_id,reason,evidence_ref,status,requested_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(requestId, project.id, gate.id, Number(gate.version), input.changeType, input.routeId || null, input.reason, input.evidenceRef, "pending", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "G5ReopenRequest", requestId, "G5ReopenRequested", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G5变更控制", "申请解冻G5冻结批次", JSON.stringify({ gateId: gate.id, gateVersion: gate.version, gateStatus: gate.status }), after, actor.id),
  ]);
  return { projectCode, requestId, status: "pending", gateId: gate.id, gateVersion: Number(gate.version) };
}

export async function decideG5Reopen(requestId: string, action: "approve" | "return" | "reject", comment: string, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("G5解冻必须由原商务决策角色审批。", 403);
  if (!["approve", "return", "reject"].includes(action)) throw new FlowError("G5解冻决策动作不合法。", 400);
  if (!comment.trim()) throw new FlowError("G5解冻决策必须填写意见。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT r.*,p.project_code,p.stage,g.status AS gate_status,g.version AS current_gate_version,g.execution_status FROM g5_reopen_requests r JOIN sales_projects p ON p.id=r.project_id JOIN stage_gate_instances g ON g.id=r.gate_instance_id WHERE r.id=?").bind(requestId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G5解冻申请不存在。", 404);
  if (row.status !== "pending") throw new FlowError("该G5解冻申请已经处理，不能重复审批。", 409);
  const nextStatus = action === "approve" ? "approved" : action === "return" ? "returned" : "rejected";
  const after = JSON.stringify({ requestId, projectCode: row.project_code, gateId: row.gate_instance_id, gateVersion: row.gate_version, changeType: row.change_type, routeId: row.route_id, status: nextStatus, action, comment: comment.trim(), decidedBy: actor.name });
  if (action !== "approve") {
    try {
      await db.batch([
        db.prepare("INSERT INTO g5_reopen_decisions (id,request_id,decision,comment,actor_user_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), requestId, action, comment.trim(), actor.id),
        db.prepare("UPDATE g5_reopen_requests SET status=?,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(nextStatus, actor.id, comment.trim(), requestId),
        db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "G5ReopenRequest", requestId, action === "return" ? "G5ReopenReturned" : "G5ReopenRejected", after, actor.id),
        db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G5变更控制", action === "return" ? "退回G5解冻申请" : "拒绝G5解冻申请", JSON.stringify({ status: "pending" }), after, actor.id),
      ]);
    } catch (error) {
      if (/g5_reopen_decisions_request_uq|UNIQUE constraint/i.test(error instanceof Error ? error.message : String(error))) throw new FlowError("该G5解冻申请已被其他操作处理，请刷新。", 409);
      throw error;
    }
    return { projectCode: row.project_code, requestId, status: nextStatus, gateStatus: row.gate_status };
  }
  if (row.stage !== "S4" || !["pending", "approved"].includes(String(row.gate_status)) || Number(row.current_gate_version) !== Number(row.gate_version)) throw new FlowError("项目阶段或G5版本已经变化，请重新核实申请。", 409);
  const submissions = await db.prepare("SELECT COUNT(*) AS count FROM commercial_submissions WHERE gate_instance_id=? AND gate_version=? AND status='accepted'").bind(row.gate_instance_id, Number(row.gate_version)).first<{ count: number }>();
  if (Number(submissions?.count ?? 0) > 0) throw new FlowError("审批期间已收到正式对客提交回执，G5不能再解冻；本申请必须拒绝并转入跨批次业务判断。", 409);
  const snapshotRow = await db.prepare("SELECT input_snapshot FROM gate_submission_snapshots WHERE gate_instance_id=? AND submission_version=?").bind(row.gate_instance_id, Number(row.gate_version)).first<{ input_snapshot: unknown }>();
  const snapshot = jsonRecord(snapshotRow?.input_snapshot);
  const frozenPackages = (Array.isArray(snapshot.bidPackageVersions) ? snapshot.bidPackageVersions : snapshot.bidPackageVersion ? [snapshot.bidPackageVersion] : []) as Array<Record<string, unknown>>;
  const openTasks = await db.prepare("SELECT id,external_task_id,target_system FROM external_tasks WHERE project_id=? AND task_type='G5_SUBMISSION_EXECUTION' AND status IN ('pending','accepted') AND json_extract(request_payload,'$.gateId')=? AND CAST(json_extract(request_payload,'$.gateVersion') AS INTEGER)=?").bind(row.project_id, row.gate_instance_id, Number(row.gate_version)).all<Record<string, string>>();
  const statements = [
    db.prepare("INSERT INTO g5_reopen_decisions (id,request_id,decision,comment,actor_user_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), requestId, action, comment.trim(), actor.id),
    db.prepare("UPDATE g5_reopen_requests SET status='approved',decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(actor.id, comment.trim(), requestId),
    db.prepare("UPDATE stage_gate_instances SET status='returned',execution_status='not_required',completed_at=NULL,decision_comment=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND status IN ('pending','approved')").bind(`变更控制解冻：${comment.trim()}`, row.gate_instance_id, Number(row.gate_version)),
    ...frozenPackages.map(item => db.prepare("UPDATE bid_package_versions SET status='prepared',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='frozen'").bind(String(item.id))),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "G5ReopenRequest", requestId, "G5ReopenApproved", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G5变更控制", "批准解冻尚未执行的G5批次", JSON.stringify({ gateStatus: row.gate_status, gateVersion: row.gate_version, formalSubmissions: 0 }), after, actor.id),
  ];
  for (const task of openTasks.results) {
    const cancellationEventId = crypto.randomUUID();
    statements.push(
      db.prepare("UPDATE external_tasks SET status='cancelled',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','accepted')").bind(JSON.stringify({ reason: "G5受控解冻，原冻结版本提交授权已撤销", requestId }), task.id),
      db.prepare("UPDATE external_activity_projections SET status='cancelled',blocker=?,source_event_id=?,source_updated_at=?,synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE external_activity_instance_id=?").bind("G5受控解冻，等待新版本重新授权", cancellationEventId, new Date().toISOString(), task.external_task_id),
      db.prepare("INSERT INTO integration_outbox (id,project_id,event_id,event_type,target_system,external_task_id,payload,status,attempts) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, cancellationEventId, "ExternalTaskCancelled", task.target_system, task.external_task_id, JSON.stringify({ eventId: cancellationEventId, eventType: "ExternalTaskCancelled", targetSystem: task.target_system, externalTaskId: task.external_task_id, projectCode: row.project_code, reason: "G5受控解冻", requestId }), "pending", 0),
    );
  }
  try { await db.batch(statements); }
  catch (error) {
    if (/g5_reopen_decisions_request_uq|UNIQUE constraint/i.test(error instanceof Error ? error.message : String(error))) throw new FlowError("该G5解冻申请已被其他操作处理，请刷新。", 409);
    throw error;
  }
  return { projectCode: row.project_code, requestId, status: "approved", gateId: row.gate_instance_id, gateVersion: Number(row.gate_version), gateStatus: "returned", cancelledTaskCount: openTasks.results.length };
}

export async function withdrawEpcQuotationRoute(projectCode: string, routeId: string, reason: string, evidenceRef: string, actor: DemoActor) {
  const project = await epcProject(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以撤回EPC报价通路。", 403);
  if (!["S1", "S2", "S3", "S4"].includes(project.stage)) throw new FlowError("当前阶段不能撤回EPC报价通路。", 409);
  const normalizedReason = requiredText(reason, "通路撤回原因", 2000);
  const normalizedEvidence = requiredText(evidenceRef, "通路撤回依据", 1000);
  const db = getD1Binding();
  const gate = await db.prepare("SELECT status FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<{ status: string }>();
  if (gate && gate.status !== "returned") throw new FlowError("G5批次已冻结；必须先提交解冻申请并由销售主管批准。", 409);
  const route = await db.prepare("SELECT * FROM quotation_routes WHERE id=? AND project_id=? AND status='active'").bind(routeId, project.id).first<Record<string, string | number | null>>();
  if (!route) throw new FlowError("EPC报价通路不存在或已撤回。", 404);
  const submission = await db.prepare("SELECT id FROM commercial_submissions WHERE project_id=? AND route_id=? AND status='accepted' LIMIT 1").bind(project.id, routeId).first();
  if (submission) throw new FlowError("该通路已经存在正式对客提交回执，不能撤回或删除；必须保留并等待正式结果。", 409);
  const activeCount = await db.prepare("SELECT COUNT(*) AS count FROM quotation_routes WHERE project_id=? AND status='active'").bind(project.id).first<{ count: number }>();
  if (Number(activeCount?.count ?? 0) <= 1) throw new FlowError("不能撤回项目最后一条有效EPC报价通路；如采购机会整体终止，应走G5不投/不报决策。", 409);
  const openTasks = await db.prepare("SELECT id,external_task_id,target_system FROM external_tasks WHERE project_id=? AND task_type IN ('BID_PACKAGE_PREPARATION','EPC_PRICE_EXCEPTION_APPROVAL') AND status IN ('pending','accepted') AND json_extract(request_payload,'$.routeId')=?").bind(project.id, routeId).all<Record<string, string>>();
  const after = JSON.stringify({ projectCode, routeId, epcCustomer: route.epc_customer, previousStatus: route.status, status: "withdrawn", reason: normalizedReason, evidenceRef: normalizedEvidence, withdrawnBy: actor.name });
  const statements = [
    db.prepare("UPDATE quotation_routes SET status='withdrawn',updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=? AND status='active'").bind(routeId, project.id),
    db.prepare("UPDATE bid_package_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND route_id=? AND status IN ('prepared','frozen')").bind(project.id, routeId),
    db.prepare("UPDATE epc_price_exceptions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND route_id=? AND status IN ('pending','approved')").bind(project.id, routeId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "QuotationRoute", routeId, "EpcQuotationRouteWithdrawn", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "EPC报价通路", "撤回尚未对客提交的EPC通路", JSON.stringify(route), after, actor.id),
  ];
  for (const task of openTasks.results) statements.push(
    db.prepare("UPDATE external_tasks SET status='cancelled',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','accepted')").bind(JSON.stringify({ reason: normalizedReason, evidenceRef: normalizedEvidence }), task.id),
    db.prepare("UPDATE external_activity_projections SET status='cancelled',blocker=?,source_updated_at=?,synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE external_activity_instance_id=?").bind("对应EPC报价通路已撤回", new Date().toISOString(), task.external_task_id),
  );
  await db.batch(statements);
  return { projectCode, routeId, status: "withdrawn", cancelledTaskCount: openTasks.results.length, readiness: await buildG5Readiness(project.id) };
}

export async function requestEpcPriceException(projectCode: string, input: EpcPriceExceptionInput, actor: DemoActor) {
  const project = await epcProject(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以发起EPC通路价格例外。", 403);
  if (project.stage !== "S4") throw new FlowError("通路价格例外只能在S4、G5冻结前申请。", 409);
  const db = getD1Binding();
  const gate = await db.prepare("SELECT status FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<{ status: string }>();
  if (gate && gate.status !== "returned") throw new FlowError("G5已冻结，不能改变通路报价。", 409);
  const [route, authorization] = await Promise.all([
    db.prepare("SELECT * FROM quotation_routes WHERE id=? AND project_id=? AND status='active'").bind(input.routeId, project.id).first<Record<string, unknown>>(),
    db.prepare("SELECT * FROM pricing_authorizations WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(project.id).first<Record<string, unknown>>(),
  ]);
  if (!route) throw new FlowError("EPC报价通路不存在或已停用。", 404);
  if (!authorization) throw new FlowError("当前没有有效价格授权，必须先完成G4。", 409);
  const today = new Date().toISOString().slice(0, 10);
  if (String(authorization.valid_until) < today) throw new FlowError("项目价格授权已过期，必须返回G4。", 409);
  if (input.validUntil > String(authorization.valid_until)) throw new FlowError("通路例外有效期不能超过项目价格授权有效期。", 409);
  if (input.validUntil < today) throw new FlowError("通路例外有效期已过。", 409);
  const requestedPriceCents = Math.round(input.requestedPriceYuan * 100);
  if (requestedPriceCents < Number(authorization.floor_price_cents)) throw new FlowError("通路例外报价不得低于G4授权底价；低于底价必须返回G4重新核价授权。", 409);
  if (requestedPriceCents === Number(authorization.authorized_quote_price_cents)) throw new FlowError("该报价与项目统一授权报价相同，无需申请例外。", 409);
  const exceptionId = crypto.randomUUID();
  const after = JSON.stringify({ exceptionId, epcCustomer: route.epc_customer, pricingAuthorizationId: authorization.id, requestedPriceCents, ...input, status: "pending" });
  try {
    await db.batch([
      db.prepare("INSERT INTO epc_price_exceptions (id,project_id,route_id,pricing_authorization_id,requested_price_cents,reason,evidence_ref,valid_until,status,requested_by) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(exceptionId, project.id, input.routeId, authorization.id, requestedPriceCents, input.reason, input.evidenceRef, input.validUntil, "pending", actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "EpcPriceException", exceptionId, "EpcPriceExceptionRequested", after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "EPC价格例外", "申请通路差异报价", null, after, actor.id),
    ]);
  } catch (error) {
    if (/epc_price_exceptions_route_open_uq|UNIQUE constraint/i.test(error instanceof Error ? error.message : String(error))) throw new FlowError("该EPC通路已有待审批或已批准的价格例外。", 409);
    throw error;
  }
  const task = await createExternalTask({ projectId: project.id, projectCode, taskType: "EPC_PRICE_EXCEPTION_APPROVAL", correlationKey: input.routeId, assigneeExternalId: "authorizer-luo", assigneeName: "罗总", requestPayload: { exceptionId, routeId: input.routeId, epcCustomer: route.epc_customer, baseAuthorizedPriceYuan: Number(authorization.authorized_quote_price_cents) / 100, floorPriceYuan: Number(authorization.floor_price_cents) / 100, requestedPriceYuan: input.requestedPriceYuan, reason: input.reason, evidenceRef: input.evidenceRef, validUntil: input.validUntil } });
  return { projectCode, exceptionId, routeId: input.routeId, status: "pending", externalTaskId: task.externalTaskId };
}

export async function decideEpcPriceException(exceptionId: string, action: "approve" | "return" | "reject", comment: string, actor: DemoActor) {
  if (actor.role !== "authorizer") throw new FlowError("EPC通路价格例外必须由价格授权人审批。", 403);
  if (!["approve", "return", "reject"].includes(action)) throw new FlowError("价格例外决策动作不合法。", 400);
  if (!comment.trim()) throw new FlowError("价格例外审批必须填写意见。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT e.*,p.project_code,p.stage,a.status AS authorization_status,a.floor_price_cents,a.authorized_quote_price_cents,a.valid_until AS authorization_valid_until FROM epc_price_exceptions e JOIN sales_projects p ON p.id=e.project_id JOIN pricing_authorizations a ON a.id=e.pricing_authorization_id WHERE e.id=?").bind(exceptionId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("EPC通路价格例外不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S4") throw new FlowError("价格例外状态或项目阶段已变化，请刷新。", 409);
  if (action === "approve") {
    const today = new Date().toISOString().slice(0, 10);
    if (row.authorization_status !== "effective" || String(row.authorization_valid_until) < today || String(row.valid_until) < today) throw new FlowError("项目价格授权或例外有效期已失效，不能批准。", 409);
    if (Number(row.requested_price_cents) < Number(row.floor_price_cents)) throw new FlowError("例外报价低于当前授权底价，必须返回G4。", 409);
  }
  const status = action === "approve" ? "approved" : action === "return" ? "returned" : "rejected";
  const after = JSON.stringify({ exceptionId, routeId: row.route_id, status, action, comment, decidedBy: actor.name });
  await db.batch([
    db.prepare("UPDATE epc_price_exceptions SET status=?,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(status, actor.id, comment.trim(), exceptionId),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "EpcPriceException", exceptionId, action === "approve" ? "EpcPriceExceptionApproved" : action === "return" ? "EpcPriceExceptionReturned" : "EpcPriceExceptionRejected", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "EPC价格例外", action === "approve" ? "批准通路差异报价" : action === "return" ? "退回通路差异报价" : "拒绝通路差异报价", JSON.stringify({ status: "pending" }), after, actor.id),
  ]);
  return { projectCode: row.project_code, exceptionId, routeId: row.route_id, status };
}

export async function saveBidPackage(projectCode: string, input: BidPackageInput, actor: DemoActor) {
  if (actor.role !== "bid") throw new FlowError("最终提交包必须由投标作业责任人形成，销售角色不能代填。", 403);
  const project = await s4Project(projectCode);
  const db = getD1Binding();
  const gate = await db.prepare("SELECT status FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<{ status: string }>();
  if (gate && gate.status !== "returned") throw new FlowError("G5快照已冻结或已决策；如需改包，必须先退回G5。", 409);
  const facts = await loadG5SourceFacts(project.id);
  if (!facts.costing || !facts.authorization || facts.g4?.status !== "approved") throw new FlowError("G4核价与价格授权尚未生效，不能形成正式提交包。", 409);
  const today = new Date().toISOString().slice(0, 10);
  if (String(facts.authorization.valid_until) < today) throw new FlowError("价格授权已过期，必须返回G4重新授权。", 409);
  if (facts.authorization.costing_solution_version_id !== facts.costing.id) throw new FlowError("价格授权未绑定当前批准核价版本，必须返回G4。", 409);
  const expectedType = expectedSubmissionType(project.scenario_code);
  if (input.submissionType !== expectedType) throw new FlowError(`当前场景要求${expectedType}，不能使用${input.submissionType}。`, 409);
  if (!routeAuthorized(facts.authorization.route_scope, input.routeId)) throw new FlowError("提交通路不在G4授权范围内，必须返回G4补充授权。", 409);
  const quotedPriceCents = Math.round(input.quotedPriceYuan * 100);
  if (quotedPriceCents < Number(facts.authorization.floor_price_cents)) throw new FlowError("最终报价低于授权底价，按BR19必须先返回G4走价格例外授权。", 409);
  let expectedPriceCents = Number(facts.authorization.authorized_quote_price_cents);
  let priceExceptionId: string | undefined;
  if (isEpcScenarioCode(String(project.scenario_code))) {
    const route = await db.prepare("SELECT id FROM quotation_routes WHERE id=? AND project_id=? AND status='active'").bind(input.routeId, project.id).first<{ id: string }>();
    if (!route) throw new FlowError("提交包必须绑定本项目有效的EPC报价通路。", 409);
    const pendingException = facts.priceExceptions.find(item => item.status === "pending" && String(item.route_id) === input.routeId);
    if (pendingException) throw new FlowError("该通路价格例外仍在审批中，不能形成正式提交包。", 409);
    const approvedException = facts.priceExceptions.find(item => item.status === "approved" && String(item.route_id) === input.routeId && String(item.pricing_authorization_id) === String(facts.authorization!.id) && String(item.valid_until) >= today);
    if (approvedException) {
      expectedPriceCents = Number(approvedException.requested_price_cents);
      priceExceptionId = String(approvedException.id);
    }
  }
  if (quotedPriceCents !== expectedPriceCents) throw new FlowError(isEpcScenarioCode(String(project.scenario_code)) ? "该EPC/伙伴通路报价必须等于项目统一授权价；如确需不同，必须先由价格授权人批准通路例外。" : "最终报价与G4授权报价不一致，必须返回G4重新授权，不能在G5静默变价。", 409);
  const latest = await db.prepare("SELECT COALESCE(MAX(version),0)+1 AS next_version FROM bid_package_versions WHERE project_id=?").bind(project.id).first<{ next_version: number }>();
  const packageId = crypto.randomUUID();
  const after = JSON.stringify({ packageId, version: Number(latest?.next_version ?? 1), costingSolutionVersionId: facts.costing.id, pricingAuthorizationId: facts.authorization.id, priceExceptionId, expectedPriceCents, ...input, sourceSystem: "BID_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("UPDATE bid_package_versions SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND route_id=? AND status='prepared'").bind(project.id, input.routeId),
    db.prepare("INSERT INTO bid_package_versions (id,project_id,version,costing_solution_version_id,pricing_authorization_id,submission_type,route_id,quoted_price_cents,package_hash,evidence_ref,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(packageId, project.id, Number(latest?.next_version ?? 1), facts.costing.id, facts.authorization.id, input.submissionType, input.routeId, quotedPriceCents, input.packageHash, input.evidenceRef, "prepared", actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "BidPackageVersion", packageId, DOMAIN_EVENTS.bidPackagePrepared, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S4投标", "接收最终提交包", null, after, actor.id),
  ]);
  const reviewerByType: Record<ProfessionalReviewInput["reviewType"], { id: DemoActor["id"]; name: string }> = {
    business: { id: "professional-reviewer-wu", name: "吴商务评审" },
    technical: { id: "bid-technical-reviewer-qian", name: "钱技术评审" },
    qualification: { id: "qualification-reviewer-he", name: "何资质评审" },
  };
  const requiredReviewTypes = professionalReviewTypesForScenario(project.scenario_code);
  const reviewTasks = await Promise.all(requiredReviewTypes.map(reviewType => createExternalTask({
    projectId: project.id,
    projectCode,
    taskType: "BID_PACKAGE_REVIEW",
    correlationKey: `${packageId}:${reviewType}`,
    assigneeExternalId: reviewerByType[reviewType].id,
    assigneeName: reviewerByType[reviewType].name,
    requestPayload: { bidPackageVersionId: packageId, reviewType, reviewLabel: PROFESSIONAL_REVIEW_LABELS[reviewType], routeId: input.routeId, packageHash: input.packageHash, evidenceRef: input.evidenceRef },
  })));
  return { projectCode, packageId, version: Number(latest?.next_version ?? 1), reviewTasks, reviewPolicy: requiredReviewTypes.length ? "full" : "conditional_not_triggered", readiness: await buildG5Readiness(project.id) };
}

export async function saveProfessionalReview(projectCode: string, input: ProfessionalReviewInput, actor: DemoActor) {
  if (actor.role !== "professional_reviewer") throw new FlowError("投标包专业评审必须由专业评审人形成；投标包编制人无权自审。", 403);
  const project = await s4Project(projectCode);
  const db = getD1Binding();
  const bidPackage = await db.prepare("SELECT id,created_by,status FROM bid_package_versions WHERE id=? AND project_id=? AND status='prepared'").bind(input.bidPackageVersionId, project.id).first<Record<string, string>>();
  if (!bidPackage) throw new FlowError("待评审投标包不存在、已冻结或已失效。", 409);
  if (bidPackage.created_by === actor.id) throw new FlowError("投标包编制人与专业评审人不能是同一身份。", 409);
  const existing = await db.prepare("SELECT * FROM professional_reviews WHERE bid_package_version_id=? AND review_type=? AND status='effective'").bind(input.bidPackageVersionId, input.reviewType).first<Record<string, string | number | null>>();
  let remediation: Record<string, string | number | null> | null = null;
  if (existing) {
    if (!input.remediationId) throw new FlowError(`该投标包已经形成${PROFESSIONAL_REVIEW_LABELS[input.reviewType]}结论；必须先由投标专员提交整改证据，再由原评审人复核。`, 409);
    remediation = await db.prepare("SELECT * FROM professional_review_remediations WHERE id=? AND professional_review_id=? AND bid_package_version_id=? AND review_type=? AND status='submitted'").bind(input.remediationId, existing.id, input.bidPackageVersionId, input.reviewType).first<Record<string, string | number | null>>() ?? null;
    if (!remediation) throw new FlowError("整改记录不存在、未提交或与原评审不匹配。", 409);
    if (existing.reviewed_by !== actor.id) throw new FlowError("整改复核必须由原专业评审人完成。", 403);
  } else if (input.remediationId) {
    throw new FlowError("未找到需要复核的原专业评审。", 409);
  }
  const reviewId = crypto.randomUUID();
  const version = Number(existing?.version ?? 0) + 1;
  const reviewPassed = input.reviewConclusion === "approved" && input.openRiskCount === 0;
  const after = JSON.stringify({ reviewId, projectCode, version, reviewedBy: actor.name, priorReviewId: existing?.id ?? null, ...input, sourceSystem: "BID_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    ...(existing ? [db.prepare("UPDATE professional_reviews SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='effective'").bind(existing.id)] : []),
    db.prepare("INSERT INTO professional_reviews (id,project_id,bid_package_version_id,review_type,version,status,remediation_id,conclusion,open_risk_count,deviation_conclusion,review_summary,evidence_ref,reviewed_by) VALUES (?,?,?,?,?,'effective',?,?,?,?,?,?,?)").bind(reviewId, project.id, input.bidPackageVersionId, input.reviewType, version, remediation?.id ?? null, input.reviewConclusion, input.openRiskCount, input.deviationConclusion, input.reviewSummary, input.evidenceRef, actor.id),
    ...(remediation ? [db.prepare("UPDATE professional_review_remediations SET status=?,verified_by=?,verification_comment=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(reviewPassed ? "verified" : "returned", actor.id, input.reviewSummary, remediation.id)] : []),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProfessionalReview", reviewId, DOMAIN_EVENTS.bidReviewCompleted, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S4投标", remediation ? `复核${PROFESSIONAL_REVIEW_LABELS[input.reviewType]}整改` : `接收${PROFESSIONAL_REVIEW_LABELS[input.reviewType]}结论`, existing ? JSON.stringify(existing) : null, after, actor.id),
  ]);
  const remediationTask = !reviewPassed ? await createExternalTask({ projectId: project.id, projectCode, taskType: "BID_REVIEW_REMEDIATION", correlationKey: reviewId, assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标", requestPayload: { professionalReviewId: reviewId, bidPackageVersionId: input.bidPackageVersionId, reviewType: input.reviewType, reviewLabel: PROFESSIONAL_REVIEW_LABELS[input.reviewType], reviewSummary: input.reviewSummary, openRiskCount: input.openRiskCount, reviewerId: actor.id, reviewerName: actor.name } }) : undefined;
  return { projectCode, reviewId, bidPackageVersionId: input.bidPackageVersionId, remediationTask, readiness: await buildG5Readiness(project.id) };
}

export async function saveProfessionalReviewRemediation(projectCode: string, input: ProfessionalReviewRemediationInput, actor: DemoActor) {
  if (actor.role !== "bid") throw new FlowError("评审问题整改必须由投标包责任人提交。", 403);
  const project = await s4Project(projectCode);
  const db = getD1Binding();
  const review = await db.prepare("SELECT * FROM professional_reviews WHERE id=? AND project_id=? AND status='effective' AND (conclusion='rejected' OR open_risk_count>0)").bind(input.professionalReviewId, project.id).first<Record<string, string | number | null>>();
  if (!review) throw new FlowError("待整改的有效专业评审不存在或已被复核。", 409);
  const existing = await db.prepare("SELECT id FROM professional_review_remediations WHERE professional_review_id=?").bind(review.id).first();
  if (existing) throw new FlowError("该评审问题已经提交整改，不能覆盖原记录。", 409);
  const remediationId = crypto.randomUUID();
  const after = JSON.stringify({ remediationId, projectCode, ...input, reviewType: review.review_type, submittedBy: actor.name, sourceSystem: "BID_COLLABORATION_SIMULATOR", environment: "demo", simulated: true });
  await db.batch([
    db.prepare("INSERT INTO professional_review_remediations (id,project_id,professional_review_id,bid_package_version_id,review_type,issue_response,evidence_ref,status,submitted_by) VALUES (?,?,?,?,?,?,?,'submitted',?)").bind(remediationId, project.id, review.id, review.bid_package_version_id, review.review_type, input.issueResponse, input.evidenceRef, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProfessionalReviewRemediation", remediationId, "BidReviewRemediationSubmitted", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "S4投标", `提交${PROFESSIONAL_REVIEW_LABELS[String(review.review_type) as ProfessionalReviewInput["reviewType"]]}整改证据`, JSON.stringify(review), after, actor.id),
  ]);
  const reviewer = await db.prepare("SELECT display_name FROM users WHERE id=?").bind(review.reviewed_by).first<{ display_name: string }>();
  const reReviewTask = await createExternalTask({ projectId: project.id, projectCode, taskType: "BID_PACKAGE_REVIEW", correlationKey: remediationId, assigneeExternalId: String(review.reviewed_by), assigneeName: String(reviewer?.display_name ?? review.reviewed_by), requestPayload: { bidPackageVersionId: review.bid_package_version_id, reviewType: review.review_type, reviewLabel: PROFESSIONAL_REVIEW_LABELS[String(review.review_type) as ProfessionalReviewInput["reviewType"]], remediationId, priorReviewId: review.id, issueResponse: input.issueResponse, remediationEvidenceRef: input.evidenceRef } });
  return { projectCode, remediationId, reReviewTask, readiness: await buildG5Readiness(project.id) };
}

export async function requestG5(projectCode: string, actor: DemoActor) {
  const project = await s4Project(projectCode);
  if (actor.role !== "sales" || project.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以提交G5商务决策与提交门。", 403);
  const readiness = await buildG5Readiness(project.id);
  const blockers = readiness.items.filter(item => item.hard && !item.ready);
  if (blockers.length) throw new FlowError(`G5来源尚未齐套：${blockers.map(item => item.label).join("、")}。销售员只发起决策，不重复填写投标专业数据。`, 409);
  assertGateActivityReady(readiness.activitySnapshot!, "G5");
  const db = getD1Binding();
  const existing = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G5'").bind(project.id).first<Record<string, string | number>>();
  if (existing && existing.status !== "returned") throw new FlowError(`G5当前为${existing.status}，不能重复提交。`, 409);
  const gateId = existing ? String(existing.id) : crypto.randomUUID();
  const version = existing ? Number(existing.version) + 1 : 1;
  const packageIds = (readiness.bidPackageVersions ?? (readiness.bidPackageVersion ? [readiness.bidPackageVersion] : [])).map(item => String(item.id));
  const snapshot = JSON.stringify(readiness);
  const after = JSON.stringify({ stage: "S4", gateId, gateCode: "G5", status: "pending", version, packageIds, sourceRefs: readiness.items.flatMap(item => item.sourceRefs) });
  const statements = existing ? [
    db.prepare("UPDATE stage_gate_instances SET status='pending',execution_status='not_required',completed_at=NULL,requested_by=?,requested_at=CURRENT_TIMESTAMP,decided_by=NULL,decision_comment=NULL,decided_at=NULL,version=?,definition_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='returned'").bind(actor.id, version, GATE_DEFINITION_VERSION, gateId),
  ] : [
    db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,version,definition_version) VALUES (?,?,?,?,?,?,?,?,?)").bind(gateId, project.id, "G5", "S4", "S5", "pending", actor.id, version, GATE_DEFINITION_VERSION),
  ];
  statements.push(
    ...packageIds.map(packageId => db.prepare("UPDATE bid_package_versions SET status='frozen',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='prepared'").bind(packageId)),
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, version, snapshot, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, existing ? DOMAIN_EVENTS.g5Resubmitted : DOMAIN_EVENTS.g5ApprovalRequested, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G5", existing ? "重新提交商务决策与提交门" : "提交商务决策与提交门", null, after, actor.id),
  );
  await db.batch(statements);
  return { projectCode, gateId, gateCode: "G5" as const, gateStatus: "pending" as const, stage: "S4" as const, readiness, version, decisionRole: "销售主管/投标授权决策人" };
}

export async function decideG5(gateId: string, action: "approve_submit" | "return" | "decline", comment: string, actor: DemoActor, riskAcceptance?: { accepted: boolean; reason: string }, deviationAuthorizations: G5DeviationAuthorizationInput[] = []) {
  if (actor.role !== "manager") throw new FlowError("G5经营决策必须由销售主管/投标授权决策人作出。", 403);
  if (!["approve_submit", "return", "decline"].includes(action)) throw new FlowError("G5决策动作不合法。", 400);
  if (!comment.trim()) throw new FlowError(action === "decline" ? "不投/不报必须填写结构化原因和证据说明。" : action === "return" ? "退回必须填写补充要求。" : "批准投/报必须填写经营判断和授权边界。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.owner_user_id,p.owner_name,p.bid_date,p.stage FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G5'").bind(gateId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G5商务决策门不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S4") throw new FlowError("G5状态已变化，请刷新后重试。", 409);
  const frozen = jsonRecord(row.input_snapshot);
  const frozenPackages = (Array.isArray(frozen.bidPackageVersions) ? frozen.bidPackageVersions : frozen.bidPackageVersion ? [frozen.bidPackageVersion] : []) as Array<Record<string, unknown>>;
  const current = await buildG5Readiness(String(row.project_id));
  const blockers = current.items.filter(item => item.hard && !item.ready);
  if (action === "approve_submit" && blockers.length) throw new FlowError(`G5硬条件已失效：${blockers.map(item => item.label).join("、")}。`, 409);
  if (action === "approve_submit" && row.definition_version === GATE_DEFINITION_VERSION) {
    if (gateSourceFingerprint(current) !== gateSourceFingerprint(frozen as G5ReadinessSnapshot)) throw new FlowError("G5经营策略、关系、风险、价格授权、投标包或评审来源在提交后发生变化，必须退回并重新冻结决策材料。", 409);
    assertGateActivityReady(current.activitySnapshot!, "G5");
    if (activitySnapshotFingerprint(current.activitySnapshot) !== activitySnapshotFingerprint((frozen as G5ReadinessSnapshot).activitySnapshot)) throw new FlowError("G5双轨活动来源在提交后发生变化，必须重新提交Gate。", 409);
  }
  const riskFingerprint = (items: Record<string, unknown>[] | undefined) => JSON.stringify((items ?? []).map(item => ({ id: String(item.id), version: Number(item.version), status: String(item.status), level: String(item.level) })).sort((left, right) => left.id.localeCompare(right.id)));
  if (action !== "return" && riskFingerprint(current.projectRisks) !== riskFingerprint((frozen as G5ReadinessSnapshot).projectRisks)) throw new FlowError("G5提交后销售项目风险状态或版本发生变化，必须重新提交Gate并冻结新快照。", 409);
  const residualHighRisks = current.residualHighRisks ?? [];
  const riskAcceptanceReason = String(riskAcceptance?.reason ?? "").trim();
  if (action === "approve_submit" && residualHighRisks.length > 0) {
    if (row.definition_version !== GATE_DEFINITION_VERSION) throw new FlowError("当前G5未冻结剩余风险快照，必须退回并按新规则重新提交。", 409);
    if (!riskAcceptance?.accepted) throw new FlowError(`仍有${residualHighRisks.length}项重大/高风险；批准投/报必须在本次G5决策中显式接受。`, 409);
    if (!riskAcceptanceReason) throw new FlowError("接受重大/高风险必须说明经营依据、控制措施和剩余影响。", 400);
  }
  const frozenPackageIds = frozenPackages.map(item => String(item.id)).sort();
  const currentPackageIds = (current.bidPackageVersions ?? (current.bidPackageVersion ? [current.bidPackageVersion] : [])).map(item => String(item.id)).sort();
  if (action === "approve_submit" && JSON.stringify(currentPackageIds) !== JSON.stringify(frozenPackageIds)) throw new FlowError("G5提交后通路投标包批次发生变化，必须重新提交Gate。", 409);
  const frozenDeviations = ((frozen as G5ReadinessSnapshot).deviationItems ?? []).sort((left, right) => left.ref.localeCompare(right.ref));
  const currentDeviations = (current.deviationItems ?? []).sort((left, right) => left.ref.localeCompare(right.ref));
  if (action === "approve_submit" && JSON.stringify(currentDeviations) !== JSON.stringify(frozenDeviations)) throw new FlowError("G5提交后专业评审偏差发生变化，必须重新提交Gate并冻结新快照。", 409);
  const authorizationByRef = new Map(deviationAuthorizations.map(item => [item.deviationRef, item]));
  if (action === "approve_submit" && authorizationByRef.size !== deviationAuthorizations.length) throw new FlowError("同一偏差不能重复授权。", 400);
  if (action === "approve_submit" && (authorizationByRef.size !== frozenDeviations.length || frozenDeviations.some(item => !authorizationByRef.has(item.ref)))) throw new FlowError(`本次G5存在${frozenDeviations.length}项专业偏差，必须逐项完成授权后才能批准投/报。`, 409);
  if (action === "approve_submit") for (const deviation of frozenDeviations) {
    const authorization = authorizationByRef.get(deviation.ref)!;
    if (!deviation.applicableVersionIds.includes(authorization.applicableVersionId) || !frozenPackageIds.includes(authorization.applicableVersionId)) throw new FlowError(`偏差${deviation.ref}的适用版本不属于该偏差对应的冻结提交包。`, 400);
    if (authorization.validUntil < new Date().toISOString().slice(0, 10)) throw new FlowError(`偏差${deviation.ref}的授权有效期已过。`, 400);
  }
  const gateStatus = action === "return" ? "returned" : "approved";
  const after = JSON.stringify({ stage: action === "decline" ? "S5" : "S4", gateId, gateVersion: Number(row.version), gateStatus, decision: action, comment, decidedBy: actor.name, bidPackageVersionIds: frozenPackageIds, residualRiskIds: residualHighRisks.map(item => String(item.id)), riskAcceptanceReason: residualHighRisks.length ? riskAcceptanceReason : undefined, deviationRefs: frozenDeviations.map(item => item.ref) });
  const statements = [
    db.prepare("UPDATE stage_gate_instances SET status=?,execution_status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(gateStatus, action === "approve_submit" ? "executing" : action === "decline" ? "completed" : "not_required", action === "decline" ? "completed" : "not_required", actor.id, comment, gateId, Number(row.version)),
    db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), gateId, Number(row.version), action, comment, actor.id),
  ];
  if (action === "approve_submit" && residualHighRisks.length > 0) {
    for (const risk of residualHighRisks) statements.push(
      db.prepare("INSERT INTO gate_risk_acceptances (id,risk_id,gate_instance_id,gate_version,risk_version,risk_level,acceptance_reason,accepted_by) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), risk.id, gateId, Number(row.version), Number(risk.version), String(risk.level), riskAcceptanceReason, actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ProjectRisk", risk.id, DOMAIN_EVENTS.residualProjectRiskAccepted, JSON.stringify({ gateId, gateVersion: Number(row.version), riskVersion: Number(risk.version), level: risk.level, acceptanceReason: riskAcceptanceReason }), actor.id),
    );
  }
  if (action === "approve_submit") for (const deviation of frozenDeviations) {
    const authorization = authorizationByRef.get(deviation.ref)!;
    const authorizationId = crypto.randomUUID();
    statements.push(
      db.prepare("INSERT INTO g5_deviation_authorizations (id,project_id,gate_instance_id,gate_version,deviation_ref,deviation_source_type,scope,risk,applicable_version_id,valid_until,evidence_ref,authorized_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(authorizationId, row.project_id, gateId, Number(row.version), deviation.ref, deviation.sourceType, authorization.scope, authorization.risk, authorization.applicableVersionId, authorization.validUntil, authorization.evidenceRef, actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "G5DeviationAuthorization", authorizationId, "G5DeviationAuthorized", JSON.stringify({ gateId, gateVersion: Number(row.version), deviationRef: deviation.ref, scope: authorization.scope, risk: authorization.risk, applicableVersionId: authorization.applicableVersionId, validUntil: authorization.validUntil, evidenceRef: authorization.evidenceRef }), actor.id),
    );
  }
  if (action !== "return") statements.push(...await completeSystemActivityStatements(db, String(row.project_id), String(row.project_code), "ACT-SPM-03", "G5经营决策已冻结客户关系与决策链输入", `G5:${gateId}@V${Number(row.version)}`, actor.id));
  if (action === "return") {
    statements.push(
      ...frozenPackageIds.map(packageId => db.prepare("UPDATE bid_package_versions SET status='prepared',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='frozen'").bind(packageId)),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, DOMAIN_EVENTS.g5Returned, after, actor.id),
    );
  } else if (action === "decline") {
    const resultNoticeId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    statements.push(
      db.prepare("UPDATE sales_projects SET stage='S5',stage_name='结果与移交',lifecycle_status='成交/未成交',result='terminated',administrative_status='PendingClose',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S4'").bind(row.project_id),
      db.prepare("UPDATE bid_rounds SET status='cancelled',latest_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status IN ('registered','active','on_hold')").bind(row.project_id),
      db.prepare("INSERT INTO commercial_result_notices (id,project_id,result_type,source_system,source_ref,notice_date,evidence_ref,status,recorded_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(resultNoticeId, row.project_id, "terminated", "SALES_PROJECT_APP", `G5:${gateId}:V${Number(row.version)}`, new Date().toISOString().slice(0, 10), comment.trim(), "effective", actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, DOMAIN_EVENTS.bidDecisionMade, after, actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, DOMAIN_EVENTS.commercialSubmissionDeclined, after, actor.id),
      ...createSystemActivityStatements(db, { projectId: String(row.project_id), projectCode: String(row.project_code), definitionCode: "ACT-SPM-07", title: "完成不投/不报结果衔接与复盘", purpose: "基于G5经营决策形成结构化终止复盘并完成行政关闭", ownerUserId: String(row.owner_user_id), ownerName: String(row.owner_name), status: "in_progress", plannedStart: today, plannedEnd: addDays(today, 30), businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }, { objectType: "CommercialResultNotice", objectId: resultNoticeId }], reason: "G5决定不投/不报，进入S5结果处理", evidenceRef: `G5:${gateId}@V${Number(row.version)}` }),
    );
  } else {
    statements.push(
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, DOMAIN_EVENTS.bidDecisionMade, after, actor.id),
    );
  }
  statements.push(db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G5", action === "approve_submit" ? "批准投标并授权按冻结版本提交" : action === "decline" ? "决定不投/不报并进入结果阶段" : "退回补充投标材料", JSON.stringify({ stage: "S4", gateStatus: "pending", gateVersion: row.version }), after, actor.id));
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|UNIQUE constraint/i.test(message)) throw new FlowError("G5决策状态已被其他操作更新，请刷新后重试。", 409);
    throw error;
  }
  if (action === "approve_submit") {
    for (const bidPackage of frozenPackages) await createExternalTask({
      projectId: String(row.project_id), projectCode: String(row.project_code), taskType: "G5_SUBMISSION_EXECUTION", correlationKey: String(bidPackage.route_id), assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标",
      requestPayload: { gateId, gateVersion: Number(row.version), bidPackageVersionId: bidPackage.id, packageHash: bidPackage.package_hash, submissionType: bidPackage.submission_type, routeId: bidPackage.route_id, authorizedQuotePriceYuan: Number(bidPackage.quoted_price_cents ?? 0) / 100 },
    });
  }
  return { projectCode: row.project_code, gateId, gateCode: "G5", gateStatus, stage: action === "decline" ? "S5" : "S4", stageName: action === "decline" ? "结果与移交" : "定价与投标", lifecycleStatus: action === "decline" ? "成交/未成交" : "待商务决策", decision: action, comment };
}

export async function completeG5Submission(gateId: string, raw: unknown, actor: DemoActor) {
  if (actor.role !== "bid") throw new FlowError("正式提交回执只能由投标作业责任人回传。", 403);
  if (!raw || typeof raw !== "object") throw new FlowError("正式提交回执格式不正确。", 400);
  const input = raw as Record<string, unknown>;
  const packageHash = requiredText(input.packageHash, "已提交包哈希", 256);
  const submittedAt = requiredText(input.submittedAt, "正式提交时间", 40);
  if (Number.isNaN(Date.parse(submittedAt))) throw new FlowError("正式提交时间格式不合法。", 400);
  const receiptRef = requiredText(input.receiptRef, "客户/平台回执编号", 500);
  const receiptHash = requiredText(input.receiptHash, "回执哈希", 256);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.owner_user_id,p.owner_name,p.stage FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G5'").bind(gateId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G5商务决策门不存在。", 404);
  if (row.status !== "approved" || row.stage !== "S4") throw new FlowError("只有已批准且尚未完成提交的G5可以接收回执。", 409);
  const snapshot = jsonRecord(row.input_snapshot);
  const bidPackages = (Array.isArray(snapshot.bidPackageVersions) ? snapshot.bidPackageVersions : snapshot.bidPackageVersion ? [snapshot.bidPackageVersion] : []) as Array<Record<string, unknown>>;
  const bidPackage = bidPackages.find(item => String(item.package_hash) === packageHash);
  const authorization = snapshot.pricingAuthorization as Record<string, unknown> | undefined;
  if (!bidPackage?.id || !authorization?.id) throw new FlowError("G5冻结快照缺少提交包或价格授权。", 409);
  const submittedDate = new Date(submittedAt).toISOString().slice(0, 10);
  if (String(authorization.valid_until) < submittedDate) throw new FlowError("实际提交时价格授权已过期，必须重新决策。", 409);
  const frozenRouteReadiness = (Array.isArray(snapshot.routeReadiness) ? snapshot.routeReadiness : []) as Array<Record<string, unknown>>;
  const frozenRoute = frozenRouteReadiness.find(item => String((item.route as Record<string, unknown> | undefined)?.id ?? "") === String(bidPackage.route_id));
  const expectedPriceCents = Number(frozenRoute?.expectedPriceCents ?? authorization.authorized_quote_price_cents);
  if (Number(bidPackage.quoted_price_cents) < Number(authorization.floor_price_cents) || Number(bidPackage.quoted_price_cents) !== expectedPriceCents) throw new FlowError("实际提交报价不符合G5冻结的统一价格/通路例外授权，禁止入账。", 409);
  const submissionId = crypto.randomUUID();
  const after = JSON.stringify({ submissionId, gateId, gateVersion: Number(row.version), bidPackageVersionId: bidPackage.id, packageHash, submittedAt, receiptRef, receiptHash, submissionType: bidPackage.submission_type, routeId: bidPackage.route_id, submittedBy: actor.name });
  try {
    await db.batch([
      db.prepare("INSERT INTO commercial_submissions (id,project_id,gate_instance_id,gate_version,bid_package_version_id,submission_type,route_id,quoted_price_cents,package_hash,submitted_by,submitted_at,receipt_ref,receipt_hash,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(submissionId, row.project_id, gateId, Number(row.version), bidPackage.id, bidPackage.submission_type, bidPackage.route_id, Number(bidPackage.quoted_price_cents), packageHash, actor.id, submittedAt, receiptRef, receiptHash, "accepted"),
      db.prepare("UPDATE bid_package_versions SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='frozen'").bind(bidPackage.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CommercialSubmission", submissionId, DOMAIN_EVENTS.commercialSubmissionAccepted, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G5", "接收通路正式提交回执", JSON.stringify({ stage: "S4", gateStatus: "approved" }), after, actor.id),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/commercial_submissions_gate_version_uq|commercial_submissions_receipt_uq|UNIQUE constraint/i.test(message)) throw new FlowError("该G5版本或回执已入账，不能重复提交。", 409);
    throw error;
  }
  const accepted = await db.prepare("SELECT COUNT(DISTINCT route_id) AS count FROM commercial_submissions WHERE gate_instance_id=? AND gate_version=? AND status='accepted'").bind(gateId, Number(row.version)).first<{ count: number }>();
  const requiredRouteIds = new Set(bidPackages.map(item => String(item.route_id)));
  const completedCount = Number(accepted?.count ?? 0);
  const batchCompleted = completedCount === requiredRouteIds.size;
  if (!batchCompleted) return { projectCode: row.project_code, gateId, gateCode: "G5", gateStatus: "approved", stage: "S4", stageName: "定价与投标", lifecycleStatus: "已部分提交", submissionId, receiptRef, completedRoutes: completedCount, totalRoutes: requiredRouteIds.size };

  const resultActivityStatements = createSystemActivityStatements(db, { projectId: String(row.project_id), projectCode: String(row.project_code), definitionCode: "ACT-SPM-07", title: "跟踪商业结果并准备移交或复盘", purpose: "接收正式结果事实，完成赢单基线移交或失标结构化复盘", ownerUserId: String(row.owner_user_id), ownerName: String(row.owner_name), status: "in_progress", plannedStart: submittedDate, plannedEnd: addDays(submittedDate, 30), businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }, ...bidPackages.map(item => ({ objectType: "BidPackageVersion", objectId: String(item.id) }))], reason: "G5全部有效报价通路均已取得回执，进入S5结果与移交", evidenceRef: receiptRef });
  await db.batch([
    db.prepare("UPDATE stage_gate_instances SET execution_status='completed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND gate_code='G5' AND status='approved' AND execution_status='executing' AND version=?").bind(gateId, Number(row.version)),
    db.prepare("UPDATE sales_projects SET stage='S5',stage_name='结果与移交',lifecycle_status='已对外提交',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S4'").bind(row.project_id),
    db.prepare("UPDATE bid_rounds SET status='submitted',latest_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='active' AND round_no=(SELECT MAX(round_no) FROM bid_rounds WHERE project_id=? AND status='active')").bind(row.project_id, row.project_id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G5", "全部有效报价通路完成提交并推进S5", JSON.stringify({ stage: "S4", completedRoutes: completedCount }), JSON.stringify({ stage: "S5", completedRoutes: completedCount }), actor.id),
    ...resultActivityStatements,
  ]);
  const acceptedSubmissions = await db.prepare("SELECT id,route_id,bid_package_version_id,receipt_ref FROM commercial_submissions WHERE gate_instance_id=? AND gate_version=? AND status='accepted' ORDER BY created_at").bind(gateId, Number(row.version)).all<Record<string, string>>();
  for (const acceptedSubmission of acceptedSubmissions.results) {
    await createExternalTask({
      projectId: String(row.project_id), projectCode: String(row.project_code), taskType: "COMMERCIAL_RESULT_TRACKING", correlationKey: String(acceptedSubmission.route_id), assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标",
      requestPayload: { gateId, gateVersion: Number(row.version), routeId: acceptedSubmission.route_id, commercialSubmissionId: acceptedSubmission.id, bidPackageVersionId: acceptedSubmission.bid_package_version_id, submissionReceiptRef: acceptedSubmission.receipt_ref },
    });
  }
  return { projectCode: row.project_code, gateId, gateCode: "G5", gateStatus: "approved", stage: "S5", stageName: "结果与移交", lifecycleStatus: "已对外提交", submissionId, receiptRef, completedRoutes: completedCount, totalRoutes: requiredRouteIds.size };
}

type CommercialResultInput = {
  routeId: string;
  correctionOfResultId: string;
  correctionReason: string;
  resultType: "won" | "lost";
  sourceRef: string;
  noticeDate: string;
  evidenceRef: string;
  awardScope: string;
  competitorName: string;
};

export function parseCommercialResult(raw: unknown): CommercialResultInput {
  if (!raw || typeof raw !== "object") throw new FlowError("商业结果回传格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  const resultType = String(data.resultType);
  if (resultType !== "won" && resultType !== "lost") throw new FlowError("投标结果只能为中标或未中标；不投/终止由G5经营决策形成。", 400);
  return {
    routeId: String(data.routeId ?? "").trim(),
    correctionOfResultId: String(data.correctionOfResultId ?? "").trim(),
    correctionReason: String(data.correctionReason ?? "").trim(),
    resultType,
    sourceRef: requiredText(data.sourceRef, "结果来源编号", 500),
    noticeDate: isoDate(data.noticeDate, "结果通知日期"),
    evidenceRef: requiredText(data.evidenceRef, "结果证据", 1000),
    awardScope: resultType === "won" ? requiredText(data.awardScope, "中标范围", 2000) : String(data.awardScope ?? "").trim(),
    competitorName: resultType === "lost" ? requiredText(data.competitorName, "中标竞争方或未知说明", 500) : String(data.competitorName ?? "").trim(),
  };
}

export function parseLossTerminationReview(raw: unknown): LossTerminationReviewInput {
  if (!raw || typeof raw !== "object") throw new FlowError("失标/终止复盘格式不正确。", 400);
  const data = raw as Record<string, unknown>;
  return {
    reasonCategory: requiredText(data.reasonCategory, "原因分类", 200),
    reasonDetail: requiredText(data.reasonDetail, "原因说明", 2000),
    competitorName: String(data.competitorName ?? "").trim(),
    keyGap: requiredText(data.keyGap, "关键差距", 2000),
    evidenceRef: requiredText(data.evidenceRef, "复盘证据", 1000),
    improvementAction: requiredText(data.improvementAction, "改进行动", 2000),
    actionOwner: requiredText(data.actionOwner, "行动责任人", 120),
    dueDate: isoDate(data.dueDate, "改进行动期限"),
  };
}

async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function loadG6SourceFacts(projectId: string) {
  const db = getD1Binding();
  const [project, notice, submissionsResult, routeResultsResult, requirement, solution, bom, costing, pricingSnapshot, authorization, bidPackagesResult, review, approvedG5] = await Promise.all([
    db.prepare("SELECT p.*,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.id=?").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM commercial_result_notices WHERE project_id=? AND status='effective' ORDER BY created_at DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT s.*,q.epc_customer FROM commercial_submissions s LEFT JOIN quotation_routes q ON q.id=s.route_id WHERE s.project_id=? AND s.status='accepted' ORDER BY s.created_at").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT r.*,q.epc_customer FROM quotation_route_results r LEFT JOIN quotation_routes q ON q.id=r.route_id WHERE r.project_id=? AND r.status='effective' ORDER BY r.created_at").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM customer_requirement_versions WHERE project_id=? AND status IN ('effective','approved') ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM technical_solution_versions WHERE project_id=? AND status='approved' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM quotation_design_bom_versions WHERE project_id=? AND status='approved' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM costing_solution_versions WHERE project_id=? AND status='approved' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM pricing_snapshot_versions WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM pricing_authorizations WHERE project_id=? AND status='effective' ORDER BY version DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM bid_package_versions WHERE project_id=? AND status='submitted' ORDER BY version").bind(projectId).all<Record<string, string | number | null>>(),
    db.prepare("SELECT * FROM loss_termination_reviews WHERE project_id=? AND status IN ('ready','closed') ORDER BY created_at DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
    db.prepare("SELECT g.id,g.version,s.input_snapshot FROM stage_gate_instances g JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.project_id=? AND g.gate_code='G5' AND g.status='approved' ORDER BY g.decided_at DESC LIMIT 1").bind(projectId).first<Record<string, string | number | null>>(),
  ]);
  const submissions = submissionsResult.results;
  const routeResults = routeResultsResult.results;
  const bidPackages = bidPackagesResult.results;
  const submission = submissions.find(item => item.id === notice?.commercial_submission_id) ?? submissions.at(-1) ?? null;
  const bidPackage = bidPackages.find(item => item.id === submission?.bid_package_version_id) ?? bidPackages.at(-1) ?? null;
  const deviations = solution ? await db.prepare("SELECT id,description,status,evidence_ref FROM technical_deviation_records WHERE project_id=? AND solution_version_id=? ORDER BY created_at").bind(projectId, solution.id).all<Record<string, unknown>>() : { results: [] };
  const deviationAuthorizations = approvedG5 ? await db.prepare("SELECT a.*,u.display_name AS authorized_by_name FROM g5_deviation_authorizations a JOIN users u ON u.id=a.authorized_by WHERE a.gate_instance_id=? AND a.gate_version=? ORDER BY a.created_at").bind(approvedG5.id, approvedG5.version).all<Record<string, unknown>>() : { results: [] };
  const g5Snapshot = approvedG5 ? jsonRecord(approvedG5.input_snapshot) as G5ReadinessSnapshot : undefined;
  return { project: project ?? null, notice: notice ?? null, submissions, routeResults, submission, requirement: requirement ?? null, solution: solution ?? null, bom: bom ?? null, costing: costing ?? null, pricingSnapshot: pricingSnapshot ?? null, authorization: authorization ?? null, bidPackages, bidPackage, review: review ?? null, deviations: deviations.results, deviationAuthorizations: deviationAuthorizations.results, g5Snapshot };
}

export async function buildG6Readiness(projectId: string): Promise<G6ReadinessSnapshot> {
  const facts = await loadG6SourceFacts(projectId);
  const resultType = facts.notice?.result_type as ResultType | undefined;
  const terminatedByG5 = resultType === "terminated" && facts.notice?.source_system === "SALES_PROJECT_APP";
  const legacyAggregate = Boolean(facts.notice?.id && facts.routeResults.length === 0 && !terminatedByG5);
  const resultBySubmission = new Map(facts.routeResults.map(item => [String(item.commercial_submission_id), item]));
  const pendingRouteIds = facts.submissions.filter(item => !resultBySubmission.has(String(item.id))).map(item => String(item.route_id));
  const winningRouteIds = facts.routeResults.filter(item => item.result_type === "won").map(item => String(item.route_id));
  const multipleWinners = winningRouteIds.length > 1;
  const routeResultsReady = terminatedByG5 || legacyAggregate || Boolean(facts.submissions.length && pendingRouteIds.length === 0 && !multipleWinners);
  const resultAggregationStatus = terminatedByG5 || legacyAggregate ? "not_applicable" : multipleWinners ? "conflict" : pendingRouteIds.length ? "pending" : "ready";
  const resultReady = Boolean(facts.notice?.id && facts.notice?.source_ref && facts.notice?.evidence_ref && facts.notice?.notice_date);
  const everyRouteBound = facts.submissions.every(submission => resultBySubmission.get(String(submission.id))?.route_id === submission.route_id);
  const submissionReady = terminatedByG5 || legacyAggregate ? terminatedByG5 || Boolean(facts.submission?.id && facts.notice?.commercial_submission_id === facts.submission?.id && facts.submission?.receipt_ref && facts.submission?.package_hash) : Boolean(routeResultsReady && everyRouteBound && facts.submissions.every(item => item.receipt_ref && item.package_hash));
  const lineage = [facts.requirement, facts.solution, facts.bom, facts.costing, facts.pricingSnapshot, facts.authorization, facts.bidPackage, facts.submission];
  const requiredDeviationRefs = (facts.g5Snapshot?.deviationItems ?? []).map(item => item.ref);
  const authorizedDeviationRefs = new Set(facts.deviationAuthorizations.map(item => String(item.deviation_ref)));
  const deviationLineageReady = requiredDeviationRefs.every(ref => authorizedDeviationRefs.has(ref))
    && facts.deviationAuthorizations.every(item => item.scope && item.risk && item.applicable_version_id === facts.bidPackage?.id && item.valid_until && item.evidence_ref && item.authorized_by);
  const priceContextReady = Boolean(facts.pricingSnapshot?.id
    && facts.pricingSnapshot?.source && facts.pricingSnapshot?.source_version && facts.pricingSnapshot?.currency && facts.pricingSnapshot?.tax_basis && facts.pricingSnapshot?.trade_terms && facts.pricingSnapshot?.valid_until && facts.pricingSnapshot?.evidence_ref
    && facts.authorization?.pricing_snapshot_id === facts.pricingSnapshot.id && facts.authorization?.currency === facts.pricingSnapshot.currency && facts.authorization?.tax_basis === facts.pricingSnapshot.tax_basis && facts.authorization?.trade_terms === facts.pricingSnapshot.trade_terms
    && facts.authorization?.exception_conditions && facts.authorization?.valid_until && facts.authorization?.evidence_ref
    && String(facts.submission?.submitted_at ?? "").slice(0, 10) <= String(facts.authorization?.valid_until ?? ""));
  const finalCommitmentReady = Boolean(facts.submission?.quoted_price_cents && facts.submission?.route_id && facts.submission?.receipt_ref && facts.submission?.receipt_hash && facts.submission?.submitted_at
    && facts.bidPackage?.package_hash === facts.submission?.package_hash && facts.bidPackage?.evidence_ref
    && facts.notice?.award_scope && facts.notice?.source_ref && facts.notice?.evidence_ref && facts.notice?.notice_date);
  const lineageReady = resultType !== "won" || Boolean(lineage.every(Boolean)
    && facts.solution?.requirement_version_id === facts.requirement?.id
    && facts.bom?.technical_solution_version_id === facts.solution?.id
    && facts.costing?.technical_solution_version_id === facts.solution?.id
    && facts.costing?.design_bom_version_id === facts.bom?.id
    && facts.authorization?.costing_solution_version_id === facts.costing?.id
    && facts.bidPackage?.pricing_authorization_id === facts.authorization?.id
    && facts.submission?.bid_package_version_id === facts.bidPackage?.id
    && facts.submission?.package_hash === facts.bidPackage?.package_hash
    && facts.notice?.commercial_submission_id === facts.submission?.id
    && priceContextReady && deviationLineageReady && finalCommitmentReady);
  const reviewReady = resultType === "won" || Boolean(facts.review?.id && facts.review?.result_notice_id === facts.notice?.id && facts.review?.status === "ready" && facts.review?.evidence_ref && facts.review?.improvement_action && facts.review?.action_owner && facts.review?.due_date);
  const manifest = resultType === "won" ? {
    requirementVersionId: facts.requirement?.id,
    technicalSolutionVersionId: facts.solution?.id,
    designBomVersionId: facts.bom?.id,
    costingSolutionVersionId: facts.costing?.id,
    pricingAuthorizationId: facts.authorization?.id,
    bidPackageVersionId: facts.bidPackage?.id,
    commercialSubmissionId: facts.submission?.id,
    resultNoticeId: facts.notice?.id,
    awardScope: facts.notice?.award_scope,
    technicalDeviations: facts.deviations,
    deviationAuthorizations: facts.deviationAuthorizations,
    priceAuthorization: {
      id: facts.authorization?.id, pricingSnapshotId: facts.pricingSnapshot?.id, source: facts.pricingSnapshot?.source, sourceVersion: facts.pricingSnapshot?.source_version,
      currency: facts.authorization?.currency, taxBasis: facts.authorization?.tax_basis, tradeTerms: facts.authorization?.trade_terms,
      floorPriceCents: facts.authorization?.floor_price_cents, authorizedQuotePriceCents: facts.authorization?.authorized_quote_price_cents,
      validUntil: facts.authorization?.valid_until, exceptionConditions: facts.authorization?.exception_conditions, evidenceRef: facts.authorization?.evidence_ref,
    },
    finalCommitment: {
      quotedPriceCents: facts.submission?.quoted_price_cents, routeId: facts.submission?.route_id, submissionType: facts.submission?.submission_type,
      submittedAt: facts.submission?.submitted_at, receiptRef: facts.submission?.receipt_ref, receiptHash: facts.submission?.receipt_hash,
      packageHash: facts.submission?.package_hash, bidPackageEvidenceRef: facts.bidPackage?.evidence_ref,
      awardScope: facts.notice?.award_scope, resultSourceRef: facts.notice?.source_ref, resultEvidenceRef: facts.notice?.evidence_ref, noticeDate: facts.notice?.notice_date,
    },
  } : undefined;
  const items: G6ReadinessItem[] = [
    { key: "routeResults", label: "全部有效报价通路结果已回传且无冲突", summary: terminatedByG5 ? "G5不投/不报分支不产生通路结果" : legacyAggregate ? "历史单结果记录，按兼容口径读取" : multipleWinners ? `检测到${winningRouteIds.length}条中标通路，必须先核实授标范围/合同拆分` : pendingRouteIds.length ? `已回传${facts.routeResults.length}/${facts.submissions.length}，待回传通路：${pendingRouteIds.join("、")}` : `已回传${facts.routeResults.length}/${facts.submissions.length}，项目级结果可汇总`, ready: routeResultsReady, hard: true, sourceType: "QuotationRouteResult", sourceRefs: facts.routeResults.map(item => String(item.id)), owner: "投标作业责任人" },
    { key: "resultFact", label: "L2.9正式结果事实有效", summary: resultReady ? `${resultType}｜${facts.notice?.source_ref}｜${facts.notice?.notice_date}` : "尚未收到投标作业轨结果事实", ready: resultReady, hard: true, sourceType: "BidResult", sourceRefs: facts.notice?.id ? [String(facts.notice.id)] : [], owner: "投标作业责任人" },
    { key: "submissionTrace", label: terminatedByG5 ? "G5不投/不报决策可追溯" : "结果绑定正式提交与回执", summary: terminatedByG5 ? String(facts.notice?.evidence_ref ?? "") : submissionReady ? `${facts.submission?.receipt_ref}｜${facts.submission?.package_hash}` : "结果未绑定当前正式提交记录", ready: submissionReady, hard: true, sourceType: "CommercialSubmission", sourceRefs: facts.submission?.id ? [String(facts.submission.id)] : facts.notice?.id ? [String(facts.notice.id)] : [], owner: "系统一致性校验" },
    { key: "awardBaselineCompleteness", label: resultType === "won" ? "中标承诺基线完整且可追溯" : "非赢单分支不形成中标基线", summary: resultType === "won" ? lineageReady ? "需求、方案、BOM、核价、价格授权、偏差授权、提交回执及授标承诺血缘完整" : `中标基线缺口：${[!priceContextReady && "价格上下文", !deviationLineageReady && "偏差授权", !finalCommitmentReady && "最终提交/授标承诺", !lineage.every(Boolean) && "版本链"].filter(Boolean).join("、") || "版本引用不一致"}` : "不适用", ready: lineageReady, hard: true, sourceType: "CommercialAwardBaseline", sourceRefs: resultType === "won" ? [...lineage.map(item => String(item?.id ?? "")).filter(Boolean), ...facts.deviationAuthorizations.map(item => String(item.id))] : [], owner: "系统一致性校验" },
    { key: "lossReview", label: resultType === "won" ? "赢单分支不需要失标复盘" : "失标/终止结构化复盘完整", summary: resultType === "won" ? "不适用" : reviewReady ? `${facts.review?.reason_category}｜行动 ${facts.review?.action_owner} 至 ${facts.review?.due_date}` : "原因、证据、差距、改进行动、责任人或期限未齐", ready: reviewReady, hard: true, sourceType: "LossTerminationReview", sourceRefs: facts.review?.id ? [String(facts.review.id)] : [], owner: "销售项目Owner" },
  ];
  const activitySnapshot = await buildGateActivitySnapshot(projectId, "G6");
  if (terminatedByG5) {
    activitySnapshot.items = activitySnapshot.items.map(item => item.definitionCode === "ACT-BID-09"
      ? { ...item, hard: false, ready: true, purpose: "G5不投/不报分支无L2.9投标结果活动，引用G5决策事实" }
      : item);
    activitySnapshot.hasHardBlocker = activitySnapshot.items.some(item => item.hard && !item.ready);
  }
  return { resultType, items, routeResults: facts.routeResults, submittedRoutes: facts.submissions, pendingRouteIds, winningRouteIds, resultAggregationStatus, resultNotice: facts.notice ?? undefined, lossTerminationReview: facts.review ?? undefined, awardBaselineManifest: manifest, generatedAt: new Date().toISOString(), activitySnapshot };
}

export async function requestCommercialResultCorrection(projectCode: string, raw: unknown, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("只有销售项目Owner可以发起结果核实请求。", 403);
  if (!raw || typeof raw !== "object") throw new FlowError("结果核实请求格式不正确。", 400);
  const input = raw as Record<string, unknown>;
  const routeResultId = requiredText(input.routeResultId, "待核实通路结果编号", 120);
  const reason = requiredText(input.reason, "核实原因", 1000);
  const evidenceRef = requiredText(input.evidenceRef, "核实请求依据", 1000);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,owner_user_id,stage,result FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.owner_user_id !== actor.id || project.stage !== "S5" || project.result !== "pending") throw new FlowError("只有S5待确认项目的Owner可以发起结果核实。", 403);
  const pendingGate = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G6' AND status IN ('pending','approved')").bind(project.id).first();
  if (pendingGate) throw new FlowError("G6已冻结或已确认，必须先退回/撤销当前Gate后才能核实结果。", 409);
  const routeResult = await db.prepare("SELECT * FROM quotation_route_results WHERE id=? AND project_id=? AND status='effective'").bind(routeResultId, project.id).first<Record<string, string | number | null>>();
  if (!routeResult) throw new FlowError("待核实的通路结果不存在、已被更正或不属于该项目。", 404);
  const correlationKey = `CORRECTION:${routeResultId}`;
  const existingTask = await db.prepare("SELECT id,external_task_id,status FROM external_tasks WHERE project_id=? AND task_type='COMMERCIAL_RESULT_TRACKING' AND status IN ('pending','accepted') AND COALESCE(json_extract(request_payload,'$.correlationKey'),'')=? ORDER BY created_at DESC LIMIT 1").bind(project.id, correlationKey).first<Record<string, string>>();
  if (existingTask) {
    return {
      projectCode,
      routeResultId,
      routeId: routeResult.route_id,
      task: { id: existingTask.id, externalTaskId: existingTask.external_task_id, status: existingTask.status, created: false },
      duplicate: true,
      readiness: await buildG6Readiness(project.id),
    };
  }
  const after = JSON.stringify({ projectCode, routeResultId, routeId: routeResult.route_id, currentResultType: routeResult.result_type, reason, evidenceRef, requestedBy: actor.name });
  await db.batch([
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "QuotationRouteResult", routeResultId, "CommercialResultCorrectionRequested", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G6结果核实", "发起报价通路结果核实", JSON.stringify({ routeResultId, resultType: routeResult.result_type, status: routeResult.status }), after, actor.id),
  ]);
  const task = await createExternalTask({
    projectId: project.id, projectCode, taskType: "COMMERCIAL_RESULT_TRACKING", correlationKey, assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标",
    requestPayload: { mode: "correction", routeId: routeResult.route_id, commercialSubmissionId: routeResult.commercial_submission_id, priorRouteResultId: routeResultId, priorResultType: routeResult.result_type, priorSourceRef: routeResult.source_ref, correctionRequestReason: reason, correctionRequestEvidence: evidenceRef },
  });
  return { projectCode, routeResultId, routeId: routeResult.route_id, task, readiness: await buildG6Readiness(project.id) };
}

export async function saveCommercialResult(projectCode: string, input: CommercialResultInput, actor: DemoActor) {
  if (actor.role !== "bid") throw new FlowError("L2.9投标结果事实必须由投标作业责任人回传。", 403);
  const db = getD1Binding();
  const project = await db.prepare("SELECT p.id,p.stage,p.result,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S5" || project.result !== "pending") throw new FlowError("只有S5等待结果的项目可以接收投标结果。", 409);
  const submissions = await db.prepare("SELECT id,route_id,bid_package_version_id,receipt_ref,package_hash FROM commercial_submissions WHERE project_id=? AND status='accepted' ORDER BY created_at").bind(project.id).all<Record<string, string>>();
  if (!submissions.results.length) throw new FlowError("尚无正式提交及客户/平台回执，不能登记投标结果。", 409);
  const routeId = input.routeId || (submissions.results.length === 1 ? String(submissions.results[0].route_id) : "");
  if (!routeId) throw new FlowError("多通路项目必须明确本次结果对应的报价通路。", 400);
  const submission = submissions.results.find(item => item.route_id === routeId);
  if (!submission) throw new FlowError("该报价通路没有有效正式提交及回执，不能登记结果。", 409);
  const pendingGate = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G6' AND status IN ('pending','approved')").bind(project.id).first();
  if (pendingGate) throw new FlowError("G6快照已冻结或已确认，结果事实不能再覆盖。", 409);
  const currentRouteResult = await db.prepare("SELECT id,result_type FROM quotation_route_results WHERE project_id=? AND route_id=? AND status='effective'").bind(project.id, routeId).first<Record<string, string>>();
  if (currentRouteResult && (input.correctionOfResultId !== currentRouteResult.id || !input.correctionReason)) throw new FlowError("已有有效通路结果；更正必须引用当前结果并填写正式更正原因。", 409);
  if (!currentRouteResult && input.correctionOfResultId) throw new FlowError("被更正的通路结果已变化，请重新发起核实任务。", 409);
  const routeResultId = crypto.randomUUID();
  const after = JSON.stringify({ id: routeResultId, projectCode, commercialSubmissionId: submission.id, ...input, routeId, sourceSystem: "BID_COLLABORATION_SIMULATOR" });
  const activityStatements = await addSystemActivityEvidenceStatements(db, project.id, projectCode, "ACT-SPM-07", { objectType: "QuotationRouteResult", objectId: routeResultId }, input.evidenceRef, actor.id);
  try {
    await db.batch([
      db.prepare("UPDATE quotation_route_results SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND route_id=? AND status='effective'").bind(project.id, routeId),
      db.prepare("INSERT INTO quotation_route_results (id,project_id,route_id,commercial_submission_id,result_type,source_system,source_ref,notice_date,evidence_ref,award_scope,competitor_name,supersedes_result_id,correction_reason,status,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(routeResultId, project.id, routeId, submission.id, input.resultType, "BID_COLLABORATION_SIMULATOR", input.sourceRef, input.noticeDate, input.evidenceRef, input.awardScope || null, input.competitorName || null, currentRouteResult?.id ?? null, currentRouteResult ? input.correctionReason : null, "effective", actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "QuotationRouteResult", routeResultId, DOMAIN_EVENTS.commercialResultReported, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G6结果", "接收报价通路L2.9正式结果事实", null, after, actor.id),
      ...activityStatements,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/quotation_route_results_source_uq|UNIQUE constraint/i.test(message)) throw new FlowError("该结果来源编号已入账，不能重复回传。", 409);
    throw error;
  }
  const effectiveResults = await db.prepare("SELECT * FROM quotation_route_results WHERE project_id=? AND status='effective' ORDER BY created_at").bind(project.id).all<Record<string, string | number | null>>();
  const resultBySubmission = new Map(effectiveResults.results.map(item => [String(item.commercial_submission_id), item]));
  const pendingRoutes = submissions.results.filter(item => !resultBySubmission.has(item.id));
  const winners = effectiveResults.results.filter(item => item.result_type === "won");
  let resultNoticeId: string | undefined;
  let aggregateResultType: "won" | "lost" | undefined;
  if (pendingRoutes.length === 0) await db.prepare("UPDATE commercial_result_notices SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='effective' AND source_system='SALES_PROJECT_APP_AGGREGATOR'").bind(project.id).run();
  if (pendingRoutes.length === 0 && winners.length <= 1) {
    aggregateResultType = winners.length === 1 ? "won" : "lost";
    const anchorResult = winners[0] ?? effectiveResults.results.at(-1)!;
    const aggregateSubmission = submissions.results.find(item => item.id === anchorResult.commercial_submission_id)!;
    resultNoticeId = crypto.randomUUID();
    const sourceIds = effectiveResults.results.map(item => String(item.id)).sort();
    const aggregateHash = await sha256Text(sourceIds.join("|"));
    const aggregateEvidence = effectiveResults.results.map(item => `${item.route_id}:${item.evidence_ref}`).join("；").slice(0, 1000);
    await db.batch([
      db.prepare("INSERT INTO commercial_result_notices (id,project_id,commercial_submission_id,result_type,source_system,source_ref,notice_date,evidence_ref,award_scope,competitor_name,status,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(resultNoticeId, project.id, aggregateSubmission.id, aggregateResultType, "SALES_PROJECT_APP_AGGREGATOR", `ROUTE-AGG:${aggregateHash}`, String(anchorResult.notice_date), aggregateEvidence, aggregateResultType === "won" ? anchorResult.award_scope : null, aggregateResultType === "lost" ? "各报价通路均未形成钱江中标" : null, "effective", actor.id),
      db.prepare("UPDATE bid_rounds SET status='resulted',latest_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='submitted' AND round_no=(SELECT MAX(round_no) FROM bid_rounds WHERE project_id=? AND status='submitted')").bind(project.id, project.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G6结果汇总", aggregateResultType === "won" ? "全部通路齐备并形成项目赢单结果" : "全部通路齐备并形成项目未赢结果", null, JSON.stringify({ resultNoticeId, aggregateResultType, sourceRouteResultIds: sourceIds }), actor.id),
    ]);
  }
  const readiness = await buildG6Readiness(project.id);
  return { projectCode, routeResultId, routeId, resultNoticeId, resultType: aggregateResultType, aggregationStatus: winners.length > 1 ? "conflict" : pendingRoutes.length ? "pending" : "ready", completedRoutes: effectiveResults.results.length, totalRoutes: submissions.results.length, readiness };
}

export async function saveLossTerminationReview(projectCode: string, input: LossTerminationReviewInput, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("失标/终止复盘必须由销售项目Owner维护。", 403);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,owner_user_id,stage FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.owner_user_id !== actor.id || project.stage !== "S5") throw new FlowError("只有S5项目Owner可以维护结果复盘。", 403);
  const notice = await db.prepare("SELECT id,result_type FROM commercial_result_notices WHERE project_id=? AND status='effective' ORDER BY created_at DESC LIMIT 1").bind(project.id).first<Record<string, string>>();
  if (!notice || !["lost", "terminated"].includes(notice.result_type)) throw new FlowError("当前结果不是失标或终止，不能创建该复盘。", 409);
  const pendingGate = await db.prepare("SELECT id FROM stage_gate_instances WHERE project_id=? AND gate_code='G6' AND status IN ('pending','approved')").bind(project.id).first();
  if (pendingGate) throw new FlowError("G6快照已冻结或已确认，复盘不能再覆盖。", 409);
  const existing = await db.prepare("SELECT id FROM loss_termination_reviews WHERE result_notice_id=?").bind(notice.id).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const after = JSON.stringify({ id, projectCode, resultNoticeId: notice.id, resultType: notice.result_type, ...input });
  const write = existing
    ? db.prepare("UPDATE loss_termination_reviews SET reason_category=?,reason_detail=?,competitor_name=?,key_gap=?,evidence_ref=?,improvement_action=?,action_owner=?,due_date=?,status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.reasonCategory, input.reasonDetail, input.competitorName || null, input.keyGap, input.evidenceRef, input.improvementAction, input.actionOwner, input.dueDate, id)
    : db.prepare("INSERT INTO loss_termination_reviews (id,project_id,result_notice_id,result_type,reason_category,reason_detail,competitor_name,key_gap,evidence_ref,improvement_action,action_owner,due_date,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, notice.id, notice.result_type, input.reasonCategory, input.reasonDetail, input.competitorName || null, input.keyGap, input.evidenceRef, input.improvementAction, input.actionOwner, input.dueDate, "ready", actor.id);
  const activityStatements = await addSystemActivityEvidenceStatements(db, project.id, projectCode, "ACT-SPM-07", { objectType: "LossTerminationReview", objectId: id }, input.evidenceRef, actor.id);
  await db.batch([
    write,
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "LossTerminationReview", id, DOMAIN_EVENTS.lossTerminationReviewRecorded, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G6复盘", existing ? "更新结构化复盘" : "形成结构化复盘", null, after, actor.id),
    ...activityStatements,
  ]);
  return { projectCode, reviewId: id, readiness: await buildG6Readiness(project.id) };
}

export async function requestG6(projectCode: string, actor: DemoActor, handoverRemediation?: { resolutionSummary?: unknown; evidenceRef?: unknown }) {
  if (actor.role !== "sales") throw new FlowError("只有销售项目Owner可以提交G6。", 403);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,owner_user_id,stage,result FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.owner_user_id !== actor.id || project.stage !== "S5") throw new FlowError("只有S5项目Owner可以提交G6。", 403);
  const readiness = await buildG6Readiness(project.id);
  const blockers = readiness.items.filter(item => !item.ready);
  if (!readiness.resultType || blockers.length) throw new FlowError(`G6来源尚未齐套：${blockers.map(item => item.label).join("、") || "正式结果事实"}。`, 409);
  assertGateActivityReady(readiness.activitySnapshot!, "G6");
  const existing = await db.prepare("SELECT id,status,version FROM stage_gate_instances WHERE project_id=? AND gate_code='G6'").bind(project.id).first<Record<string, string | number>>();
  if (existing && existing.status !== "returned") throw new FlowError(`G6当前为${existing.status}，不能重复提交。`, 409);
  const pendingContractReturn = existing ? await db.prepare("SELECT * FROM contract_handover_returns WHERE gate_instance_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(existing.id).first<Record<string, string | number | null>>() : null;
  const resolutionSummary = pendingContractReturn ? requiredText(handoverRemediation?.resolutionSummary, "合同退回整改结论", 3000) : "";
  const resolutionEvidenceRef = pendingContractReturn ? requiredText(handoverRemediation?.evidenceRef, "合同退回整改证据", 1000) : "";
  const gateId = existing ? String(existing.id) : crypto.randomUUID();
  const version = existing ? Number(existing.version) + 1 : 1;
  const contractHandoverRemediation = pendingContractReturn ? { returnId: pendingContractReturn.id, resolutionSummary, evidenceRef: resolutionEvidenceRef } : undefined;
  const snapshot = JSON.stringify({ ...readiness, contractHandoverRemediation });
  const after = JSON.stringify({ projectCode, gateId, version, resultType: readiness.resultType, sourceRefs: readiness.items.flatMap(item => item.sourceRefs), contractHandoverRemediation });
  const statements = existing
    ? [db.prepare("UPDATE stage_gate_instances SET status='pending',execution_status='not_required',completed_at=NULL,requested_by=?,requested_at=CURRENT_TIMESTAMP,decided_by=NULL,decision_comment=NULL,decided_at=NULL,version=?,definition_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='returned'").bind(actor.id, version, GATE_DEFINITION_VERSION, gateId)]
    : [db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,version,definition_version) VALUES (?,?,?,?,?,?,?,?,?)").bind(gateId, project.id, "G6", "S5", readiness.resultType === "won" ? "S6" : null, "pending", actor.id, version, GATE_DEFINITION_VERSION)];
  statements.push(
    ...(pendingContractReturn ? [db.prepare("UPDATE contract_handover_returns SET status='resolved',resolution_summary=?,resolution_evidence_ref=?,resolved_by=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(resolutionSummary, resolutionEvidenceRef, actor.id, pendingContractReturn.id)] : []),
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, version, snapshot, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, existing ? DOMAIN_EVENTS.g6Resubmitted : DOMAIN_EVENTS.g6ApprovalRequested, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G6", existing ? "重新提交结果与移交门" : "提交结果与移交门", null, after, actor.id),
  );
  await db.batch(statements);
  return { projectCode, gateId, gateCode: "G6", gateStatus: "pending", stage: "S5", readiness, version };
}

export async function decideG6(gateId: string, action: "approve" | "return", comment: string, actor: DemoActor) {
  if (actor.role !== "manager") throw new FlowError("G6商业结果与移交决策必须由销售主管确认。", 403);
  if (!comment.trim()) throw new FlowError(action === "return" ? "退回必须填写补充要求。" : "批准必须填写结果及分支判断依据。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,s.input_snapshot,p.project_code,p.stage FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version WHERE g.id=? AND g.gate_code='G6'").bind(gateId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G6结果与移交门不存在。", 404);
  if (row.status !== "pending" || row.stage !== "S5") throw new FlowError("G6状态已变化，请刷新后重试。", 409);
  const frozen = jsonRecord(row.input_snapshot) as G6ReadinessSnapshot;
  const current = await buildG6Readiness(String(row.project_id));
  if (action === "approve" && (!current.resultType || current.resultType !== frozen.resultType || current.items.some(item => !item.ready))) throw new FlowError("G6结果事实或来源版本已变化，必须退回并重新提交。", 409);
  if (action === "approve" && row.definition_version === GATE_DEFINITION_VERSION) {
    assertGateActivityReady(current.activitySnapshot!, "G6");
    if (activitySnapshotFingerprint(current.activitySnapshot) !== activitySnapshotFingerprint(frozen.activitySnapshot)) throw new FlowError("G6双轨活动来源在提交后发生变化，必须退回并重新冻结快照。", 409);
  }
  if (action === "return") {
    const after = JSON.stringify({ projectCode: row.project_code, gateId, gateStatus: "returned", comment });
    await db.batch([
      db.prepare("UPDATE stage_gate_instances SET status='returned',execution_status='not_required',decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(actor.id, comment, gateId, Number(row.version)),
      db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), gateId, Number(row.version), action, comment, actor.id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGateInteraction", gateId, DOMAIN_EVENTS.g6Returned, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G6", "退回结果与移交材料", JSON.stringify({ gateStatus: "pending" }), after, actor.id),
    ]);
    return { projectCode: row.project_code, gateId, gateStatus: "returned", stage: "S5", resultType: current.resultType };
  }
  const resultType = current.resultType!;
  const eventType = resultType === "won" ? DOMAIN_EVENTS.commercialDealWon : resultType === "lost" ? DOMAIN_EVENTS.commercialDealLost : DOMAIN_EVENTS.commercialDealTerminated;
  const resultNoticeId = String(current.resultNotice?.id ?? "");
  const openManualActivities = resultType === "won" ? [] : (await db.prepare(`SELECT a.id,a.status,a.version,d.code AS definition_code
    FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id
    WHERE a.project_id=? AND d.code IN ('ACT-SPM-05','ACT-SPM-06') AND a.status IN ('planned','in_progress','blocked')`).bind(row.project_id).all<Record<string, string | number>>()).results;
  const after = JSON.stringify({ projectCode: row.project_code, gateId, gateVersion: Number(row.version), resultType, decision: "approve", comment, decidedBy: actor.name });
  let awardBaselineOutput: { id: string; manifestHash: string } | undefined;
  const statements = [
    db.prepare("UPDATE stage_gate_instances SET status='approved',execution_status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,decided_by=?,decision_comment=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND version=?").bind(resultType === "won" ? "executing" : "completed", resultType === "won" ? "executing" : "completed", actor.id, comment, gateId, Number(row.version)),
    db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), gateId, Number(row.version), "approve", comment, actor.id),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, eventType, after, actor.id),
    ...await completeSystemActivityStatements(db, String(row.project_id), String(row.project_code), "ACT-SPM-07", resultType === "won" ? "G6确认赢单基线并启动合同移交" : "G6确认结果并完成结构化复盘", `G6:${gateId}@V${Number(row.version)}`, actor.id),
  ];
  if (resultType === "won") {
    const frozenRemediation = (frozen as G6ReadinessSnapshot & { contractHandoverRemediation?: Record<string, unknown> }).contractHandoverRemediation;
    const manifest: Record<string, unknown> = { ...((current.awardBaselineManifest ?? {}) as Record<string, unknown>), ...(frozenRemediation ? { contractHandoverRemediation: frozenRemediation } : {}) };
    const manifestJson = JSON.stringify(manifest);
    const manifestHash = await sha256Text(manifestJson);
    const baselineId = crypto.randomUUID();
    const externalTaskId = `CONTRACT-${String(row.project_code).slice(-6)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const outboxEventId = crypto.randomUUID();
    awardBaselineOutput = { id: baselineId, manifestHash };
    statements.push(
      db.prepare("INSERT INTO commercial_award_baselines (id,project_id,gate_instance_id,gate_version,result_notice_id,requirement_version_id,technical_solution_version_id,design_bom_version_id,costing_solution_version_id,pricing_authorization_id,bid_package_version_id,commercial_submission_id,deviation_snapshot,commitment_snapshot,manifest_hash,status,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(baselineId, row.project_id, gateId, Number(row.version), resultNoticeId, String(manifest.requirementVersionId), String(manifest.technicalSolutionVersionId), String(manifest.designBomVersionId), String(manifest.costingSolutionVersionId), String(manifest.pricingAuthorizationId), String(manifest.bidPackageVersionId), String(manifest.commercialSubmissionId), JSON.stringify({ technicalDeviations: manifest.technicalDeviations ?? [], deviationAuthorizations: manifest.deviationAuthorizations ?? [] }), JSON.stringify({ finalCommitment: manifest.finalCommitment ?? {}, priceAuthorization: manifest.priceAuthorization ?? {}, ...(frozenRemediation ? { contractHandoverRemediation: frozenRemediation } : {}) }), manifestHash, "frozen", actor.id),
      db.prepare("UPDATE sales_projects SET result='won',lifecycle_status='成交/未成交',administrative_status='PendingClose',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S5'").bind(row.project_id),
      db.prepare("INSERT INTO external_tasks (id,project_id,task_type,target_system,external_task_id,assignee_external_id,assignee_name,status,environment,simulated,request_payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "CONTRACT_HANDOVER_EXECUTION", "CONTRACT_COLLABORATION_SIMULATOR", externalTaskId, "contract-admin-liu", "刘倩", "pending", "demo", 1, JSON.stringify({ projectCode: row.project_code, gateId, gateVersion: Number(row.version), awardBaselineId: baselineId, manifestHash, environment: "demo", simulated: true })),
      db.prepare("INSERT INTO integration_outbox (id,project_id,event_id,event_type,target_system,external_task_id,payload,status,attempts) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, outboxEventId, "ContractHandoverRequested", "CONTRACT_COLLABORATION_SIMULATOR", externalTaskId, JSON.stringify({ eventId: outboxEventId, eventType: "ContractHandoverRequested", sourceSystem: "SALES_PROJECT_APP", targetSystem: "CONTRACT_COLLABORATION_SIMULATOR", projectCode: row.project_code, externalTaskId, assigneeExternalId: "contract-admin-liu", assigneeName: "刘倩", environment: "demo", simulated: true, data: { awardBaselineId: baselineId, manifestHash } }), "pending", 0),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CommercialAwardBaseline", baselineId, DOMAIN_EVENTS.awardBaselineFrozen, JSON.stringify({ ...jsonRecord(after), baselineId, manifestHash }), actor.id),
    );
  } else {
    statements.push(
      db.prepare("UPDATE sales_projects SET result=?,lifecycle_status='成交/未成交',administrative_status='Closed',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S5'").bind(resultType, row.project_id),
      db.prepare("UPDATE loss_termination_reviews SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND result_notice_id=? AND status='ready'").bind(row.project_id, resultNoticeId),
    );
    for (const activity of openManualActivities) {
      const closureCommandId = `SYS-G6-${gateId}-${activity.id}-${Number(row.version)}`;
      const activityEventId = crypto.randomUUID();
      const reason = resultType === "lost" ? "G6确认未中标并完成行政关闭，系统取消开放活动" : "G6确认终止/不投并完成行政关闭，系统取消开放活动";
      const activityPayload = JSON.stringify({ projectCode: row.project_code, activityId: activity.id, definitionCode: activity.definition_code, fromStatus: activity.status, toStatus: "cancelled", reason, gateId, gateVersion: Number(row.version), systemTriggered: true });
      statements.push(
        db.prepare("UPDATE activity_instances SET status='cancelled',actual_end=CURRENT_TIMESTAMP,result=?,exception_reason=?,last_command_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(`已取消：${reason}`, reason, closureCommandId, activity.id, activity.status, Number(activity.version)),
        db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(activityEventId, "ActivityInstance", activity.id, DOMAIN_EVENTS.activityStatusChanged, activityPayload, actor.id, activity.id, closureCommandId),
        db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), activity.id, activity.status, "cancelled", reason, activityEventId, actor.id, activity.id, closureCommandId),
        db.prepare("INSERT INTO activity_evidence_refs (id,activity_instance_id,evidence_type,evidence_ref,created_by) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM activity_instances WHERE id=? AND last_command_id=?)").bind(crypto.randomUUID(), activity.id, "SYSTEM_CLOSURE", `G6:${gateId}@V${Number(row.version)}`, actor.id, activity.id, closureCommandId),
      );
    }
  }
  statements.push(db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G6", resultType === "won" ? "确认赢单并派发合同基线移交" : "确认未成交并完成行政关闭", JSON.stringify({ stage: "S5", result: "pending", gateStatus: "pending" }), after, actor.id));
  try { await db.batch(statements); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|commercial_award_baselines_gate_uq|UNIQUE constraint/i.test(message)) throw new FlowError("G6决策状态已被其他操作更新，请刷新后重试。", 409);
    throw error;
  }
  return { projectCode: row.project_code, gateId, gateStatus: "approved", executionStatus: resultType === "won" ? "executing" : "completed", stage: "S5", resultType, awardBaseline: awardBaselineOutput };
}

export async function completeContractHandover(gateId: string, raw: unknown, actor: DemoActor) {
  if (actor.role !== "contract") throw new FlowError("合同基线接收只能由合同APP责任人回传。", 403);
  if (!raw || typeof raw !== "object") throw new FlowError("合同接收回执格式不正确。", 400);
  const input = raw as Record<string, unknown>;
  const awardBaselineId = requiredText(input.awardBaselineId, "中标基线编号", 120);
  const manifestHash = requiredText(input.manifestHash, "中标基线哈希", 256);
  const contractRef = requiredText(input.contractRef, "合同侧参考号", 500);
  const receiptRef = requiredText(input.receiptRef, "合同接收回执编号", 500);
  const receiptHash = requiredText(input.receiptHash, "合同接收回执哈希", 256);
  const receivedAt = requiredText(input.receivedAt, "合同接收时间", 40);
  if (Number.isNaN(Date.parse(receivedAt))) throw new FlowError("合同接收时间格式不合法。", 400);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,p.project_code,p.owner_user_id,p.owner_name,p.stage,b.manifest_hash,b.status AS baseline_status FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN commercial_award_baselines b ON b.gate_instance_id=g.id AND b.gate_version=g.version WHERE g.id=? AND g.gate_code='G6' AND b.id=?").bind(gateId, awardBaselineId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G6中标基线不存在。", 404);
  if (row.status !== "approved" || row.execution_status !== "executing" || row.stage !== "S5" || row.baseline_status !== "frozen") throw new FlowError("该中标基线当前不能接收。", 409);
  if (manifestHash !== row.manifest_hash) throw new FlowError("合同回执引用哈希与批准中标基线不一致，禁止推进S6。", 409);
  const receiptId = crypto.randomUUID();
  const downstreamTaskId = crypto.randomUUID();
  const downstreamExternalTaskId = `DOWNSTREAM-${String(row.project_code).slice(-6)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const downstreamOutboxEventId = crypto.randomUUID();
  const after = JSON.stringify({ receiptId, projectCode: row.project_code, gateId, gateVersion: Number(row.version), awardBaselineId, manifestHash, contractRef, receiptRef, receiptHash, receivedAt, receivedBy: actor.name });
  const downstreamActivityStatements = createSystemActivityStatements(db, { projectId: String(row.project_id), projectCode: String(row.project_code), definitionCode: "ACT-SPM-08", title: "跟踪成交后合同、订单、履约、开票与回款", purpose: "只读汇总下游权威状态并跟踪销售遗留责任；不在本APP修改专业事实", ownerUserId: String(row.owner_user_id), ownerName: String(row.owner_name), status: "in_progress", plannedStart: receivedAt.slice(0, 10), plannedEnd: addDays(receivedAt, 30), businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }, { objectType: "CommercialAwardBaseline", objectId: awardBaselineId }, { objectType: "ContractHandoverReceipt", objectId: receiptId }], reason: "合同APP接收中标基线，项目进入S6经营跟踪", evidenceRef: receiptRef });
  try {
    await db.batch([
      db.prepare("INSERT INTO contract_handover_receipts (id,project_id,gate_instance_id,gate_version,award_baseline_id,manifest_hash,contract_ref,receipt_ref,receipt_hash,received_by,received_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(receiptId, row.project_id, gateId, Number(row.version), awardBaselineId, manifestHash, contractRef, receiptRef, receiptHash, actor.id, receivedAt, "accepted"),
      db.prepare("UPDATE commercial_award_baselines SET status='transferred',transferred_at=? WHERE id=? AND status='frozen'").bind(receivedAt, awardBaselineId),
      db.prepare("UPDATE stage_gate_instances SET execution_status='completed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='approved' AND execution_status='executing' AND version=?").bind(gateId, Number(row.version)),
      db.prepare("UPDATE sales_projects SET stage='S6',stage_name='赢单后跟踪',lifecycle_status='成交/未成交',result='won',administrative_status='Active',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S5'").bind(row.project_id),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ContractHandoverReceipt", receiptId, DOMAIN_EVENTS.contractHandoverAccepted, after, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G6", "合同APP接收中标基线并推进S6", JSON.stringify({ stage: "S5", executionStatus: "executing" }), after, actor.id),
      db.prepare("INSERT INTO external_tasks (id,project_id,task_type,target_system,external_task_id,assignee_external_id,assignee_name,status,environment,simulated,request_payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(downstreamTaskId, row.project_id, "DOWNSTREAM_STATUS_TRACKING", "CONTRACT_COLLABORATION_SIMULATOR", downstreamExternalTaskId, "contract-admin-liu", "刘倩", "pending", "demo", 1, JSON.stringify({ projectCode: row.project_code, contractRef, awardBaselineId, correlationKey: `G7:${row.project_id}`, scope: ["Contract", "Order", "Delivery", "Acceptance", "Invoice", "Payment"], environment: "demo", simulated: true })),
      db.prepare("INSERT INTO integration_outbox (id,project_id,event_id,event_type,target_system,external_task_id,payload,status,attempts) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, downstreamOutboxEventId, "DownstreamStatusTrackingRequested", "CONTRACT_COLLABORATION_SIMULATOR", downstreamExternalTaskId, JSON.stringify({ eventId: downstreamOutboxEventId, eventType: "DownstreamStatusTrackingRequested", sourceSystem: "SALES_PROJECT_APP", targetSystem: "CONTRACT_COLLABORATION_SIMULATOR", projectCode: row.project_code, externalTaskId: downstreamExternalTaskId, assigneeExternalId: "contract-admin-liu", assigneeName: "刘倩", environment: "demo", simulated: true, data: { contractRef, awardBaselineId } }), "pending", 0),
      ...downstreamActivityStatements,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/contract_handover_receipts_gate_uq|contract_handover_receipts_ref_uq|UNIQUE constraint/i.test(message)) throw new FlowError("该G6版本或合同回执已入账，不能重复接收。", 409);
    throw error;
  }
  return { projectCode: row.project_code, gateId, gateStatus: "approved", executionStatus: "completed", stage: "S6", stageName: "赢单后跟踪", awardBaselineId, contractRef, receiptRef, downstreamTaskId: downstreamExternalTaskId };
}

export async function returnContractHandover(gateId: string, raw: unknown, actor: DemoActor) {
  if (actor.role !== "contract") throw new FlowError("合同基线退回只能由合同APP责任人回传。", 403);
  if (!raw || typeof raw !== "object") throw new FlowError("合同退回信息格式不正确。", 400);
  const input = raw as Record<string, unknown>;
  const awardBaselineId = requiredText(input.awardBaselineId, "中标基线编号", 120);
  const manifestHash = requiredText(input.manifestHash, "中标基线哈希", 256);
  const differenceSummary = requiredText(input.differenceSummary, "合同与最终承诺差异", 3000);
  const remediationRequirement = requiredText(input.remediationRequirement, "退回整改要求", 3000);
  const evidenceRef = requiredText(input.evidenceRef, "合同退回证据", 1000);
  const db = getD1Binding();
  const row = await db.prepare("SELECT g.*,p.project_code,p.stage,b.manifest_hash,b.status AS baseline_status FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN commercial_award_baselines b ON b.gate_instance_id=g.id AND b.gate_version=g.version WHERE g.id=? AND g.gate_code='G6' AND b.id=?").bind(gateId, awardBaselineId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G6中标基线不存在。", 404);
  if (row.status !== "approved" || row.execution_status !== "executing" || row.stage !== "S5" || row.baseline_status !== "frozen") throw new FlowError("该中标基线当前不能退回。", 409);
  if (manifestHash !== row.manifest_hash) throw new FlowError("退回引用的基线哈希与当前批准基线不一致。", 409);
  const after = JSON.stringify({ projectCode: row.project_code, gateId, gateVersion: Number(row.version), awardBaselineId, manifestHash, differenceSummary, remediationRequirement, evidenceRef, returnedBy: actor.name });
  const returnId = crypto.randomUUID();
  await db.batch([
    db.prepare("UPDATE stage_gate_instances SET status='returned',execution_status='not_required',decision_comment=?,completed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='approved' AND execution_status='executing' AND version=?").bind(`合同APP退回，等待整改后形成新版本：${differenceSummary}`, gateId, Number(row.version)),
    db.prepare("INSERT INTO contract_handover_returns (id,project_id,gate_instance_id,gate_version,award_baseline_id,difference_summary,remediation_requirement,return_evidence_ref,status) VALUES (?,?,?,?,?,?,?,?,'pending')").bind(returnId, row.project_id, gateId, Number(row.version), awardBaselineId, differenceSummary, remediationRequirement, evidenceRef),
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "CommercialAwardBaseline", awardBaselineId, "ContractHandoverReturned", after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G6", "合同APP因承诺差异退回中标基线", JSON.stringify({ stage: "S5", executionStatus: "executing", baselineStatus: "frozen" }), after, actor.id),
  ]);
  return { projectCode: row.project_code, gateId, gateStatus: "returned", executionStatus: "not_required", handoverStatus: "returned", stage: "S5", awardBaselineId, returnId, differenceSummary, remediationRequirement, evidenceRef, requiresNewGateVersion: true };
}

const DOWNSTREAM_EVENT_OBJECTS = {
  ContractStatusReported: "Contract",
  OrderStatusReported: "Order",
  DeliveryStatusReported: "Delivery",
  AcceptanceStatusReported: "Acceptance",
  InvoiceStatusReported: "Invoice",
  PaymentStatusReported: "Payment",
} as const;

export async function recordDownstreamBusinessEvent(projectCode: string, metadata: { sourceEventId: string; sourceSystem: string; externalTaskId: string; occurredAt: string; environment: string; simulated: boolean }, raw: unknown, actor: DemoActor) {
  if (actor.role !== "contract") throw new FlowError("下游状态只能由受控下游系统回传。", 403);
  if (!raw || typeof raw !== "object") throw new FlowError("下游业务状态格式不正确。");
  const input = raw as Record<string, unknown>;
  const eventType = String(input.eventType) as keyof typeof DOWNSTREAM_EVENT_OBJECTS;
  const objectType = DOWNSTREAM_EVENT_OBJECTS[eventType];
  if (!objectType) throw new FlowError("下游事件类型不在当前只读契约范围内。");
  const objectRef = requiredText(input.objectRef, "下游业务对象编号", 300);
  const businessStatus = requiredText(input.businessStatus, "下游业务状态", 300);
  const evidenceRef = requiredText(input.evidenceRef, "下游状态证据", 1000);
  const amountYuan = input.amountYuan === undefined || input.amountYuan === null || input.amountYuan === "" ? undefined : Number(input.amountYuan);
  if (amountYuan !== undefined && (!Number.isFinite(amountYuan) || amountYuan < 0 || amountYuan > 100_000_000_000)) throw new FlowError("下游金额不合法。");
  const currency = amountYuan === undefined ? undefined : requiredText(input.currency ?? "CNY", "币种", 12);
  const db = getD1Binding();
  const project = await db.prepare("SELECT id,stage,result FROM sales_projects WHERE project_code=?").bind(projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.stage !== "S6" || project.result !== "won") throw new FlowError("只有已完成G6赢单移交并进入S6的项目可以接收下游只读状态。", 409);
  const id = crypto.randomUUID();
  const payload = JSON.stringify({ projectCode, sourceEventId: metadata.sourceEventId, sourceSystem: metadata.sourceSystem, externalTaskId: metadata.externalTaskId, eventType, objectType, objectRef, businessStatus, amountYuan: amountYuan ?? null, currency: currency ?? null, evidenceRef, occurredAt: metadata.occurredAt, environment: metadata.environment, simulated: metadata.simulated });
  try {
    await db.batch([
      db.prepare("INSERT INTO downstream_business_events (id,project_id,source_system,source_event_id,external_task_id,object_type,object_ref,event_type,business_status,amount_cents,currency,evidence_ref,occurred_at,environment,simulated,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, project.id, metadata.sourceSystem, metadata.sourceEventId, metadata.externalTaskId, objectType, objectRef, eventType, businessStatus, amountYuan === undefined ? null : Math.round(amountYuan * 100), currency ?? null, evidenceRef, metadata.occurredAt, metadata.environment, metadata.simulated ? 1 : 0, payload),
      db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), objectType, objectRef, DOMAIN_EVENTS.downstreamBusinessStatusReported, payload, actor.id),
      db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "G7", `接收${objectType}只读状态`, null, payload, actor.id),
    ]);
  } catch (error) {
    if (/downstream_business_events_source_uq|UNIQUE constraint failed/i.test(String(error))) throw new FlowError("该下游来源事件已入账，不能重复写入。", 409);
    throw error;
  }
  return { downstreamEventId: id, objectType, objectRef, businessStatus, g7ClosureAvailable: false, g7ClosureReason: "企业关闭阈值、超期升级与例外审批规则尚未确认" };
}

/** 将已持久化的S0草稿提交为G1申请；提交成功后才生成Gate和冻结快照。 */
export async function submitG1Draft(projectCode: string, actor: DemoActor) {
  if (actor.role !== "sales") throw new FlowError("G1必须由项目Owner提交；销售主管只能审查或退回，不能代替申请人提交。", 403);
  const db = getD1Binding();
  const row = await db.prepare(`SELECT p.*,i.source_snapshot,i.duplicate_status,
    (SELECT COUNT(*) FROM project_source_links l WHERE l.project_id=p.id AND l.relation_type='converted_from') AS lead_source_count,
    (SELECT COUNT(*) FROM procurement_requests r WHERE r.project_id=p.id AND r.status='effective') AS request_count,
    (SELECT COUNT(*) FROM opportunity_fingerprints f WHERE f.project_id=p.id AND f.verification_status='confirmed') AS fingerprint_count,
    (SELECT COUNT(*) FROM role_assignments a WHERE a.project_id=p.id AND a.role_name='销售Owner' AND a.assignee_name=p.owner_name AND a.status='已到位') AS owner_assignment_count
    FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.project_code=?`).bind(projectCode).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("销售项目不存在。", 404);
  if (row.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以提交G1。", 403);
  if (row.stage !== "S0") throw new FlowError("只有S0待立项项目可以提交G1。", 409);
  const existing = await db.prepare("SELECT id,status FROM stage_gate_instances WHERE project_id=? AND gate_code='G1'").bind(row.id).first<Record<string, string>>();
  if (existing) {
    if (existing.status === "returned") throw new FlowError("G1已被退回，请按退回意见补充后走重新提交，不要新建第二个Gate。", 409);
    throw new FlowError(existing.status === "pending" ? "G1已经提交，正在等待主管审查。" : "G1已经批准。", 409);
  }
  const missing: string[] = [];
  if (!String(row.name ?? "").trim() || !String(row.customer_name ?? "").trim() || !String(row.target ?? "").trim() || Number(row.amount_cents) <= 0) missing.push("客户、项目、产品或预计金额");
  if (!String(row.evidence ?? "").trim() || !String(row.bid_date ?? "").trim()) missing.push("采购证据或客户提交日期");
  if (row.duplicate_status !== "clear" || Number(row.fingerprint_count) < 1) missing.push("机会查重结论");
  if (Number(row.request_count) < 1) missing.push("有效采购请求");
  if (Number(row.lead_source_count) < 1) missing.push("线索转化来源");
  if (Number(row.owner_assignment_count) < 1) missing.push("已到位的销售Owner");
  if (missing.length) throw new FlowError(`G1提交条件未满足：${missing.join("、")}。`, 409);

  const gateId = crypto.randomUUID();
  const currentActivitySnapshot = await buildGateActivitySnapshot(String(row.id), "G1");
  const currentActivity = currentActivitySnapshot.items.find(item => item.definitionCode === "ACT-SPM-01" && item.sourceKind === "owned");
  if (!currentActivity?.sourceId || !["planned", "in_progress"].includes(currentActivity.status)) throw new FlowError("G1立项活动不存在或状态不允许提交，请联系管理员核查ACT-SPM-01。", 409);
  const startsNow = currentActivity.status === "planned";
  const activitySnapshot: GateActivitySnapshot = {
    ...currentActivitySnapshot,
    items: currentActivitySnapshot.items.map(item => item === currentActivity ? { ...item, status: "in_progress", ready: true, instanceVersion: Number(item.instanceVersion ?? 0) + (startsNow ? 1 : 0) } : item),
    hasHardBlocker: false,
    capturedAt: new Date().toISOString(),
  };
  assertGateActivityReady(activitySnapshot, "G1");
  const snapshot = JSON.stringify({ procurementIntent: jsonRecord(row.source_snapshot), activitySnapshot, generatedAt: new Date().toISOString() });
  const after = JSON.stringify({ projectCode, stage: "S0", lifecycleStatus: "待立项", gate: "G1", gateStatus: "pending", gateVersion: 1 });
  const activityEventId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO stage_gate_instances (id,project_id,gate_code,source_stage,target_stage,status,requested_by,definition_version) VALUES (?,?,?,?,?,?,?,?)").bind(gateId, row.id, "G1", "S0", "S1", "pending", actor.id, GATE_DEFINITION_VERSION),
    db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, 1, snapshot, actor.id),
    db.prepare("UPDATE activity_instances SET status='in_progress',actual_start=COALESCE(actual_start,CURRENT_TIMESTAMP),gate_instance_id=?,version=version+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND version=?").bind(gateId, startsNow ? 1 : 0, currentActivity.sourceId, currentActivity.status, Number(currentActivity.instanceVersion)),
  ];
  if (startsNow) statements.push(
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(activityEventId, "ActivityInstance", currentActivity.sourceId, DOMAIN_EVENTS.activityStatusChanged, JSON.stringify({ projectCode, definitionCode: "ACT-SPM-01", fromStatus: "planned", toStatus: "in_progress", gateId }), actor.id),
    db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), currentActivity.sourceId, "planned", "in_progress", "项目Owner提交G1立项申请", activityEventId, actor.id),
  );
  statements.push(
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "StageGate", gateId, DOMAIN_EVENTS.g1ApprovalRequested, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.id, "G1", "项目Owner提交G1", JSON.stringify({ stage: "S0", gateStatus: "draft" }), after, actor.id),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (/stage_gate_instances_project_gate_uq|UNIQUE constraint/i.test(String(error))) throw new FlowError("G1已被其他操作提交，请刷新项目状态。", 409);
    throw error;
  }
  return { projectCode, gateId, gateCode: "G1" as const, gateStatus: "pending" as const, stage: "S0" as const, stageName: "待立项", version: 1 };
}

export async function decideG1(gateId: string, action: G1Action, comment: string, actor: DemoActor, decisionContext: { projectGrade?: string; gradeReason?: string; gradeEvidence?: string } = {}) {
  const db = getD1Binding();
  const row = await db.prepare(`SELECT g.*,p.project_code,p.owner_user_id,p.owner_name,p.project_grade,p.lead_grade,p.project_importance,p.project_importance_reason,p.stage,p.stage_name,p.bid_date,p.detail_snapshot,i.scenario_code,i.intent_type,i.source_snapshot,
    (SELECT s.input_snapshot FROM gate_submission_snapshots s WHERE s.gate_instance_id=g.id AND s.submission_version=g.version) AS input_snapshot
    FROM stage_gate_instances g JOIN sales_projects p ON p.id=g.project_id JOIN procurement_intents i ON i.id=p.procurement_intent_id
    WHERE g.id=? AND g.gate_code='G1'`).bind(gateId).first<Record<string, string | number | null>>();
  if (!row) throw new FlowError("G1审批实例不存在。", 404);
  if (action === "resubmit") {
    if (actor.role !== "sales" || row.owner_user_id !== actor.id) throw new FlowError("只有项目Owner可以重新提交G1。", 403);
  } else if (actor.role !== "manager") throw new FlowError("只有销售主管可以批准或退回G1。", 403);
  if (action === "return" && !comment.trim()) throw new FlowError("退回必须填写补充要求。", 400);
  if (action === "approve" && !comment.trim()) throw new FlowError("批准立项必须填写主管判断意见。", 400);
  const leadGrade = String(row.lead_grade ?? row.project_grade);
  const projectGrade = action === "approve" ? String(decisionContext.projectGrade ?? row.project_grade) : String(row.project_grade);
  if (action === "approve" && !["S", "A", "B", "C"].includes(projectGrade)) throw new FlowError("请选择有效的销售项目等级。", 400);
  const gradeAdjusted = projectGrade !== leadGrade;
  if (action === "approve" && gradeAdjusted && !decisionContext.gradeReason?.trim()) throw new FlowError("调整项目等级必须填写调整原因。", 400);
  if (action === "approve" && gradeAdjusted && !decisionContext.gradeEvidence?.trim()) throw new FlowError("调整项目等级必须提供依据或证据引用。", 400);
  const current = String(row.status) as G1Status;
  let next: G1Status;
  try { next = nextG1Status(current, action); }
  catch { throw new FlowError(`G1当前为${current}，不能执行${action}；请刷新后重试。`, 409); }
  if (action === "approve" && row.definition_version === GATE_DEFINITION_VERSION) {
    const frozen = jsonRecord(row.input_snapshot);
    const currentActivitySnapshot = await buildGateActivitySnapshot(String(row.project_id), "G1");
    assertGateActivityReady(currentActivitySnapshot, "G1");
    if (activitySnapshotFingerprint(currentActivitySnapshot) !== activitySnapshotFingerprint((frozen.activitySnapshot as GateActivitySnapshot | undefined))) throw new FlowError("G1活动来源在提交后发生变化，必须退回并重新提交。", 409);
  }
  const eventType = action === "approve" ? DOMAIN_EVENTS.salesProjectEstablished : action === "return" ? DOMAIN_EVENTS.g1Returned : DOMAIN_EVENTS.g1Resubmitted;
  const before = JSON.stringify({ stage: row.stage, stageName: row.stage_name, gateStatus: current });
  const after = JSON.stringify({ stage: action === "approve" ? "S1" : "S0", stageName: action === "approve" ? "立项与策略" : "待立项", lifecycleStatus: action === "approve" ? "已立项" : "待立项", gateStatus: next, comment, leadGrade, projectGrade, gradeAdjusted, gradeReason: decisionContext.gradeReason ?? null, gradeEvidence: decisionContext.gradeEvidence ?? null });
  const nextVersion = action === "resubmit" ? Number(row.version) + 1 : Number(row.version);
  const decisions = [
    db.prepare("UPDATE stage_gate_instances SET status=?,decided_by=?,decision_comment=?,decided_at=CASE WHEN ?='resubmit' THEN NULL ELSE CURRENT_TIMESTAMP END,requested_at=CASE WHEN ?='resubmit' THEN CURRENT_TIMESTAMP ELSE requested_at END,updated_at=CURRENT_TIMESTAMP,version=? WHERE id=? AND status=? AND version=?").bind(next, action === "resubmit" ? null : actor.id, comment, action, action, nextVersion, gateId, current, Number(row.version)),
  ];
  // resubmit是一次新提交，不是审批结论；新快照升版，随后审批结论引用该版本。
  if (action !== "resubmit") decisions.push(db.prepare("INSERT INTO gate_decisions (id,gate_instance_id,gate_version,decision,comment,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), gateId, Number(row.version), action, comment, actor.id));
  if (action === "resubmit") {
    const submissionVersion = nextVersion;
    const activitySnapshot = await buildGateActivitySnapshot(String(row.project_id), "G1");
    assertGateActivityReady(activitySnapshot, "G1");
    const snapshot = JSON.stringify({ procurementIntent: jsonRecord(row.source_snapshot), activitySnapshot, generatedAt: new Date().toISOString() });
    decisions.push(db.prepare("INSERT INTO gate_submission_snapshots (id,gate_instance_id,submission_version,input_snapshot,submitted_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), gateId, submissionVersion, snapshot, actor.id));
  }
  if (action === "approve") {
    const priorityActivity = await db.prepare("SELECT a.id FROM activity_instances a JOIN activity_definitions d ON d.id=a.definition_id WHERE a.project_id=? AND d.code='ACT-SPM-01' AND a.status='in_progress' ORDER BY a.created_at DESC LIMIT 1").bind(row.project_id).first<{ id: string }>();
    const detail = jsonRecord(row.detail_snapshot);
    const today = new Date().toISOString().slice(0, 10);
    const technicalDate = String(detail.technicalDate ?? row.bid_date).slice(0, 10);
    const shared = { projectId: String(row.project_id), projectCode: String(row.project_code), ownerUserId: String(row.owner_user_id), ownerName: String(row.owner_name), status: "in_progress" as const, plannedStart: today };
    decisions.push(db.prepare("UPDATE sales_projects SET project_grade=?,project_grade_reason=?,project_grade_evidence=?,stage='S1',stage_name='立项与策略',lifecycle_status='已立项',updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND stage='S0'").bind(projectGrade, gradeAdjusted ? decisionContext.gradeReason!.trim() : "G1确认继承线索评级", gradeAdjusted ? decisionContext.gradeEvidence!.trim() : `LEAD_GRADE:${leadGrade}`, row.project_id));
    decisions.push(db.prepare("UPDATE bid_rounds SET status='active',updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND status='registered'").bind(row.project_id));
    decisions.push(
      ...createSystemActivityStatements(db, { ...shared, definitionCode: "ACT-SPM-02", title: "形成并维护项目策略版本", purpose: "围绕客户决策偏好、竞争态势和赢单目标形成可审批策略", plannedEnd: technicalDate, businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }], reason: "G1批准后启动S1策略管理", evidenceRef: `G1:${gateId}@V${Number(row.version)}` }),
      ...createSystemActivityStatements(db, { ...shared, definitionCode: "ACT-SPM-03", title: "覆盖客户关系与决策链", purpose: "持续维护关键关系、影响力和客户决策链变化", plannedEnd: String(row.bid_date).slice(0, 10), businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }], reason: "G1批准后启动客户经营活动", evidenceRef: `G1:${gateId}@V${Number(row.version)}` }),
      ...createSystemActivityStatements(db, { ...shared, definitionCode: "ACT-SPM-04", title: "确认S1策略所需责任资源", purpose: "依据业务场景、策略缺口和伙伴判断提出角色需求，并完成指派、接受与到位确认", plannedEnd: technicalDate, businessObjectRefs: [{ objectType: "SalesProject", objectId: String(row.project_id) }], reason: "G1批准后启动按需资源规划，不预设固定技术角色", evidenceRef: `G1:${gateId}@V${Number(row.version)}` }),
    );
    if (priorityActivity) {
      const activityEventId = crypto.randomUUID();
      const activityPayload = JSON.stringify({ projectCode: row.project_code, definitionCode: "ACT-SPM-01", status: "completed", gateId, completionEvent: "SalesProjectPriorityConfirmed" });
      decisions.push(
        db.prepare("UPDATE activity_instances SET status='completed',actual_end=CURRENT_TIMESTAMP,result='项目已通过G1并完成项目等级与Owner确认',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_progress'").bind(priorityActivity.id),
        db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(activityEventId, "ActivityInstance", priorityActivity.id, DOMAIN_EVENTS.activityStatusChanged, activityPayload, actor.id),
        db.prepare("INSERT INTO activity_transitions (id,activity_instance_id,from_status,to_status,reason,domain_event_id,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), priorityActivity.id, "in_progress", "completed", "G1批准，项目正式纳管", activityEventId, actor.id),
      );
    }
  }
  decisions.push(
    db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "SalesProject", row.project_id, eventType, after, actor.id),
    db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), row.project_id, "G1", action, before, after, actor.id),
  );
  try {
    await db.batch(decisions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/gate_decisions_gate_version_uq|gate_decisions\.gate_instance_id|UNIQUE constraint/i.test(message)) {
      throw new FlowError("审批状态已被其他操作更新，请刷新后重试。", 409);
    }
    throw error;
  }
  if (action === "approve") {
    const scenario = SCENARIO_TYPES.find(item => item.code === row.scenario_code);
    const detail = jsonRecord(row.detail_snapshot);
    const sourceSnapshot = jsonRecord(row.source_snapshot);
    await createExternalTask({
      projectId: String(row.project_id), projectCode: String(row.project_code), taskType: "BID_PREPARATION", correlationKey: gateId,
      assigneeExternalId: "bid-specialist-sun", assigneeName: "孙投标",
      requestPayload: { scenarioCode: row.scenario_code, sourceType: scenario?.requestType ?? row.intent_type, sourceRef: detail.requestRef ?? sourceSnapshot.requestRef ?? sourceSnapshot.tenderNo, bidDeadline: row.bid_date, salesStrategyBoundary: "销售项目赢单策略由销售Owner维护；本任务只形成投标策略和工作计划" },
    });
  }
  return { projectCode: row.project_code, stage: action === "approve" ? "S1" : "S0", stageName: action === "approve" ? "立项与策略" : "待立项", lifecycleStatus: action === "approve" ? "已立项" : "待立项", gateStatus: next, comment, leadGrade, projectGrade, projectGradeReason: gradeAdjusted ? decisionContext.gradeReason : "G1确认继承线索评级" };
}
