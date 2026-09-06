import { INTEGRATION_EVENT_TYPES, type IntegrationEventEnvelope } from "../../../packages/integration-contracts/src";
import { getD1Binding } from "@/db";
import { completeContractHandover, completeG5Submission, decideEpcPriceException, decideG3, decideG4, FlowError, parseBidPackage, parseBidPreparation, parseBomAndClosure, parseCommercialResult, parseCommercialSolution, parseCostingAssessment, parsePricingAuthorization, parseProfessionalReview, parseProfessionalReviewRemediation, parseRequirementBaseline, parseSolutionPreparation, parseTechnicalSolution, recordDownstreamBusinessEvent, returnContractHandover, saveBidPackage, saveBidPreparation, saveBomAndClosure, saveCommercialResult, saveCommercialSolution, saveCostingAssessment, saveProfessionalReview, saveProfessionalReviewRemediation, saveRequirementBaselineCandidate, saveSolutionPreparation, saveTechnicalSolutionCandidate, type DemoActor } from "./p0-flow";
import { createExternalTask, upsertExternalActivityProjection, type ExternalTaskType } from "./integration-store";

const TECHNICAL_ACTOR: DemoActor = { id: "technical-zhao", role: "technical", name: "赵工" };
const REQUIREMENT_OWNER_ACTOR: DemoActor = { id: "requirement-owner-demo", role: "technical", name: "需求基线责任人（演示）" };
const SOLUTION_DESIGNER_ACTOR: DemoActor = { id: "solution-designer-demo", role: "technical", name: "方案设计责任人（演示）" };
const TECHNICAL_REVIEWER_ACTOR: DemoActor = { id: "technical-reviewer-wang", role: "technical_reviewer", name: "王评审" };
const COSTING_ACTOR: DemoActor = { id: "costing-liu", role: "costing", name: "刘工" };
const AUTHORIZER_ACTOR: DemoActor = { id: "authorizer-luo", role: "authorizer", name: "罗总" };
const BID_ACTOR: DemoActor = { id: "bid-specialist-sun", role: "bid", name: "孙投标" };
const COMMERCIAL_ACTOR: DemoActor = { id: "commercial-manager-tang", role: "commercial", name: "唐商务" };
const PROFESSIONAL_REVIEWER_ACTOR: DemoActor = { id: "professional-reviewer-wu", role: "professional_reviewer", name: "吴评审" };
const BID_TECHNICAL_REVIEWER_ACTOR: DemoActor = { id: "bid-technical-reviewer-qian", role: "professional_reviewer", name: "钱技术评审" };
const QUALIFICATION_REVIEWER_ACTOR: DemoActor = { id: "qualification-reviewer-he", role: "professional_reviewer", name: "何资质评审" };
const CONTRACT_ACTOR: DemoActor = { id: "contract-admin-liu", role: "contract", name: "刘倩" };

function required(value: unknown, label: string, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw new FlowError(`${label}不能为空。`);
  if (value.trim().length > max) throw new FlowError(`${label}超过${max}字。`);
  return value.trim();
}

export function parseIntegrationEnvelope(raw: unknown): IntegrationEventEnvelope {
  if (!raw || typeof raw !== "object") throw new FlowError("集成事件格式不正确。");
  const data = raw as Record<string, unknown>;
  const eventType = String(data.eventType);
  if (!INTEGRATION_EVENT_TYPES.includes(eventType as IntegrationEventEnvelope["eventType"])) throw new FlowError("不支持的集成事件类型。");
  if (!["TECHNICAL_COLLABORATION_SIMULATOR", "COSTING_COLLABORATION_SIMULATOR", "BID_COLLABORATION_SIMULATOR", "CONTRACT_COLLABORATION_SIMULATOR"].includes(String(data.sourceSystem)) || data.environment !== "demo" || data.simulated !== true) throw new FlowError("当前接口只接受本地演示实验室事件。", 403);
  if (!["technical-zhao", "requirement-owner-demo", "solution-designer-demo", "technical-reviewer-wang", "costing-liu", "authorizer-luo", "bid-specialist-sun", "commercial-manager-tang", "professional-reviewer-wu", "bid-technical-reviewer-qian", "qualification-reviewer-he", "contract-admin-liu"].includes(String(data.actorId))) throw new FlowError("当前专业模拟身份不合法。", 403);
  if (!data.data || typeof data.data !== "object") throw new FlowError("集成事件data不能为空。");
  const occurredAt = required(data.occurredAt, "事件发生时间", 40);
  if (Number.isNaN(Date.parse(occurredAt))) throw new FlowError("事件发生时间格式不合法。");
  return {
    eventId: required(data.eventId, "事件ID", 120),
    eventType: eventType as IntegrationEventEnvelope["eventType"],
    sourceSystem: data.sourceSystem as IntegrationEventEnvelope["sourceSystem"],
    environment: "demo",
    simulated: true,
    projectCode: required(data.projectCode, "项目编号", 120),
    externalTaskId: required(data.externalTaskId, "外部任务编号", 160),
    actorId: data.actorId as IntegrationEventEnvelope["actorId"],
    occurredAt,
    data: data.data as Record<string, unknown>,
    evidenceRefs: Array.isArray(data.evidenceRefs) ? data.evidenceRefs.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
  };
}

export async function processIntegrationEvent(envelope: IntegrationEventEnvelope) {
  const db = getD1Binding();
  const duplicate = await db.prepare("SELECT id,source_system,event_type,project_code,external_task_id,actor_id,payload,processing_status,processing_error FROM integration_inbox WHERE event_id=?").bind(envelope.eventId).first<Record<string, string | null>>();
  if (duplicate) {
    const sameEvent = duplicate.source_system === envelope.sourceSystem
      && duplicate.event_type === envelope.eventType
      && duplicate.project_code === envelope.projectCode
      && duplicate.external_task_id === envelope.externalTaskId
      && duplicate.actor_id === envelope.actorId
      && duplicate.payload === JSON.stringify(envelope);
    if (!sameEvent) throw new FlowError("事件ID已被另一条不同的集成事件占用；为防止跨项目或跨任务误去重，已拒绝处理。", 409);
    return { duplicate: true, eventId: envelope.eventId, status: duplicate.processing_status, error: duplicate.processing_error };
  }
  const task = await db.prepare("SELECT t.*,p.project_code,p.stage FROM external_tasks t JOIN sales_projects p ON p.id=t.project_id WHERE t.external_task_id=?").bind(envelope.externalTaskId).first<Record<string, string | number | null>>();
  if (!task || task.project_code !== envelope.projectCode) throw new FlowError("外部任务不存在或不属于该销售项目。", 404);
  if (task.assignee_external_id !== envelope.actorId) throw new FlowError("事件操作者不是外部任务指定责任人。", 403);
  if (task.target_system !== envelope.sourceSystem) throw new FlowError("事件来源系统与任务目标系统不一致。", 403);
  const inboxId = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO integration_inbox (id,event_id,source_system,event_type,project_code,external_task_id,environment,simulated,actor_id,occurred_at,payload,processing_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(inboxId, envelope.eventId, envelope.sourceSystem, envelope.eventType, envelope.projectCode, envelope.externalTaskId, envelope.environment, 1, envelope.actorId, envelope.occurredAt, JSON.stringify(envelope), "received"),
    db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "RECEIVE", "success", `收到${envelope.eventType}`),
  ]);
  try {
    let result: Record<string, unknown>;
    if (envelope.eventType === "ExternalTaskAccepted") {
      if (task.status !== "pending") throw new FlowError("只有待接受的外部任务可以接受。", 409);
      const actor = envelope.actorId === "technical-zhao" ? TECHNICAL_ACTOR : envelope.actorId === "requirement-owner-demo" ? REQUIREMENT_OWNER_ACTOR : envelope.actorId === "solution-designer-demo" ? SOLUTION_DESIGNER_ACTOR : envelope.actorId === "technical-reviewer-wang" ? TECHNICAL_REVIEWER_ACTOR : envelope.actorId === "costing-liu" ? COSTING_ACTOR : envelope.actorId === "authorizer-luo" ? AUTHORIZER_ACTOR : envelope.actorId === "commercial-manager-tang" ? COMMERCIAL_ACTOR : envelope.actorId === "professional-reviewer-wu" ? PROFESSIONAL_REVIEWER_ACTOR : envelope.actorId === "bid-technical-reviewer-qian" ? BID_TECHNICAL_REVIEWER_ACTOR : envelope.actorId === "qualification-reviewer-he" ? QUALIFICATION_REVIEWER_ACTOR : envelope.actorId === "contract-admin-liu" ? CONTRACT_ACTOR : BID_ACTOR;
      const taskAcceptedEvent = task.task_type === "BID_PREPARATION" ? "BidPreparationTaskAccepted" : task.task_type === "COMMERCIAL_SOLUTION" ? "CommercialSolutionTaskAccepted" : task.task_type === "TECHNICAL_COLLABORATION" ? "TechnicalOwnerAccepted" : task.task_type === "REQUIREMENT_BASELINE_PREPARATION" ? "RequirementBaselineResponsibilityAccepted" : task.task_type === "TECHNICAL_SOLUTION_PREPARATION" ? "TechnicalSolutionResponsibilityAccepted" : task.task_type === "BOM_AND_CLOSURE_PREPARATION" ? "BomAndClosureResponsibilityAccepted" : task.task_type === "COSTING_COLLABORATION" ? "CostingTaskAccepted" : task.task_type === "BID_PACKAGE_PREPARATION" ? "BidPackageTaskAccepted" : task.task_type === "BID_REVIEW_REMEDIATION" ? "BidReviewRemediationTaskAccepted" : task.task_type === "G5_SUBMISSION_EXECUTION" ? "CommercialSubmissionTaskAccepted" : task.task_type === "COMMERCIAL_RESULT_TRACKING" ? "CommercialResultTaskAccepted" : task.task_type === "DOWNSTREAM_STATUS_TRACKING" ? "DownstreamStatusTrackingAccepted" : "ContractHandoverTaskAccepted";
      const taskAcceptedAction = task.task_type === "BID_PREPARATION" ? "投标专员接受投标准备任务" : task.task_type === "COMMERCIAL_SOLUTION" ? "商务经理接受商务方案任务" : task.task_type === "TECHNICAL_COLLABORATION" ? "技术负责人接受启动评估任务" : task.task_type === "REQUIREMENT_BASELINE_PREPARATION" ? "需求基线责任人接受工作包" : task.task_type === "TECHNICAL_SOLUTION_PREPARATION" ? "技术方案责任人接受工作包" : task.task_type === "BOM_AND_CLOSURE_PREPARATION" ? "方案设计责任人接受BOM与问题闭环工作包" : task.task_type === "COSTING_COLLABORATION" ? "核价人员接受任务" : task.task_type === "BID_PACKAGE_PREPARATION" ? "投标专员接受提交包编制任务" : task.task_type === "BID_REVIEW_REMEDIATION" ? "投标专员接受专业评审整改任务" : task.task_type === "G5_SUBMISSION_EXECUTION" ? "投标专员接受正式提交任务" : task.task_type === "COMMERCIAL_RESULT_TRACKING" ? "投标专员接受结果跟踪任务" : task.task_type === "DOWNSTREAM_STATUS_TRACKING" ? "合同管理员接受下游只读状态跟踪任务" : "合同管理员接受中标基线移交任务";
      const statements = [
        db.prepare("UPDATE external_tasks SET status='accepted',accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(task.id),
        db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "ExternalTask", task.id, taskAcceptedEvent, JSON.stringify(envelope), actor.id),
        db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), task.project_id, "外部协同", taskAcceptedAction, JSON.stringify({ status: task.status }), JSON.stringify({ status: "accepted", externalTaskId: envelope.externalTaskId, simulated: true }), actor.id),
      ];
      if (task.task_type === "TECHNICAL_COLLABORATION") {
        statements.push(db.prepare("UPDATE role_assignments SET status='已到位',accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND role_name='技术负责人' AND assignee_name=?").bind(task.project_id, task.assignee_name));
        statements.push(db.prepare("UPDATE resource_requests SET status='fulfilled',fulfilled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND role_name='技术负责人' AND status='assigned'").bind(task.project_id));
      }
      if (!["BID_PREPARATION", "COMMERCIAL_SOLUTION", "TECHNICAL_COLLABORATION", "REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION", "COSTING_COLLABORATION", "BID_PACKAGE_PREPARATION", "BID_REVIEW_REMEDIATION", "G5_SUBMISSION_EXECUTION", "COMMERCIAL_RESULT_TRACKING", "CONTRACT_HANDOVER_EXECUTION", "DOWNSTREAM_STATUS_TRACKING"].includes(String(task.task_type))) throw new FlowError("该审核任务无需接受，请直接形成审核结论。", 409);
      await db.batch(statements);
      result = { taskStatus: "accepted", roleStatus: task.task_type === "TECHNICAL_COLLABORATION" ? "已到位" : undefined };
    } else if (envelope.eventType === "BidPreparationCompleted") {
      if (task.status !== "accepted" || task.task_type !== "BID_PREPARATION") throw new FlowError("投标准备任务尚未接受或任务类型不匹配。", 409);
      result = await saveBidPreparation(envelope.projectCode, parseBidPreparation(envelope.data), BID_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "CommercialSolutionCompleted") {
      if (task.status !== "accepted" || task.task_type !== "COMMERCIAL_SOLUTION") throw new FlowError("商务方案任务尚未接受或任务类型不匹配。", 409);
      result = await saveCommercialSolution(envelope.projectCode, parseCommercialSolution(envelope.data), COMMERCIAL_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "SolutionPreparationCompleted") {
      if (task.status !== "accepted" || task.task_type !== "TECHNICAL_COLLABORATION") throw new FlowError("技术协同任务尚未接受或任务类型不匹配。", 409);
      result = await saveSolutionPreparation(envelope.projectCode, parseSolutionPreparation(envelope.data), TECHNICAL_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
      const correlationKey = String(result.id ?? task.id);
      await createExternalTask({ projectId: String(task.project_id), projectCode: envelope.projectCode, taskType: "REQUIREMENT_BASELINE_PREPARATION", correlationKey, assigneeExternalId: "requirement-owner-demo", assigneeName: "需求基线责任人（演示）", requestPayload: { predecessorTaskId: task.external_task_id, responsibility: "把需求澄清包转为可追溯正式需求基线；不替销售维护客户关系。" } });
      await createExternalTask({ projectId: String(task.project_id), projectCode: envelope.projectCode, taskType: "TECHNICAL_SOLUTION_PREPARATION", correlationKey, assigneeExternalId: "technical-zhao", assigneeName: "赵工", requestPayload: { predecessorTaskId: task.external_task_id, responsibility: "基于当前正式需求基线形成技术方案。" } });
      await createExternalTask({ projectId: String(task.project_id), projectCode: envelope.projectCode, taskType: "BOM_AND_CLOSURE_PREPARATION", correlationKey, assigneeExternalId: "solution-designer-demo", assigneeName: "方案设计责任人（演示）", requestPayload: { predecessorTaskId: task.external_task_id, responsibility: "基于当前技术方案形成报价设计BOM，并按问题责任闭环澄清和偏差。" } });
    } else if (envelope.eventType === "RequirementBaselinePrepared") {
      if (task.status !== "accepted" || task.task_type !== "REQUIREMENT_BASELINE_PREPARATION") throw new FlowError("需求基线工作包尚未接受或任务类型不匹配。", 409);
      result = await saveRequirementBaselineCandidate(envelope.projectCode, parseRequirementBaseline(envelope.data), REQUIREMENT_OWNER_ACTOR, "REQUIREMENT_BASELINE_PREPARATION") as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs, objectState: "requirement_baseline_ready" }), task.id).run();
    } else if (envelope.eventType === "TechnicalSolutionPrepared") {
      if (task.status !== "accepted" || task.task_type !== "TECHNICAL_SOLUTION_PREPARATION") throw new FlowError("技术方案工作包尚未接受或任务类型不匹配。", 409);
      result = await saveTechnicalSolutionCandidate(envelope.projectCode, parseTechnicalSolution(envelope.data), TECHNICAL_ACTOR, "TECHNICAL_SOLUTION_PREPARATION") as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs, objectState: "technical_solution_ready" }), task.id).run();
    } else if (envelope.eventType === "BomAndClosureCompleted") {
      if (task.status !== "accepted" || task.task_type !== "BOM_AND_CLOSURE_PREPARATION") throw new FlowError("BOM与问题闭环工作包尚未接受或任务类型不匹配。", 409);
      result = await saveBomAndClosure(envelope.projectCode, parseBomAndClosure(envelope.data), SOLUTION_DESIGNER_ACTOR, "BOM_AND_CLOSURE_PREPARATION") as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "G3DecisionSubmitted") {
      if (task.status !== "pending" || task.task_type !== "G3_GATE_REVIEW") throw new FlowError("G3外部任务状态或类型不匹配。", 409);
      const action = envelope.data.action;
      if (action !== "approve" && action !== "return") throw new FlowError("G3决策动作不合法。");
      const gateId = required(envelope.data.gateId, "G3实例编号", 120);
      const comment = required(envelope.data.comment, "技术确认意见", 1000);
      result = await decideG3(gateId, action, comment, TECHNICAL_REVIEWER_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status=?,result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(action === "approve" ? "completed" : "returned", JSON.stringify({ eventId: envelope.eventId, action, comment }), task.id).run();
    } else if (envelope.eventType === "CostingAssessmentCompleted") {
      if (task.status !== "accepted" || task.task_type !== "COSTING_COLLABORATION") throw new FlowError("核价协同任务尚未接受或任务类型不匹配。", 409);
      result = await saveCostingAssessment(envelope.projectCode, parseCostingAssessment(envelope.data), COSTING_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "G4DecisionSubmitted") {
      if (task.status !== "pending" || task.task_type !== "G4_GATE_REVIEW") throw new FlowError("G4外部任务状态或类型不匹配。", 409);
      const action = envelope.data.action;
      if (action !== "approve" && action !== "return") throw new FlowError("G4决策动作不合法。");
      const gateId = required(envelope.data.gateId, "G4实例编号", 120);
      const comment = required(envelope.data.comment, "财务授权意见", 1000);
      const authorization = action === "approve" ? parsePricingAuthorization(envelope.data) : undefined;
      result = await decideG4(gateId, action, comment, AUTHORIZER_ACTOR, authorization) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status=?,result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(action === "approve" ? "completed" : "returned", JSON.stringify({ eventId: envelope.eventId, action, comment }), task.id).run();
    } else if (envelope.eventType === "EpcPriceExceptionDecisionSubmitted") {
      if (task.status !== "pending" || task.task_type !== "EPC_PRICE_EXCEPTION_APPROVAL") throw new FlowError("EPC价格例外任务状态或类型不匹配。", 409);
      const action = envelope.data.action;
      if (action !== "approve" && action !== "return" && action !== "reject") throw new FlowError("EPC价格例外决策动作不合法。", 400);
      const exceptionId = required(envelope.data.exceptionId, "价格例外编号", 120);
      const comment = required(envelope.data.comment, "价格授权意见", 1000);
      result = await decideEpcPriceException(exceptionId, action, comment, AUTHORIZER_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status=?,result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(action === "approve" ? "completed" : action === "return" ? "returned" : "rejected", JSON.stringify({ eventId: envelope.eventId, action, comment }), task.id).run();
    } else if (envelope.eventType === "BidPackagePrepared") {
      if (task.status !== "accepted" || task.task_type !== "BID_PACKAGE_PREPARATION") throw new FlowError("投标包编制任务尚未接受或任务类型不匹配。", 409);
      result = await saveBidPackage(envelope.projectCode, parseBidPackage(envelope.data), BID_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "BidPackageReviewSubmitted") {
      if (task.status !== "pending" || task.task_type !== "BID_PACKAGE_REVIEW") throw new FlowError("投标包专业评审任务状态或类型不匹配。", 409);
      const parsedReview = parseProfessionalReview(envelope.data);
      const taskPayload = typeof task.request_payload === "string" ? JSON.parse(task.request_payload) as Record<string, unknown> : task.request_payload && typeof task.request_payload === "object" ? task.request_payload as Record<string, unknown> : {};
      if (parsedReview.reviewType !== taskPayload.reviewType) throw new FlowError("回传的专业评审类型与指定任务不一致。", 409);
      const reviewActor = envelope.actorId === "professional-reviewer-wu" ? PROFESSIONAL_REVIEWER_ACTOR : envelope.actorId === "bid-technical-reviewer-qian" ? BID_TECHNICAL_REVIEWER_ACTOR : envelope.actorId === "qualification-reviewer-he" ? QUALIFICATION_REVIEWER_ACTOR : null;
      if (!reviewActor) throw new FlowError("当前身份不是该专业评审任务指定评审人。", 403);
      result = await saveProfessionalReview(envelope.projectCode, parsedReview, reviewActor) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "BidReviewRemediationSubmitted") {
      if (task.status !== "accepted" || task.task_type !== "BID_REVIEW_REMEDIATION") throw new FlowError("专业评审整改任务尚未接受或任务类型不匹配。", 409);
      result = await saveProfessionalReviewRemediation(envelope.projectCode, parseProfessionalReviewRemediation(envelope.data), BID_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "CommercialSubmissionAccepted") {
      if (task.status !== "accepted" || task.task_type !== "G5_SUBMISSION_EXECUTION") throw new FlowError("正式提交任务尚未接受或任务类型不匹配。", 409);
      const gateId = required(envelope.data.gateId, "G5实例编号", 120);
      result = await completeG5Submission(gateId, envelope.data, BID_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "CommercialResultReported") {
      if (task.status !== "accepted" || task.task_type !== "COMMERCIAL_RESULT_TRACKING") throw new FlowError("结果跟踪任务尚未接受或任务类型不匹配。", 409);
      result = await saveCommercialResult(envelope.projectCode, parseCommercialResult(envelope.data), BID_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "ContractHandoverAccepted") {
      if (task.status !== "accepted" || task.task_type !== "CONTRACT_HANDOVER_EXECUTION") throw new FlowError("合同移交任务尚未接受或任务类型不匹配。", 409);
      const gateId = required(envelope.data.gateId, "G6实例编号", 120);
      result = await completeContractHandover(gateId, envelope.data, CONTRACT_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='completed',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "ContractHandoverReturned") {
      if (task.status !== "accepted" || task.task_type !== "CONTRACT_HANDOVER_EXECUTION") throw new FlowError("合同移交任务尚未接受或任务类型不匹配。", 409);
      const gateId = required(envelope.data.gateId, "G6实例编号", 120);
      result = await returnContractHandover(gateId, envelope.data, CONTRACT_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET status='returned',result_payload=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ eventId: envelope.eventId, type: envelope.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else if (envelope.eventType === "DownstreamBusinessStatusReported") {
      if (task.status !== "accepted" || task.task_type !== "DOWNSTREAM_STATUS_TRACKING") throw new FlowError("下游状态跟踪任务尚未接受或任务类型不匹配。", 409);
      result = await recordDownstreamBusinessEvent(envelope.projectCode, { sourceEventId: envelope.eventId, sourceSystem: envelope.sourceSystem, externalTaskId: envelope.externalTaskId, occurredAt: envelope.occurredAt, environment: envelope.environment, simulated: envelope.simulated }, envelope.data, CONTRACT_ACTOR) as unknown as Record<string, unknown>;
      await db.prepare("UPDATE external_tasks SET result_payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({ latestEventId: envelope.eventId, type: envelope.data.eventType, evidenceRefs: envelope.evidenceRefs }), task.id).run();
    } else {
      throw new FlowError("不支持的集成事件类型。", 400);
    }
    const currentTask = await db.prepare("SELECT status FROM external_tasks WHERE id=?").bind(task.id).first<{ status: string }>();
    const objectRefs = Object.entries(result).filter(([key, value]) => /Id$/.test(key) && typeof value === "string").map(([key, value]) => ({ objectType: key.replace(/Id$/, ""), objectId: String(value) }));
    await upsertExternalActivityProjection({ projectId: String(task.project_id), taskType: String(task.task_type) as ExternalTaskType, sourceSystem: envelope.sourceSystem, externalTaskId: envelope.externalTaskId, ownerExternalId: String(task.assignee_external_id), ownerName: String(task.assignee_name), status: currentTask?.status ?? String(task.status), sourceEventId: envelope.eventId, evidenceRefs: envelope.evidenceRefs, businessObjectRefs: objectRefs.length ? objectRefs : undefined, completionEvent: currentTask?.status === "completed" ? envelope.eventType : undefined });
    await db.batch([
      db.prepare("UPDATE integration_inbox SET processing_status='processed',processed_at=CURRENT_TIMESTAMP WHERE id=?").bind(inboxId),
      db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "PROCESS", "success", `${envelope.eventType}处理成功`),
      db.prepare("UPDATE integration_outbox SET status='delivered',attempts=attempts+1,delivered_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE external_task_id=? AND status='pending'").bind(envelope.externalTaskId),
    ]);
    return { duplicate: false, eventId: envelope.eventId, status: "processed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "集成事件处理失败";
    await db.batch([
      db.prepare("UPDATE integration_inbox SET processing_status='rejected',processing_error=?,processed_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, inboxId),
      db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "PROCESS", "rejected", message),
    ]);
    if (error instanceof FlowError) throw error;
    throw new FlowError(message, 500);
  }
}
