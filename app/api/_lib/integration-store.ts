import { getD1Binding } from "@/db";

export type ExternalTaskType = "BID_PREPARATION" | "COMMERCIAL_SOLUTION" | "TECHNICAL_COLLABORATION" | "REQUIREMENT_BASELINE_PREPARATION" | "TECHNICAL_SOLUTION_PREPARATION" | "BOM_AND_CLOSURE_PREPARATION" | "G3_GATE_REVIEW" | "COSTING_COLLABORATION" | "G4_GATE_REVIEW" | "EPC_PRICE_EXCEPTION_APPROVAL" | "BID_PACKAGE_PREPARATION" | "BID_PACKAGE_REVIEW" | "BID_REVIEW_REMEDIATION" | "G5_SUBMISSION_EXECUTION" | "COMMERCIAL_RESULT_TRACKING" | "CONTRACT_HANDOVER_EXECUTION" | "DOWNSTREAM_STATUS_TRACKING";

const TASK_ACTIVITY_CODES: Partial<Record<ExternalTaskType, readonly string[]>> = {
  BID_PREPARATION: ["ACT-BID-02"],
  COMMERCIAL_SOLUTION: ["ACT-BID-03"],
  TECHNICAL_COLLABORATION: ["ACT-BID-04A"],
  REQUIREMENT_BASELINE_PREPARATION: ["ACT-BID-04A"],
  TECHNICAL_SOLUTION_PREPARATION: ["ACT-BID-04B"],
  BOM_AND_CLOSURE_PREPARATION: ["ACT-BID-04B"],
  COSTING_COLLABORATION: ["ACT-BID-04C"],
  BID_PACKAGE_PREPARATION: ["ACT-BID-05"],
  BID_PACKAGE_REVIEW: ["ACT-BID-06"],
  BID_REVIEW_REMEDIATION: ["ACT-BID-06"],
  G5_SUBMISSION_EXECUTION: ["ACT-BID-08"],
  COMMERCIAL_RESULT_TRACKING: ["ACT-BID-09"],
};

export async function upsertExternalActivityProjection(input: {
  projectId: string; taskType: ExternalTaskType; sourceSystem: string; externalTaskId: string; ownerExternalId: string; ownerName: string;
  status: string; sourceEventId?: string; evidenceRefs?: string[]; businessObjectRefs?: Array<Record<string, string>>; blocker?: string; completionEvent?: string;
}) {
  const definitionCodes = TASK_ACTIVITY_CODES[input.taskType];
  if (!definitionCodes?.length) return;
  const db = getD1Binding();
  const sourceUpdatedAt = new Date().toISOString();
  const statements = definitionCodes.map((definitionCode, index) => {
    const externalActivityInstanceId = index === 0 ? input.externalTaskId : `${input.externalTaskId}:${definitionCode}`;
    const businessObjectRefs = input.businessObjectRefs ?? [
      { objectType: "ExternalTask", objectId: input.externalTaskId },
      { objectType: "ActivityDefinition", objectId: definitionCode },
    ];
    return db.prepare(`INSERT INTO external_activity_projections
      (id,project_id,definition_id,source_system,external_activity_instance_id,owner_external_id,owner_name,status,business_object_refs,evidence_refs,blocker,completion_event,source_event_id,environment,simulated,source_updated_at)
      SELECT ?,?,d.id,?,?,?,?,?,?,?,?,CASE WHEN ?='completed' THEN d.completion_event ELSE NULL END,?,?,1,?
      FROM activity_definitions d WHERE d.code=? AND d.active=1 ORDER BY d.version DESC LIMIT 1
      ON CONFLICT(source_system,external_activity_instance_id) DO UPDATE SET definition_id=excluded.definition_id,status=excluded.status,business_object_refs=excluded.business_object_refs,evidence_refs=excluded.evidence_refs,blocker=excluded.blocker,completion_event=excluded.completion_event,source_event_id=excluded.source_event_id,source_updated_at=excluded.source_updated_at,synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`
    ).bind(crypto.randomUUID(), input.projectId, input.sourceSystem, externalActivityInstanceId, input.ownerExternalId, input.ownerName, input.status, JSON.stringify(businessObjectRefs), JSON.stringify(input.evidenceRefs ?? []), input.blocker ?? null, input.status, input.sourceEventId ?? null, "demo", sourceUpdatedAt, definitionCode);
  });
  await db.batch(statements);
}

export async function syncLatestExternalTaskProjection(projectId: string, taskType: ExternalTaskType) {
  if (!TASK_ACTIVITY_CODES[taskType]) return;
  const task = await getD1Binding().prepare("SELECT target_system,external_task_id,assignee_external_id,assignee_name,status FROM external_tasks WHERE project_id=? AND task_type=? ORDER BY created_at DESC LIMIT 1").bind(projectId, taskType).first<Record<string, string>>();
  if (!task) return;
  await upsertExternalActivityProjection({ projectId, taskType, sourceSystem: task.target_system, externalTaskId: task.external_task_id, ownerExternalId: task.assignee_external_id, ownerName: task.assignee_name, status: task.status });
}

export async function createExternalTask(input: {
  projectId: string;
  projectCode: string;
  taskType: ExternalTaskType;
  assigneeExternalId: string;
  assigneeName: string;
  requestPayload: Record<string, unknown>;
  correlationKey?: string;
}) {
  const db = getD1Binding();
  const correlationKey = input.correlationKey ?? "";
  const existing = await db.prepare("SELECT id,external_task_id,status FROM external_tasks WHERE project_id=? AND task_type=? AND status IN ('pending','accepted') AND COALESCE(json_extract(request_payload,'$.correlationKey'),'')=? ORDER BY created_at DESC LIMIT 1").bind(input.projectId, input.taskType, correlationKey).first<Record<string, string>>();
  if (existing) return { id: existing.id, externalTaskId: existing.external_task_id, status: existing.status, created: false };
  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  const taskPrefix: Record<ExternalTaskType, string> = { BID_PREPARATION: "BIDPREP", COMMERCIAL_SOLUTION: "COMSOL", TECHNICAL_COLLABORATION: "TECH", REQUIREMENT_BASELINE_PREPARATION: "REQBASE", TECHNICAL_SOLUTION_PREPARATION: "TECHSOL", BOM_AND_CLOSURE_PREPARATION: "BOM", G3_GATE_REVIEW: "G3", COSTING_COLLABORATION: "COST", G4_GATE_REVIEW: "G4", EPC_PRICE_EXCEPTION_APPROVAL: "EPCPX", BID_PACKAGE_PREPARATION: "BIDPKG", BID_PACKAGE_REVIEW: "BIDREV", BID_REVIEW_REMEDIATION: "BIDFIX", G5_SUBMISSION_EXECUTION: "G5SUB", COMMERCIAL_RESULT_TRACKING: "RESULT", CONTRACT_HANDOVER_EXECUTION: "CONTRACT", DOWNSTREAM_STATUS_TRACKING: "DOWNSTREAM" };
  const technicalTask = ["G3_GATE_REVIEW", "TECHNICAL_COLLABORATION", "REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION"].includes(input.taskType);
  const targetSystem = technicalTask ? "TECHNICAL_COLLABORATION_SIMULATOR" : input.taskType === "G4_GATE_REVIEW" || input.taskType === "COSTING_COLLABORATION" || input.taskType === "EPC_PRICE_EXCEPTION_APPROVAL" ? "COSTING_COLLABORATION_SIMULATOR" : input.taskType === "CONTRACT_HANDOVER_EXECUTION" || input.taskType === "DOWNSTREAM_STATUS_TRACKING" ? "CONTRACT_COLLABORATION_SIMULATOR" : "BID_COLLABORATION_SIMULATOR";
  const externalTaskId = `${taskPrefix[input.taskType]}-${input.projectCode.slice(-6)}-${suffix}`;
  const requestPayloadData = { ...input.requestPayload, correlationKey, projectCode: input.projectCode, environment: "demo", simulated: true };
  const requestPayload = JSON.stringify(requestPayloadData);
  const eventType: Record<ExternalTaskType, string> = { BID_PREPARATION: "BidPreparationRequested", COMMERCIAL_SOLUTION: "CommercialSolutionRequested", TECHNICAL_COLLABORATION: "TechnicalCollaborationRequested", REQUIREMENT_BASELINE_PREPARATION: "RequirementBaselinePreparationRequested", TECHNICAL_SOLUTION_PREPARATION: "TechnicalSolutionPreparationRequested", BOM_AND_CLOSURE_PREPARATION: "BomAndClosurePreparationRequested", G3_GATE_REVIEW: "G3ReviewRequested", COSTING_COLLABORATION: "CostingCollaborationRequested", G4_GATE_REVIEW: "G4ReviewRequested", EPC_PRICE_EXCEPTION_APPROVAL: "EpcPriceExceptionApprovalRequested", BID_PACKAGE_PREPARATION: "BidPackagePreparationRequested", BID_PACKAGE_REVIEW: "BidPackageReviewRequested", BID_REVIEW_REMEDIATION: "BidReviewRemediationRequested", G5_SUBMISSION_EXECUTION: "CommercialSubmissionRequested", COMMERCIAL_RESULT_TRACKING: "CommercialResultTrackingRequested", CONTRACT_HANDOVER_EXECUTION: "ContractHandoverRequested", DOWNSTREAM_STATUS_TRACKING: "DownstreamStatusTrackingRequested" };
  const outboxPayload = JSON.stringify({ eventId, eventType: eventType[input.taskType], sourceSystem: "SALES_PROJECT_APP", targetSystem, projectCode: input.projectCode, externalTaskId, assigneeExternalId: input.assigneeExternalId, assigneeName: input.assigneeName, environment: "demo", simulated: true, data: input.requestPayload });
  await db.batch([
    db.prepare("INSERT INTO external_tasks (id,project_id,task_type,target_system,external_task_id,assignee_external_id,assignee_name,status,environment,simulated,request_payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id, input.projectId, input.taskType, targetSystem, externalTaskId, input.assigneeExternalId, input.assigneeName, "pending", "demo", 1, requestPayload),
    db.prepare("INSERT INTO integration_outbox (id,project_id,event_id,event_type,target_system,external_task_id,payload,status,attempts) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), input.projectId, eventId, eventType[input.taskType], targetSystem, externalTaskId, outboxPayload, "pending", 0),
  ]);
  await upsertExternalActivityProjection({ projectId: input.projectId, taskType: input.taskType, sourceSystem: targetSystem, externalTaskId, ownerExternalId: input.assigneeExternalId, ownerName: input.assigneeName, status: "pending" });
  return { id, externalTaskId, status: "pending", created: true };
}

export async function loadExternalTasks(projectId: string) {
  const result = await getD1Binding().prepare("SELECT id,task_type,target_system,external_task_id,assignee_external_id,assignee_name,status,environment,simulated,request_payload,result_payload,accepted_at,completed_at,created_at,updated_at FROM external_tasks WHERE project_id=? ORDER BY created_at DESC").bind(projectId).all<Record<string, unknown>>();
  return result.results;
}

export async function listIntegrationLabState() {
  const db = getD1Binding();
  const [tasks, events, outbox] = await Promise.all([
    db.prepare(`SELECT t.*,p.project_code,p.name AS project_name,p.stage,p.stage_name,g.id AS review_id,g.status AS review_status,s.input_snapshot AS review_snapshot
      FROM external_tasks t JOIN sales_projects p ON p.id=t.project_id
      LEFT JOIN stage_gate_instances g ON g.project_id=p.id AND ((g.gate_code='G3' AND t.task_type='G3_GATE_REVIEW') OR (g.gate_code='G4' AND t.task_type='G4_GATE_REVIEW') OR (g.gate_code='G5' AND t.task_type='G5_SUBMISSION_EXECUTION') OR (g.gate_code='G6' AND t.task_type='CONTRACT_HANDOVER_EXECUTION'))
      LEFT JOIN gate_submission_snapshots s ON s.gate_instance_id=g.id AND s.submission_version=g.version
      ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,t.updated_at DESC`).all<Record<string, unknown>>(),
    db.prepare("SELECT event_id,event_type,source_system,project_code,external_task_id,actor_id,processing_status,processing_error,received_at,processed_at FROM integration_inbox ORDER BY received_at DESC LIMIT 30").all<Record<string, unknown>>(),
    db.prepare("SELECT event_id,event_type,target_system,external_task_id,status,attempts,created_at,delivered_at,last_error FROM integration_outbox ORDER BY created_at DESC LIMIT 30").all<Record<string, unknown>>(),
  ]);
  return { tasks: tasks.results, events: events.results, outbox: outbox.results, environment: "demo", sourceSystem: "LOCAL_PROFESSIONAL_SYSTEM_SIMULATOR" };
}
