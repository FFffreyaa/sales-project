import { BID_ROUND_EVENT_TYPES, type BidRoundEventEnvelope } from "../../../packages/integration-contracts/src";
import { getD1Binding } from "@/db";
import { FlowError } from "./p0-flow";

const BID_ACTOR_ID = "bid-specialist-sun";
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  registered: ["active", "cancelled"],
  active: ["on_hold", "submitted", "cancelled"],
  on_hold: ["active", "cancelled"],
  submitted: ["resulted"],
  resulted: [],
  cancelled: [],
};

function required(value: unknown, label: string, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw new FlowError(`${label}不能为空。`, 400);
  if (value.trim().length > max) throw new FlowError(`${label}超过${max}字。`, 400);
  return value.trim();
}

function optional(value: unknown, max = 500) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > max) throw new FlowError("投标轮次字段格式不正确。", 400);
  return value.trim();
}

function isoDate(value: unknown, label: string) {
  const result = required(value, label, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new FlowError(`${label}必须为YYYY-MM-DD。`, 400);
  return result;
}

export function parseBidRoundEnvelope(raw: unknown): BidRoundEventEnvelope {
  if (!raw || typeof raw !== "object") throw new FlowError("投标轮次事件格式不正确。", 400);
  const value = raw as Record<string, unknown>;
  const eventType = String(value.eventType);
  if (!BID_ROUND_EVENT_TYPES.includes(eventType as BidRoundEventEnvelope["eventType"])) throw new FlowError("不支持的投标轮次事件类型。", 400);
  if (value.sourceSystem !== "BID_MANAGEMENT_SIMULATOR" || value.environment !== "demo" || value.simulated !== true || value.actorId !== BID_ACTOR_ID) throw new FlowError("当前接口只接受本地投标管理模拟器的权威事件。", 403);
  if (!value.data || typeof value.data !== "object") throw new FlowError("投标轮次事件data不能为空。", 400);
  const data = value.data as Record<string, unknown>;
  const occurredAt = required(value.occurredAt, "事件发生时间", 40);
  if (Number.isNaN(Date.parse(occurredAt))) throw new FlowError("事件发生时间格式不合法。", 400);
  const roundType = optional(data.roundType, 20);
  const status = optional(data.status, 20);
  if (eventType === "BidRoundRegistered" && !["initial", "rebid", "supplement"].includes(String(roundType))) throw new FlowError("登记投标轮次必须明确initial、rebid或supplement。", 400);
  if (eventType === "BidRoundStatusChanged" && !["active", "on_hold", "submitted", "resulted", "cancelled"].includes(String(status))) throw new FlowError("投标轮次目标状态不合法。", 400);
  return {
    eventId: required(value.eventId, "事件ID", 120),
    eventType: eventType as BidRoundEventEnvelope["eventType"],
    sourceSystem: "BID_MANAGEMENT_SIMULATOR",
    environment: "demo",
    simulated: true,
    projectCode: required(value.projectCode, "项目编号", 120),
    actorId: BID_ACTOR_ID,
    occurredAt,
    data: {
      externalBidId: required(data.externalBidId, "外部投标编号", 160),
      roundType: roundType as BidRoundEventEnvelope["data"]["roundType"],
      status: status as BidRoundEventEnvelope["data"]["status"],
      tenderDocumentRef: optional(data.tenderDocumentRef, 500),
      tenderDocumentVersion: optional(data.tenderDocumentVersion, 120),
      tenderDocumentHash: optional(data.tenderDocumentHash, 256),
      bidDeadline: eventType === "BidRoundRegistered" ? isoDate(data.bidDeadline, "投标截止日期") : optional(data.bidDeadline, 20),
      evidenceRef: optional(data.evidenceRef, 1000),
    },
    evidenceRefs: Array.isArray(value.evidenceRefs) ? value.evidenceRefs.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
  };
}

export async function processBidRoundEvent(envelope: BidRoundEventEnvelope) {
  const db = getD1Binding();
  const duplicate = await db.prepare("SELECT source_system,event_type,project_code,external_task_id,actor_id,payload,processing_status,processing_error FROM integration_inbox WHERE event_id=?").bind(envelope.eventId).first<Record<string, string | null>>();
  if (duplicate) {
    const expectedTaskId = `BID-ROUND:${envelope.data.externalBidId}`;
    const sameEvent = duplicate.source_system === envelope.sourceSystem
      && duplicate.event_type === envelope.eventType
      && duplicate.project_code === envelope.projectCode
      && duplicate.external_task_id === expectedTaskId
      && duplicate.actor_id === envelope.actorId
      && duplicate.payload === JSON.stringify(envelope);
    if (!sameEvent) throw new FlowError("事件ID已被另一条不同的投标轮次事件占用；为防止跨项目误去重，已拒绝处理。", 409);
    return { duplicate: true, eventId: envelope.eventId, status: duplicate.processing_status, error: duplicate.processing_error };
  }
  const project = await db.prepare("SELECT p.id,p.stage,p.result,p.administrative_status,i.scenario_code FROM sales_projects p JOIN procurement_intents i ON i.id=p.procurement_intent_id WHERE p.project_code=?").bind(envelope.projectCode).first<Record<string, string>>();
  if (!project) throw new FlowError("销售项目不存在。", 404);
  if (project.scenario_code !== "SCN-01-DIRECT-BID") throw new FlowError("BidRound只属于国内正式招投标场景；国内/海外EPC或伙伴询价使用报价通路，国内客户询价/报价使用报价版本。", 409);
  const inboxId = crypto.randomUUID();
  const syntheticTaskId = `BID-ROUND:${envelope.data.externalBidId}`;
  await db.batch([
    db.prepare("INSERT INTO integration_inbox (id,event_id,source_system,event_type,project_code,external_task_id,environment,simulated,actor_id,occurred_at,payload,processing_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(inboxId, envelope.eventId, envelope.sourceSystem, envelope.eventType, envelope.projectCode, syntheticTaskId, envelope.environment, 1, envelope.actorId, envelope.occurredAt, JSON.stringify(envelope), "received"),
    db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "RECEIVE", "success", `收到${envelope.eventType}`),
  ]);
  try {
    const existing = await db.prepare("SELECT * FROM bid_rounds WHERE authority_system='BID_MANAGEMENT_APP' AND external_bid_id=?").bind(envelope.data.externalBidId).first<Record<string, string | number | null>>();
    let result: Record<string, unknown>;
    if (envelope.eventType === "BidRoundRegistered") {
      if (existing) {
        if (String(existing.project_id) !== project.id) throw new FlowError("该外部投标编号已属于其他销售项目。", 409);
        result = { roundId: existing.id, roundNo: existing.round_no, roundStatus: existing.status, semanticDuplicate: true };
      } else {
        const latest = await db.prepare("SELECT * FROM bid_rounds WHERE project_id=? ORDER BY round_no DESC LIMIT 1").bind(project.id).first<Record<string, string | number | null>>();
        const isInitialBinding = envelope.data.roundType === "initial" && latest && Number(latest.round_no) === 1 && !latest.external_bid_id;
        if (envelope.data.roundType === "initial" && !isInitialBinding) throw new FlowError("一个销售项目只能绑定一个初始投标轮次；后续必须标记rebid或supplement。", 409);
        if (!isInitialBinding && latest && !["submitted", "resulted", "cancelled"].includes(String(latest.status))) throw new FlowError("上一投标轮次尚未提交、出结果或取消，不能并行登记下一轮。", 409);
        const requiresLifecycleDecision = !isInitialBinding && (["S5", "S6"].includes(project.stage) || project.administrative_status === "Closed" || project.result !== "pending");
        const roundStatus = requiresLifecycleDecision ? "on_hold" : "registered";
        const roundId = isInitialBinding ? String(latest!.id) : crypto.randomUUID();
        const roundNo = isInitialBinding ? 1 : Number(latest?.round_no ?? 0) + 1;
        const tenderDocumentRef = envelope.data.tenderDocumentRef ?? String(latest?.tender_document_ref ?? "");
        if (!tenderDocumentRef) throw new FlowError("投标轮次必须提供招标/澄清文件来源。", 400);
        const sourceSnapshot = JSON.stringify(envelope);
        const write = isInitialBinding
          ? db.prepare("UPDATE bid_rounds SET external_bid_id=?,round_type='initial',tender_document_ref=?,tender_document_version=?,tender_document_hash=?,bid_deadline=?,source_event_id=?,source_snapshot=?,latest_synced_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND external_bid_id IS NULL").bind(envelope.data.externalBidId, tenderDocumentRef, envelope.data.tenderDocumentVersion ?? null, envelope.data.tenderDocumentHash ?? null, envelope.data.bidDeadline, envelope.eventId, sourceSnapshot, envelope.occurredAt, roundId)
          : db.prepare("INSERT INTO bid_rounds (id,project_id,round_no,round_type,external_bid_id,authority_system,status,tender_document_ref,tender_document_version,tender_document_hash,bid_deadline,source_event_id,source_snapshot,latest_synced_at) VALUES (?,?,?,?,?,'BID_MANAGEMENT_APP',?,?,?,?,?,?,?,?)").bind(roundId, project.id, roundNo, envelope.data.roundType, envelope.data.externalBidId, roundStatus, tenderDocumentRef, envelope.data.tenderDocumentVersion ?? null, envelope.data.tenderDocumentHash ?? null, envelope.data.bidDeadline, envelope.eventId, sourceSnapshot, envelope.occurredAt);
        const after = JSON.stringify({ roundId, roundNo, roundType: envelope.data.roundType, roundStatus: isInitialBinding ? latest!.status : roundStatus, externalBidId: envelope.data.externalBidId, requiresLifecycleDecision });
        await db.batch([
          write,
          db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "BidRound", roundId, "BidRoundRegistered", after, BID_ACTOR_ID),
          db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "投标轮次", isInitialBinding ? "绑定初始投标轮次权威编号" : requiresLifecycleDecision ? "接收新投标轮次并等待生命周期决策" : "接收新投标轮次", latest ? JSON.stringify({ latestRoundNo: latest.round_no, latestStatus: latest.status, stage: project.stage }) : null, after, BID_ACTOR_ID),
        ]);
        result = { roundId, roundNo, roundStatus: isInitialBinding ? latest!.status : roundStatus, requiresLifecycleDecision };
      }
    } else {
      if (!existing || String(existing.project_id) !== project.id) throw new FlowError("外部投标编号尚未登记到该销售项目。", 404);
      const currentStatus = String(existing.status);
      const targetStatus = String(envelope.data.status);
      if (existing.latest_synced_at && Date.parse(envelope.occurredAt) < Date.parse(String(existing.latest_synced_at))) throw new FlowError("投标轮次事件发生时间早于当前快照，按乱序事件拒绝。", 409);
      if (currentStatus === targetStatus) {
        result = { roundId: existing.id, roundNo: existing.round_no, roundStatus: currentStatus, semanticDuplicate: true };
      } else {
        if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus)) throw new FlowError(`投标轮次不允许从${currentStatus}直接变为${targetStatus}。`, 409);
        if (currentStatus === "on_hold" && targetStatus === "active" && !["S1", "S2", "S3", "S4"].includes(project.stage)) throw new FlowError("该轮次等待销售项目生命周期重启决策，当前不能直接激活。", 409);
        if (targetStatus === "resulted" && project.stage !== "S5") throw new FlowError("投标轮次出结果时销售项目必须已进入S5。", 409);
        const after = JSON.stringify({ roundId: existing.id, roundNo: existing.round_no, from: currentStatus, to: targetStatus, externalBidId: envelope.data.externalBidId, evidenceRef: envelope.data.evidenceRef });
        await db.batch([
          db.prepare("UPDATE bid_rounds SET status=?,source_event_id=?,source_snapshot=?,latest_synced_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?").bind(targetStatus, envelope.eventId, JSON.stringify(envelope), envelope.occurredAt, existing.id, currentStatus),
          db.prepare("INSERT INTO domain_events (id,aggregate_type,aggregate_id,event_type,payload,actor_user_id) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "BidRound", existing.id, "BidRoundStatusChanged", after, BID_ACTOR_ID),
          db.prepare("INSERT INTO audit_records (id,project_id,category,action,before_state,after_state,actor_user_id) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), project.id, "投标轮次", "接收投标轮次状态变更", JSON.stringify({ status: currentStatus }), after, BID_ACTOR_ID),
        ]);
        result = { roundId: existing.id, roundNo: existing.round_no, roundStatus: targetStatus };
      }
    }
    await db.batch([
      db.prepare("UPDATE integration_inbox SET processing_status='processed',processed_at=CURRENT_TIMESTAMP WHERE id=?").bind(inboxId),
      db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "PROCESS", "success", `${envelope.eventType}处理成功`),
    ]);
    return { duplicate: false, eventId: envelope.eventId, status: "processed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "投标轮次事件处理失败";
    await db.batch([
      db.prepare("UPDATE integration_inbox SET processing_status='rejected',processing_error=?,processed_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, inboxId),
      db.prepare("INSERT INTO integration_event_logs (id,inbox_id,action,status,detail) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), inboxId, "PROCESS", "rejected", message),
    ]);
    if (error instanceof FlowError) throw error;
    throw new FlowError(message, 500);
  }
}
