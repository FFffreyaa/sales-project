"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArtifactVersion,
  DetailTab,
  glossary,
  initialProjects,
  LeadGrade,
  LostReview,
  ProjectAction,
  ProjectImportance,
  RiskLevel,
  ProjectStage,
  Relationship,
  Role,
  SalesProject,
  probabilityLabel,
  stageDefinitions,
  submissionTimingLabel,
  View,
} from "./demo-data";
import RoleDashboard from "./RoleDashboard";
import {
  ActionsWorkspace,
  GateWorkspace,
  OverviewWorkspace,
  RelationsWorkspace,
  ResultWorkspace,
  RulesWorkspace,
  StrategyWorkspace,
  VersionsWorkspace,
} from "./CoreWorkspaces";
import {
  ConfigurationCenter,
  DecisionCenter,
  ResourceCenter,
  ReviewCenter,
  RiskCenter,
  SalesActionCenter,
} from "./OperationalWorkspaces";
import { isEpcScenarioCode } from "./domain/sales-project-contract";
import { SCENARIO_TYPES, type ActivityCommand, type G2PreparationInput, type G2ReadinessSnapshot, type G5ReadinessSnapshot, type G6ReadinessSnapshot, type PersistedActivityRecord, type RequirementSourceInput, type S2ReadinessSnapshot, type S3ReadinessSnapshot, type ScenarioType } from "./domain/sales-project-contract";

const detailTabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "项目驾驶舱" },
  { id: "relations", label: "客户与关系" },
  { id: "strategy", label: "竞争与策略" },
  { id: "resources", label: "伙伴与资源" },
  { id: "actions", label: "里程碑与行动" },
  { id: "versions", label: "标的物配置" },
  { id: "gate", label: "阶段门" },
  { id: "result", label: "结果与移交" },
];

const stageMap = Object.fromEntries(stageDefinitions.map((stage) => [stage.code, stage]));

function money(value: number) {
  return `${value.toLocaleString("zh-CN")} 万元`;
}

function relationshipHealth(items: Relationship[]) {
  const weights: Record<Relationship["layer"], number> = { "客户高层": 0.6, "商务决策链": 0.2, "技术层": 0.2 };
  const attitudeScore: Record<Relationship["attitude"], number> = { "支持": 100, "中立": 50, "反对": 0 };
  return Math.round((Object.keys(weights) as Relationship["layer"][]).reduce((total, layer) => {
    const covered = items.filter((item) => item.layer === layer && item.evidence.trim());
    const layerScore = covered.length ? covered.reduce((sum, item) => sum + attitudeScore[item.attitude], 0) / covered.length : 0;
    return total + layerScore * weights[layer];
  }, 0));
}

function statusTone(value: string) {
  if (["生效", "已批准", "已提交", "已到位", "已完成", "已接收", "低", "支持"].includes(value)) return "success";
  if (["重大", "高", "缺失", "已延期", "待审批", "需要重新评审", "反对", "已拒绝"].includes(value)) return "danger";
  if (["中", "待接受", "进行中", "待提交", "等待结果", "草稿", "中立", "处理中"].includes(value)) return "warning";
  return "neutral";
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const text = String(children);
  return <span className={`badge ${tone ?? statusTone(text)}`}><span className="badge-dot" />{children}</span>;
}

function Term({ children }: { children: string }) {
  const item = glossary.find(([term]) => term === children);
  return <button type="button" className="term" data-tip={item?.[1] ?? "业务术语"}>{children}<span aria-hidden="true">?</span></button>;
}

function Modal({ title, children, onClose, wide = false, drawer = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; drawer?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className={`modal ${wide ? "modal-wide" : ""} ${drawer ? "modal-drawer" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><div><span className="eyebrow">演示操作</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭">×</button></div>
        {children}
      </section>
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="empty"><div className="empty-mark">○</div><strong>{title}</strong><p>{description}</p></div>;
}

function Progress({ value, label }: { value: number; label: string }) {
  const band = value >= 80 ? "healthy" : value >= 60 ? "attention" : "critical";
  return <div className={`progress-item ${band}`}><div className="progress-ring" style={{ "--value": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><span>{value}</span></div><div><strong>{label}</strong><small>{value >= 80 ? "良好" : value >= 60 ? "需关注" : "存在缺口"}</small></div></div>;
}

type AgentMessage = { role: "agent" | "user"; text: string };
type AuditCategory = "全部" | "来源" | "关系" | "版本" | "审批" | "行动";
type AuditRecord = { id: string; category: Exclude<AuditCategory, "全部">; title: string; detail: string; actor: string; time: string; status: string; tab: DetailTab };
type PersistedGate = { id: string; code?: "G1" | "G2" | "G3" | "G4" | "G5" | "G6"; status: "pending" | "returned" | "approved"; executionStatus?: "not_required" | "executing" | "completed"; comment?: string; version?: number };
type DataMode = "loading" | "business" | "sample" | "error";
type PartnerAction = "need" | "register" | "verify" | "contribution";
type LeadConversionRow = Record<string, unknown> & {
  id: string; lead_id: string; lead_code: string; source_system?: string; lead_type: "tender" | "demand"; lead_grade?: "S" | "A" | "B" | "C"; lead_score?: number;
  status: "pending_confirmation" | "auto_converted" | "manually_converted" | "rejected"; source_channel: string; authenticity_status: string;
  assigned_owner_external_id?: string; assigned_owner_name?: string; customer_name: string; final_customer_name?: string; project_name: string; region?: string; industry?: string;
  product_scope: string; quantity?: string; amount_type: "exact" | "range" | "unknown"; amount_min_cents?: number; amount_max_cents?: number; procurement_progress?: string;
  suggested_scenario_code?: ScenarioType; request_ref?: string; request_date?: string; tender_no?: string; lot_no?: string; delivery_location?: string; submission_deadline?: string;
  grade_assessment?: Record<string, unknown>; major_project?: number | boolean; major_project_basis?: string; authenticity_basis?: string; submitter_snapshot?: Record<string, unknown>;
  business_context?: Record<string, unknown>; customer_master_snapshot?: Record<string, unknown>; attachment_snapshot?: Array<Record<string, unknown>>; contact_snapshot?: Array<Record<string, unknown>>; followup_snapshot?: Array<Record<string, unknown>>;
  evidence_refs: string[]; field_provenance: Record<string, unknown>; source_snapshot?: string | Record<string, unknown>; processing_error?: string; project_code?: string; stage?: ProjectStage; occurred_at: string;
};
type PersistedProjectRow = Record<string, unknown> & {
  project_code: string; procurement_intent_id: string; name: string; customer_name: string; target: string; amount_cents: number;
  project_grade: LeadGrade; lead_grade?: LeadGrade | null; project_grade_reason?: string | null; project_grade_evidence?: string | null; project_importance?: ProjectImportance | null; project_importance_reason?: string | null;
  organization: string; owner_name: string; stage: ProjectStage; stage_name: string;
  bid_date: string; evidence: string; scenario_code?: ScenarioType; intent_type: string; source_snapshot: string | Record<string, unknown>;
  detail_snapshot: string | Record<string, unknown>; gate_id?: string; gate_code?: string;
  gate_status?: PersistedGate["status"]; gate_comment?: string;
  gate_execution_status?: PersistedGate["executionStatus"];
  gate_input_snapshot?: string | Record<string, unknown>;
  strategy_source_record?: Record<string, unknown> | null;
  relationship_source_records?: Array<Record<string, unknown>>;
  role_assignment_records?: Array<Record<string, unknown>>;
  resource_request_records?: Array<Record<string, unknown>>;
  resource_candidate_records?: Array<Record<string, unknown>>;
  project_risk_records?: Array<Record<string, unknown>>;
  competitor_fact_records?: Array<Record<string, unknown>>;
  opportunity_fingerprint_record?: Record<string, unknown> | null;
  procurement_request_records?: Array<Record<string, unknown>>;
  party_role_records?: Array<Record<string, unknown>>;
  partner_need_decision_record?: Record<string, unknown> | null;
  partner_records?: Array<Record<string, unknown>>;
  solution_preparation_record?: Record<string, unknown> | null;
  g2_readiness_snapshot?: G2ReadinessSnapshot;
  s2_readiness_snapshot?: S2ReadinessSnapshot;
  s3_readiness_snapshot?: S3ReadinessSnapshot;
  g5_readiness_snapshot?: G5ReadinessSnapshot;
  g5_reopen_request_record?: Record<string, unknown> | null;
  g6_readiness_snapshot?: G6ReadinessSnapshot;
  requirement_clarification_package_record?: Record<string, unknown> | null;
  requirement_version_record?: Record<string, unknown> | null;
  technical_solution_version_record?: Record<string, unknown> | null;
  quotation_design_bom_record?: Record<string, unknown> | null;
  pricing_snapshot_record?: Record<string, unknown> | null;
  costing_solution_version_record?: Record<string, unknown> | null;
  commercial_submission_record?: Record<string, unknown> | null;
  commercial_award_baseline_record?: Record<string, unknown> | null;
  contract_handover_receipt_record?: Record<string, unknown> | null;
  external_task_records?: Array<Record<string, unknown>>;
  downstream_business_event_records?: Array<Record<string, unknown>>;
  project_source_link_records?: Array<Record<string, unknown>>;
  lead_requirement_snapshot_record?: Record<string, unknown> | null;
  bid_round_records?: Array<Record<string, unknown>>;
  activity_records?: PersistedActivityRecord[];
  milestone_records?: Array<Record<string, unknown>>;
  artifact_baseline_item_records?: Array<Record<string, unknown>>;
};

function recordOf(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringArrayOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item));
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed.map(item => String(item)) : []; }
  catch { return []; }
}

function leadAmountText(lead: LeadConversionRow) {
  if (lead.amount_type === "exact" && lead.amount_min_cents) return `${lead.amount_min_cents / 1_000_000}万元`;
  if (lead.amount_type === "range" && lead.amount_min_cents !== undefined && lead.amount_max_cents !== undefined) return `${lead.amount_min_cents / 1_000_000}–${lead.amount_max_cents / 1_000_000}万元`;
  return "金额待确认";
}

function leadAuthenticityText(status: string) {
  if (status === "verified") return "真实性审核通过";
  if (status === "manual_confirmed") return "来源样本已确认";
  return "真实性待确认";
}

function leadSourceChannelText(channel: string) {
  return ({ wechat: "企业微信", miniprogram: "小程序", pc: "PC端" } as Record<string, string>)[channel] ?? channel;
}

function leadScenarioCode(lead: LeadConversionRow): ScenarioType | "" {
  if (SCENARIO_TYPES.some(item => item.code === lead.suggested_scenario_code)) return lead.suggested_scenario_code as ScenarioType;
  const fixtureId = String(lead.field_provenance?.fixtureId ?? "");
  const fixtureNumber = Number(fixtureId.match(/(\d+)$/)?.[1]);
  if (lead.source_system === "LEAD_MANAGEMENT_SIMULATOR" && Number.isFinite(fixtureNumber)) return SCENARIO_TYPES[(fixtureNumber - 1) % SCENARIO_TYPES.length].code;
  return "";
}

function leadScenarioSourceText(lead: LeadConversionRow) {
  if (/本地联调|本地测试/u.test(String(lead.field_provenance?.scenarioCode ?? ""))) return "本地测试设定";
  return SCENARIO_TYPES.some(item => item.code === lead.suggested_scenario_code) ? "线索APP带入" : leadScenarioCode(lead) ? "本地测试设定" : "不可转化";
}

function g2InputFromSnapshot(value: string | Record<string, unknown>): G2PreparationInput {
  const snapshot = recordOf(value);
  return (snapshot.input ? recordOf(snapshot.input as string | Record<string, unknown>) : snapshot) as G2PreparationInput;
}

function persistedToDemoProject(row: PersistedProjectRow): SalesProject {
  const detail = recordOf(row.detail_snapshot);
  const source = recordOf(row.source_snapshot);
  const leadSource = source.leadSource && typeof source.leadSource === "object" ? source.leadSource as Record<string, unknown> : {};
  const originalLeadSnapshot = leadSource.originalSnapshot && typeof leadSource.originalSnapshot === "object" ? leadSource.originalSnapshot as Record<string, unknown> : {};
  const originalLead = originalLeadSnapshot.lead && typeof originalLeadSnapshot.lead === "object" ? originalLeadSnapshot.lead as Record<string, unknown> : {};
  const originalOpportunity = originalLeadSnapshot.opportunity && typeof originalLeadSnapshot.opportunity === "object" ? originalLeadSnapshot.opportunity as Record<string, unknown> : {};
  const legacyIntentType = String(row.intent_type || source.intentType || "RFQ");
  const fallbackScenarioCode: ScenarioType = legacyIntentType === "渠道机会" || legacyIntentType === "EPCInquiry" ? "SCN-02-EPC-INQUIRY" : legacyIntentType === "标书" || legacyIntentType === "公开招标" || legacyIntentType === "TenderRequest" ? "SCN-01-DIRECT-BID" : "SCN-03-DIRECT-RFQ";
  const scenarioDefinition = SCENARIO_TYPES.find(item => item.code === (row.scenario_code ?? source.scenarioCode)) ?? SCENARIO_TYPES.find(item => item.code === fallbackScenarioCode)!;
  const intentType = scenarioDefinition.name;
  const requirementDate = String(detail.requirementDate ?? row.bid_date);
  const firstAction = String(detail.firstAction ?? "确认客户采购事实");
  const persistedActivityRecords = row.activity_records ?? [];
  const persistedActions: ProjectAction[] = persistedActivityRecords.filter(item => item.trackType === "SALES_PROJECT_MANAGEMENT").map(item => ({
    id: item.id,
    type: item.definitionCode,
    title: item.title,
    purpose: item.purpose,
    owner: item.ownerName,
    due: item.plannedEnd,
    status: item.status === "completed" ? "已完成" : item.status === "in_progress" ? "进行中" : item.status === "blocked" || item.timelinessStatus === "overdue" ? "已延期" : "待开始",
    evidence: item.evidenceRefs.join("；") || "待形成",
    result: item.result ?? item.exceptionReason ?? "待执行",
    plannedStart: item.plannedStart,
    plannedEnd: item.plannedEnd,
    actualStart: item.actualStart,
    actualEnd: item.actualEnd,
    context: item.businessObjectRefs.some(ref => ref.objectType === "PostAwardResponsibility") ? "post_award_responsibility" : "project_operation",
  }));
  const rawGateSnapshot = row.gate_code === "G2" && row.gate_input_snapshot ? recordOf(row.gate_input_snapshot as string | Record<string, unknown>) : undefined;
  const g2Preparation = rawGateSnapshot ? (rawGateSnapshot.input ? recordOf(rawGateSnapshot.input as string | Record<string, unknown>) : rawGateSnapshot) as G2PreparationInput : row.g2_readiness_snapshot?.input;
  const persistedRelationships = (row.relationship_source_records ?? []).map(item => ({ id: String(item.id), layer: String(item.layer) as Relationship["layer"], name: String(item.person_name), title: String(item.title), attitude: String(item.attitude) as Relationship["attitude"], influence: String(item.influence) as Relationship["influence"], owner: String(item.owner_name), evidence: String(item.evidence_ref), lastTouch: String(item.last_touch_at) }));
  const persistedResources = (row.role_assignment_records ?? []).map(item => ({ id: String(item.id), role: String(item.role_name), person: String(item.assignee_name), status: String(item.status) as "已到位" | "待接受" | "缺失", required: Boolean(item.required), due: row.bid_date, dataSource: `角色指派记录 ${String(item.id)}` }));
  const professionalRoleByTask: Record<string, string> = { BID_PREPARATION: "投标专员", COMMERCIAL_SOLUTION: "商务经理", TECHNICAL_COLLABORATION: "技术负责人", REQUIREMENT_BASELINE_PREPARATION: "需求基线责任人", TECHNICAL_SOLUTION_PREPARATION: "技术方案责任人", BOM_AND_CLOSURE_PREPARATION: "方案设计责任人", G3_GATE_REVIEW: "技术评审人", COSTING_COLLABORATION: "核价负责人", G4_GATE_REVIEW: "价格授权人", EPC_PRICE_EXCEPTION_APPROVAL: "价格授权人", BID_PACKAGE_PREPARATION: "投标专员", BID_PACKAGE_REVIEW: "专业评审人", G5_SUBMISSION_EXECUTION: "投标专员", COMMERCIAL_RESULT_TRACKING: "投标专员", CONTRACT_HANDOVER_EXECUTION: "合同管理员", DOWNSTREAM_STATUS_TRACKING: "合同管理员" };
  const professionalResources = Array.from((row.external_task_records ?? []).reduce((roles, task) => {
    const roleName = professionalRoleByTask[String(task.task_type)];
    if (!roleName || roles.has(roleName)) return roles;
    const taskStatus = String(task.status);
    const accepted = Boolean(task.accepted_at) || ["accepted", "completed", "returned"].includes(taskStatus);
    roles.set(roleName, { id: `EXT-ROLE-${String(task.id)}`, role: roleName, person: String(task.assignee_name), status: (accepted ? "已到位" : ["rejected", "cancelled"].includes(taskStatus) ? "缺失" : "待接受") as "已到位" | "待接受" | "缺失", required: true, due: row.bid_date, dataSource: `外部任务 ${String(task.external_task_id)}｜${String(task.target_system)}` });
    return roles;
  }, new Map<string, { id: string; role: string; person: string; status: "已到位" | "待接受" | "缺失"; required: boolean; due: string; dataSource: string }>()).values());
  const hydratedResources = [
    ...persistedResources,
    ...professionalResources.filter(item => !persistedResources.some(resource => resource.role === item.role)),
    ...(!persistedResources.some(item => item.role === "销售Owner") ? [{ id: `RES-${row.project_code}`, role: "销售Owner", person: row.owner_name, status: "已到位" as const, required: true, due: row.bid_date }] : []),
  ];
  const resourceRequests = (row.resource_request_records ?? []).map(item => ({
    id: String(item.id), role: String(item.role_name), requirement: String(item.requirement), requiredBy: String(item.required_by), evidence: String(item.evidence_ref),
    status: (item.status === "pending" ? "待指派" : item.status === "assigned" ? "待接受" : item.status === "fulfilled" ? "已到位" : "已取消") as "待指派" | "待接受" | "已到位" | "已取消",
  }));
  const resourceCandidates: NonNullable<SalesProject["resourceCandidates"]> = (row.resource_candidate_records ?? []).map(item => ({
    id: String(item.id), role: String(item.role_name), name: String(item.candidate_name), sourceSystem: String(item.source_system), sourceRef: String(item.source_ref),
    capabilities: stringArrayOf(item.capabilities), load: item.load_percent === null || item.load_percent === undefined ? undefined : Number(item.load_percent),
    activeProjects: item.active_project_count === null || item.active_project_count === undefined ? undefined : Number(item.active_project_count),
    availableFrom: item.available_from ? String(item.available_from) : undefined,
    status: (item.status === "selected" ? "已选定" : item.status === "rejected" ? "已拒绝" : item.status === "withdrawn" ? "已撤回" : "候选") as "候选" | "已选定" | "已拒绝" | "已撤回",
    evidence: String(item.evidence_ref), simulated: Boolean(item.simulated),
  }));
  const persistedRisks = (row.project_risk_records ?? []).map(item => ({
    id: String(item.id), level: String(item.level) as RiskLevel, category: String(item.category), title: String(item.title), owner: String(item.owner_name), due: String(item.due_date),
    status: (item.status === "open" ? "开放" : item.status === "mitigating" ? "处理中" : "已关闭") as "开放" | "处理中" | "已关闭", evidence: String(item.closure_evidence_ref ?? item.evidence_ref),
    description: String(item.description), impact: String(item.impact), resolution: item.resolution ? String(item.resolution) : undefined, version: Number(item.version ?? 1),
  }));
  const openRiskLevels = persistedRisks.filter(item => item.status !== "已关闭").map(item => item.level);
  const persistedRiskLevel: RiskLevel = openRiskLevels.includes("重大") ? "重大" : openRiskLevels.includes("高") ? "高" : openRiskLevels.includes("中") ? "中" : openRiskLevels.includes("低") ? "低" : "待评估";
  const strategyRecord = row.strategy_source_record;
  const strategyPayload = strategyRecord?.strategy_payload ? recordOf(String(strategyRecord.strategy_payload)) : {};
  const persistedMilestones: SalesProject["milestones"] = (row.milestone_records ?? []).map(item => ({
    id: String(item.id), title: String(item.title), plannedAt: String(item.planned_at), actualAt: item.actual_at ? String(item.actual_at) : "—", owner: String(item.owner_name),
    status: item.status === "completed" ? "已完成" : item.status === "in_progress" ? "进行中" : item.status === "blocked" ? "受阻" : "未开始",
    dependency: String(item.dependency_ref ?? "无前置依赖"), completionCriteria: String(item.completion_criteria), evidence: String(item.evidence_ref ?? "待形成"), critical: item.milestone_type === "Gate锚点",
    milestoneType: String(item.milestone_type) as "项目管理" | "客户节点" | "外部作业" | "Gate锚点", evidenceRequirement: String(item.evidence_requirement), sourceType: String(item.source_type) as "management" | "gate" | "external_event", version: Number(item.version ?? 1),
  }));
  const isEpcScenario = isEpcScenarioCode(scenarioDefinition.code);
  const fingerprintRecord = row.opportunity_fingerprint_record;
  const procurementRequest = row.procurement_request_records?.[0];
  const projectSourceLink = row.project_source_link_records?.[0];
  const sourceLinkSnapshot = projectSourceLink ? recordOf(String(projectSourceLink.source_snapshot ?? "{}")) : {};
  const sourceLinkLead = sourceLinkSnapshot.lead && typeof sourceLinkSnapshot.lead === "object" ? sourceLinkSnapshot.lead as Record<string, unknown> : {};
  const sourceLinkCompetitors = Array.isArray(sourceLinkSnapshot.competitors) ? sourceLinkSnapshot.competitors : [];
  const sourceLinkKeyRoles = Array.isArray(sourceLinkSnapshot.keyRoles) ? sourceLinkSnapshot.keyRoles : [];
  const sourceLinkPartners = Array.isArray(sourceLinkSnapshot.partners) ? sourceLinkSnapshot.partners : [];
  const sourceLinkParties = Array.isArray(sourceLinkSnapshot.parties) ? sourceLinkSnapshot.parties : [];
  const sourceLinkContacts = Array.isArray(sourceLinkSnapshot.contacts) ? sourceLinkSnapshot.contacts : [];
  const sourceLinkFollowups = Array.isArray(sourceLinkSnapshot.followups) ? sourceLinkSnapshot.followups : [];
  const sourceLinkAttachments = Array.isArray(sourceLinkSnapshot.attachments) ? sourceLinkSnapshot.attachments : [];
  const sourceLinkProvenance = projectSourceLink ? recordOf(String(projectSourceLink.field_provenance ?? "{}")) : {};
  const leadRequirementRow = row.lead_requirement_snapshot_record;
  const leadRequirementSnapshot = leadRequirementRow ? recordOf(String(leadRequirementRow.requirement_snapshot ?? "{}")) : {};
  const bidRoundRecords = row.bid_round_records ?? [];
  const mappedBidRounds = bidRoundRecords.map(record => ({
    id: String(record.id), roundNo: Number(record.round_no), roundType: String(record.round_type), status: String(record.status), authoritySystem: String(record.authority_system), tenderDocumentRef: String(record.tender_document_ref), bidDeadline: String(record.bid_deadline), externalBidId: record.external_bid_id ? String(record.external_bid_id) : undefined,
  }));
  const bidRoundRecord = mappedBidRounds.at(-1);
  const endCustomerParty = row.party_role_records?.find(item => item.role_type === "end_customer");
  const inquiryCustomerParties = (row.party_role_records ?? []).filter(item => item.role_type === "inquiry_customer");
  const partnerNeedDecision = row.partner_need_decision_record;
  const partnerRecord = row.partner_records?.[0];
  const partnerContributionRows = (row.partner_records ?? []).filter(item => item.id === partnerRecord?.id && item.contribution_id);
  const pricingSource = row.pricing_snapshot_record;
  const pricingContextTrusted = Boolean(pricingSource?.source && pricingSource?.source_version && pricingSource?.currency && pricingSource?.tax_basis && pricingSource?.trade_terms && pricingSource?.evidence_ref);
  const rawPricingAuthorization = row.g5_readiness_snapshot?.pricingAuthorization;
  const pricingAuthorizationTrusted = Boolean(pricingContextTrusted && rawPricingAuthorization?.pricing_snapshot_id === pricingSource?.id && rawPricingAuthorization?.currency && rawPricingAuthorization?.tax_basis && rawPricingAuthorization?.trade_terms && rawPricingAuthorization?.exception_conditions);
  const pricingAuthorization = pricingAuthorizationTrusted ? rawPricingAuthorization : undefined;
  const persistedQuotationRoutes = (row.g5_readiness_snapshot?.routeReadiness ?? []).map(item => {
    const route = item.route;
    const bidPackage = item.bidPackage;
    const exception = item.priceException;
    const routeResult = row.g6_readiness_snapshot?.routeResults?.find(result => String(result.route_id) === String(route.id));
    return {
      id: String(route.id), epcCustomer: String(route.epc_customer), inquiryRequests: 1,
      quoteVersion: bidPackage ? `V${String(bidPackage.version)}` : "待形成",
      quotedAmount: pricingAuthorizationTrusted ? Number(bidPackage?.quoted_price_cents ?? item.expectedPriceCents ?? 0) / 1_000_000 : 0,
      authorizedFloorPrice: pricingAuthorizationTrusted ? Number(pricingAuthorization?.floor_price_cents ?? 0) / 1_000_000 : 0,
      status: (routeResult?.result_type === "won" ? "中标" : routeResult?.result_type === "lost" ? "未中标" : bidPackage?.status === "submitted" ? "等待结果" : bidPackage ? "已报价" : "待报价") as "待报价" | "已报价" | "等待结果" | "中标" | "未中标",
      pricingConclusion: (pricingAuthorizationTrusted ? exception?.status === "approved" ? "条款差异已授权" : exception?.status === "pending" ? "待授权" : "同标同价" : "待授权") as "同标同价" | "条款差异已授权" | "待授权",
      contractCustomer: String(route.epc_customer), evidence: String(route.evidence_ref), updatedAt: String(route.updated_at ?? route.inquiry_date),
    };
  });
  const scenarioContext: NonNullable<SalesProject["scenarioContext"]> = {
    scenario: scenarioDefinition.name,
    procurementRequestType: scenarioDefinition.requestType,
    endCustomer: String(endCustomerParty?.display_name ?? fingerprintRecord?.final_customer_name ?? row.customer_name),
    projectCountry: String(detail.projectCountry ?? source.projectCountry ?? ""),
    deliveryCountry: String(detail.deliveryCountry ?? source.deliveryCountry ?? ""),
    procurementFingerprint: String(fingerprintRecord?.fingerprint_key ?? `LEGACY:${row.project_code}`),
    submissionObject: scenarioDefinition.submissionType,
    projectAmountRule: isEpcScenario ? "项目预计金额按最终业主采购机会只计一次；EPC报价通路不相加" : "一个可独立报价、决策和形成结果的采购机会对应一个SalesProject",
    relationshipViews: { endCustomer: persistedRelationships.filter(item => item.layer === "客户高层").length, procurementCustomer: inquiryCustomerParties.length },
    quotationRoutes: persistedQuotationRoutes,
    bidRound: bidRoundRecord,
    bidRounds: mappedBidRounds,
  };
  const countdown = Math.ceil((new Date(`${row.bid_date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  const versionStatus = (value: unknown): ArtifactVersion["status"] => value === "approved" ? "已批准" : value === "effective" ? "生效" : value === "superseded" ? "历史" : "草稿";
  const persistedVersions: ArtifactVersion[] = [];
  if (row.requirement_clarification_package_record) persistedVersions.push({ id: String(row.requirement_clarification_package_record.id), kind: "需求澄清包", version: `V${String(row.requirement_clarification_package_record.version)}`, status: versionStatus(row.requirement_clarification_package_record.status), createdAt: String(row.requirement_clarification_package_record.created_at ?? "D1记录"), creator: row.owner_name, approver: "—", basedOn: String(row.requirement_clarification_package_record.source_ref ?? row.lead_requirement_snapshot_record?.id ?? row.procurement_intent_id), summary: String(row.requirement_clarification_package_record.original_text ?? "客户需求原文、来源与澄清边界") });
  if (row.requirement_version_record) persistedVersions.push({ id: String(row.requirement_version_record.id), kind: "客户需求", version: `V${String(row.requirement_version_record.version)}`, status: versionStatus(row.requirement_version_record.status), createdAt: String(row.requirement_version_record.created_at ?? "D1记录"), creator: "专业作业回传", approver: row.requirement_version_record.status === "approved" ? "独立技术评审人" : "待独立评审", basedOn: String(row.requirement_version_record.clarification_package_id ?? row.requirement_version_record.source_ref ?? row.procurement_intent_id), summary: String(row.requirement_version_record.original_text ?? "正式客户需求基线") });
  if (row.technical_solution_version_record) persistedVersions.push({ id: String(row.technical_solution_version_record.id), kind: "技术方案", version: `V${String(row.technical_solution_version_record.version)}`, status: versionStatus(row.technical_solution_version_record.status), createdAt: String(row.technical_solution_version_record.created_at ?? "D1记录"), creator: "赵工", approver: row.technical_solution_version_record.approved_by ? "赵工" : "—", basedOn: String(row.technical_solution_version_record.requirement_version_id ?? "—"), summary: String(row.technical_solution_version_record.initial_technical_solution ?? "技术方案版本") });
  if (row.quotation_design_bom_record) persistedVersions.push({ id: String(row.quotation_design_bom_record.id), kind: "设计BOM", version: `V${String(row.quotation_design_bom_record.version)}`, status: versionStatus(row.quotation_design_bom_record.status), createdAt: String(row.quotation_design_bom_record.created_at ?? "D1记录"), creator: "赵工", approver: row.quotation_design_bom_record.approved_by ? "赵工" : "—", basedOn: String(row.quotation_design_bom_record.technical_solution_version_id ?? "—"), summary: String(row.quotation_design_bom_record.configuration_summary ?? "报价设计BOM") });
  if (row.costing_solution_version_record) {
    const costing = row.costing_solution_version_record;
    const costAmount = ["material_cost_cents", "labor_cost_cents", "manufacturing_cost_cents", "transport_cost_cents", "tax_cost_cents"].reduce((sum, key) => sum + Number(costing[key] ?? 0), 0) / 1_000_000;
    persistedVersions.push({ id: String(costing.id), kind: "核价方案", version: `V${String(costing.version)}`, status: pricingContextTrusted ? versionStatus(costing.status) : "需要重新评审", createdAt: String(costing.created_at ?? "D1记录"), creator: "刘工", approver: pricingContextTrusted && costing.approved_by ? "罗总" : "—", basedOn: String(costing.design_bom_version_id ?? "—"), summary: pricingContextTrusted ? `完整成本、利润与交期结论｜毛利率 ${(Number(costing.gross_margin_bp ?? 0) / 100).toFixed(2)}%｜${String(pricingSource?.source)}@${String(pricingSource?.source_version)}` : "历史模拟结果缺少价格来源版本、币种税费或贸易条件，金额不作为有效经营结论；须重新接收规范化权威来源", ...(pricingContextTrusted ? { amount: Number(costing.costing_sales_price_cents ?? 0) / 1_000_000, amountLabel: "核价销售价", costAmount, riskReserveAmount: Number(costing.risk_reserve_cents ?? 0) / 1_000_000, grossMarginRate: Number(costing.gross_margin_bp ?? 0) / 100 } : {}) });
  }
  const bidPackage = row.g5_readiness_snapshot?.bidPackageVersion;
  const commercialSubmission = row.commercial_submission_record;
  const awardBaseline = row.commercial_award_baseline_record;
  const handoverReceipt = row.contract_handover_receipt_record;
  const baselineRows = row.artifact_baseline_item_records ?? [];
  const baselineFieldMeta: Record<string, { label: string; group: "产品范围" | "技术参数" | "交付服务" | "商务条款" }> = {
    model: { label: "型号", group: "产品范围" }, quantity: { label: "数量", group: "产品范围" }, key_parameter: { label: "关键参数", group: "技术参数" }, supply_scope: { label: "供货范围", group: "产品范围" }, delivery_time: { label: "交期", group: "交付服务" }, delivery_location: { label: "交付地点", group: "交付服务" }, acceptance: { label: "验收条件", group: "商务条款" }, payment: { label: "付款条件", group: "商务条款" },
  };
  const persistedConfigurationItems = [...new Set(baselineRows.map(item => String(item.field_code)))].map(fieldCode => {
    const requirementItem = baselineRows.find(item => item.field_code === fieldCode && item.artifact_kind === "requirement");
    const solutionItem = baselineRows.find(item => item.field_code === fieldCode && item.artifact_kind === "solution_bom");
    const requirementValue = requirementItem ? `${String(requirementItem.value_text)}${requirementItem.unit ? String(requirementItem.unit) : ""}` : "未提供";
    const solutionValue = solutionItem ? `${String(solutionItem.value_text)}${solutionItem.unit ? String(solutionItem.unit) : ""}` : "未提供";
    const meta = baselineFieldMeta[fieldCode] ?? { label: String(requirementItem?.field_label ?? solutionItem?.field_label ?? fieldCode), group: "产品范围" as const };
    const lifecycleValues = Object.fromEntries(baselineRows.filter(item => item.field_code === fieldCode).map(item => {
      const versionId = String(item.artifact_version_id);
      const matchedKind = persistedVersions.find(version => version.id === versionId)?.kind;
      const fallbackKind = item.artifact_kind === "requirement" ? "客户需求" : item.artifact_kind === "solution_bom" ? "设计BOM" : item.artifact_kind === "costing_pricing" ? "核价方案" : "投标方案";
      return [matchedKind ?? fallbackKind, { value: `${String(item.value_text)}${item.unit ? String(item.unit) : ""}`, source: `${String(item.source_system)}:${String(item.evidence_ref)}`, versionId, applicability: String(item.applicability ?? "applicable") as "applicable" | "not_applicable" | "unknown" }];
    }));
    return { id: `BASE-${fieldCode}`, group: meta.group, name: meta.label, customerValue: requirementValue, proposedValue: solutionValue, status: (requirementItem && solutionItem ? requirementValue === solutionValue ? "一致" : "存在偏差" : "待确认") as "一致" | "待确认" | "存在偏差", source: [requirementItem, solutionItem].filter(Boolean).map(item => `${String(item!.source_system)}:${String(item!.evidence_ref)}`).join(" / "), impacts: ["技术", "投标"], lifecycleValues };
  });
  if (pricingAuthorization) persistedVersions.push({ id: String(pricingAuthorization.id), kind: "授权底价", version: `V${String(pricingAuthorization.version)}`, status: pricingAuthorization.status === "effective" ? "已批准" : "历史", createdAt: String(pricingAuthorization.created_at ?? "D1记录"), creator: "罗总", approver: "罗总", basedOn: String(pricingAuthorization.costing_solution_version_id ?? "—"), summary: `授权底价 ¥${(Number(pricingAuthorization.floor_price_cents ?? 0) / 100).toLocaleString("zh-CN")}｜授权报价 ¥${(Number(pricingAuthorization.authorized_quote_price_cents ?? 0) / 100).toLocaleString("zh-CN")}｜有效至 ${String(pricingAuthorization.valid_until ?? "—")}`, amount: Number(pricingAuthorization.authorized_quote_price_cents ?? 0) / 1_000_000, amountLabel: "授权报价", floorAmount: Number(pricingAuthorization.floor_price_cents ?? 0) / 1_000_000 });
  if (bidPackage) persistedVersions.push({ id: String(bidPackage.id), kind: "投标方案", version: `V${String(bidPackage.version)}`, status: pricingAuthorizationTrusted ? (bidPackage.status === "submitted" ? "已提交" : bidPackage.status === "frozen" ? "已批准" : "生效") : "需要重新评审", createdAt: String(bidPackage.created_at ?? "D1记录"), creator: "孙投标", approver: pricingAuthorizationTrusted && (bidPackage.status === "frozen" || bidPackage.status === "submitted") ? "周主管" : "—", basedOn: String(bidPackage.pricing_authorization_id ?? "—"), summary: pricingAuthorizationTrusted ? `${String(bidPackage.submission_type ?? "提交包")}｜通路 ${String(bidPackage.route_id ?? "—")}｜报价 ¥${(Number(bidPackage.quoted_price_cents ?? 0) / 100).toLocaleString("zh-CN")}` : "原提交包绑定的价格授权缺少新版必需上下文，不再展示金额结论；原记录保留供审计", immutable: bidPackage.status === "submitted", ...(pricingAuthorizationTrusted ? { amount: Number(bidPackage.quoted_price_cents ?? 0) / 1_000_000, amountLabel: "对客报价" } : {}) });
  const bidPrepTask = (row.external_task_records ?? []).find(item => item.task_type === "BID_PACKAGE_PREPARATION");
  const submissionTask = (row.external_task_records ?? []).find(item => item.task_type === "G5_SUBMISSION_EXECUTION");
  const externalBid: SalesProject["externalBid"] = commercialSubmission ? { id: String(commercialSubmission.bid_package_version_id), status: "等待结果", owner: "孙投标", updatedAt: String(commercialSubmission.submitted_at ?? commercialSubmission.created_at ?? "—"), submissionHash: String(commercialSubmission.package_hash ?? "—"), receipt: String(commercialSubmission.receipt_ref ?? "—") } : bidPackage ? { id: String(bidPackage.id), status: submissionTask ? "待提交" : "待提交", owner: "孙投标", updatedAt: String(bidPackage.updated_at ?? bidPackage.created_at ?? "—"), submissionHash: String(bidPackage.package_hash ?? "—"), receipt: "等待正式提交回执" } : bidPrepTask ? { id: String(bidPrepTask.external_task_id), status: "编制中", owner: "孙投标", updatedAt: String(bidPrepTask.updated_at ?? "—"), submissionHash: "—", receipt: "—" } : { id: "待创建", status: "未启动", owner: "待指派", updatedAt: "—", submissionHash: "—", receipt: "—" };
  const persistedResult = ["won", "lost", "terminated"].includes(String(row.result)) ? String(row.result) as SalesProject["result"] : "pending";
  const reviewRecord = row.g6_readiness_snapshot?.lossTerminationReview;
  const persistedLostReview: LostReview | undefined = reviewRecord ? { reason: String(reviewRecord.reason_category ?? reviewRecord.reason_detail ?? "—"), competitor: String(reviewRecord.competitor_name ?? "未披露"), gap: String(reviewRecord.key_gap ?? "—"), evidence: String(reviewRecord.evidence_ref ?? "—"), improvement: `${String(reviewRecord.improvement_action ?? "—")}｜责任人 ${String(reviewRecord.action_owner ?? "—")}｜期限 ${String(reviewRecord.due_date ?? "—")}` } : undefined;
  const persistedBaseline = awardBaseline ? { id: String(awardBaseline.id), createdAt: String(awardBaseline.created_at ?? "未提供"), approver: String(awardBaseline.approved_by_name ?? awardBaseline.approved_by ?? "未提供"), requirementId: String(awardBaseline.requirement_version_id ?? "未提供"), technicalId: String(awardBaseline.technical_solution_version_id ?? "未提供"), designBomId: String(awardBaseline.design_bom_version_id ?? "未提供"), costingId: String(awardBaseline.costing_solution_version_id ?? "未提供"), floorPriceId: String(awardBaseline.pricing_authorization_id ?? "未提供"), bidId: String(awardBaseline.bid_package_version_id ?? "未提供"), submissionId: String(awardBaseline.commercial_submission_id ?? "未提供"), resultNoticeId: String(awardBaseline.result_notice_id ?? "未提供"), transferStatus: handoverReceipt ? "已接收" as const : "待接收" as const, contractRef: String(handoverReceipt?.contract_ref ?? "等待合同APP接收"), manifestHash: String(awardBaseline.manifest_hash ?? "未提供"), receiptRef: handoverReceipt ? String(handoverReceipt.receipt_ref) : undefined } : undefined;
  return {
    persisted: true, id: row.project_code, name: row.name, customer: row.customer_name, target: row.target, intentType, evidence: row.evidence,
    amount: Number(row.amount_cents) / 1_000_000, projectGrade: row.project_grade, leadGrade: row.lead_grade ?? row.project_grade, projectGradeReason: row.project_grade_reason || undefined, projectImportance: row.project_importance || undefined, projectImportanceReason: row.project_importance_reason || undefined, organization: row.organization,
    leadAssessment: { score: originalLead.score === undefined ? undefined : Number(originalLead.score), gradeAssessment: originalLead.gradeAssessment && typeof originalLead.gradeAssessment === "object" ? originalLead.gradeAssessment as Record<string, unknown> : undefined, authenticityStatus: String(originalLead.authenticityStatus ?? "未提供"), authenticityBasis: String(originalLead.authenticityBasis ?? "未提供"), majorProject: Boolean(originalLead.majorProject), majorProjectBasis: String(originalLead.majorProjectBasis ?? "未提供"), procurementProgress: String(originalOpportunity.procurementProgress ?? "未提供"), amountType: originalOpportunity.amount && typeof originalOpportunity.amount === "object" ? String((originalOpportunity.amount as Record<string, unknown>).type ?? "未提供") : "未提供", fieldProvenance: originalLeadSnapshot.fieldProvenance && typeof originalLeadSnapshot.fieldProvenance === "object" ? originalLeadSnapshot.fieldProvenance as Record<string, unknown> : undefined, occurredAt: String(originalLeadSnapshot.occurredAt ?? "未提供") },
    owner: row.owner_name, approver: "周主管", stage: row.stage, stageName: row.stage_name,
    bidDate: row.bid_date, countdown, probability: persistedResult === "won" ? 100 : 0, probabilityAssessed: persistedResult !== "pending",
    riskLevel: persistedRiskLevel, health: { relationship: persistedRelationships.length ? relationshipHealth(persistedRelationships) : 0, resource: Math.round(100 * hydratedResources.filter(item => !item.required || item.status === "已到位").length / Math.max(1, hydratedResources.length)), operation: persistedActions.length ? Math.round(100 * persistedActions.filter(item => item.status === "已完成").length / persistedActions.length) : 0 }, relationships: persistedRelationships, versions: persistedVersions, deviations: [], configuration: persistedConfigurationItems.length ? { id: `BASELINE-${row.project_code}`, version: "CURRENT", status: persistedConfigurationItems.some(item => item.status === "存在偏差") ? "需要重新评审" : "草稿", createdAt: "D1结构化基线", approver: "待专业确认", items: persistedConfigurationItems } : undefined,
    resources: hydratedResources, resourceRequests, resourceCandidates,
    actions: persistedActions.length ? persistedActions : [{ id: `ACT-${row.project_code}-1`, type: "迁移待办", title: firstAction, purpose: "等待活动迁移后形成权威实例", owner: row.owner_name, due: requirementDate, status: "待开始", evidence: "尚无持久化活动记录", result: "不得作为真实活动实例" }],
    activityRecords: persistedActivityRecords,
    risks: persistedRisks,
    strategy: "待G1批准后由Owner与主管共同制定", competition: "待识别并验证", nextStep: persistedResult === "won" ? (row.stage === "S6" ? "跟踪合同、订单、交付、开票与回款的下游只读事实" : "等待合同APP校验并接收中标基线") : persistedResult === "lost" || persistedResult === "terminated" ? "商业结果与行政关闭均已留痕完成" : row.stage === "S0" ? row.gate_status === "pending" ? "G1已提交，等待销售主管审查" : row.gate_status === "returned" ? "按退回意见补充后重新提交G1" : "S0草稿尚未提交G1，由项目Owner核对后提交" : "制定客户关系、赢单策略与资源计划",
    partner: partnerRecord ? { needed: true, decisionStatus: "需要", engagementId: String(partnerRecord.id), verificationStatus: String(partnerRecord.verification_status) as NonNullable<SalesProject["partner"]["verificationStatus"]>, type: String(partnerRecord.partner_type), name: String(partnerRecord.partner_name), match: partnerRecord.verification_status === "verified" ? "已验证" : "候选", certification: partnerRecord.verification_status === "verified" ? "已认证" : "待认证", evidence: String(partnerRecord.verification_decision_evidence_ref ?? partnerRecord.verification_evidence_ref), contribution: partnerContributionRows.length ? partnerContributionRows.map(item => String(item.contribution_result)).join("；") : "尚无贡献记录" } : { needed: partnerNeedDecision?.decision === "needed", decisionStatus: partnerNeedDecision?.decision === "needed" ? "需要" : partnerNeedDecision?.decision === "not_needed" ? "不需要" : "未判断", type: partnerNeedDecision?.decision === "not_needed" ? "不需要" : "待判断", name: "—", match: partnerNeedDecision?.decision === "not_needed" ? "不需要" : "候选", certification: "不适用", evidence: String(partnerNeedDecision?.evidence_ref ?? "尚未形成伙伴需要性事实"), contribution: "尚无贡献记录" },
    externalBid,
    result: persistedResult, administrativeStatus: (["Active", "PendingClose", "Closed", "Terminated"].includes(String(row.administrative_status)) ? String(row.administrative_status) : "Active") as SalesProject["administrativeStatus"], baseline: persistedBaseline, lostReview: persistedLostReview, changeCount: 0, participants: [row.owner_name], competitors: (row.competitor_fact_records ?? []).map(item => ({ id: String(item.id), name: String(item.competitor_name), role: String(item.competitor_role) as "主要对手" | "低价挑战者" | "在位供应商" | "替代方案", relationship: Number(item.relationship_score), technical: Number(item.technical_score), price: Number(item.price_score), delivery: Number(item.delivery_score), service: Number(item.service_score), evidence: String(item.evidence_ref), confidence: String(item.confidence) as "高" | "中" | "低", updatedAt: String(item.observed_at) })),
    customerIdentity: { status: endCustomerParty?.master_status === "verified" ? "已匹配正式客户" : endCustomerParty?.master_status === "matched" ? "已匹配正式客户" : "临时项目客户", sourceName: String(endCustomerParty?.display_name ?? row.customer_name), sourceSystem: String(endCustomerParty?.source_system ?? "采购请求入口"), customerRecordId: String(endCustomerParty?.party_id ?? `TMP-CUS-${row.project_code}`), matchCandidates: [], onboardingTask: endCustomerParty?.master_status === "verified" || endCustomerParty?.master_status === "matched" ? "无需建档" : `CUS-MATCH-${row.project_code}`, creditStatus: "待客户主数据/信用系统返回", lastSyncedAt: String(endCustomerParty?.updated_at ?? "—") },
    strategyPlan: { version: strategyRecord ? `STR-V${String(strategyRecord.version)}` : "STR-D0", status: strategyRecord?.status === "approved" ? "已批准" : strategyRecord?.status === "stale" ? "需要更新" : "草稿", objective: String(strategyRecord?.objective ?? "立项批准后确认赢单目标"), owner: row.owner_name, approver: "销售主管", winThemes: Array.isArray(strategyPayload.winThemes) ? strategyPayload.winThemes.map(String) : [], mustProve: [], gaps: ["客户身份待确认", "竞争对手待识别"], noPromise: ["未经权威专业结论和授权不承诺价格与交期"], valueProposition: String(strategyPayload.valueProposition ?? ""), relationshipPlan: String(strategyPayload.relationshipPlan ?? ""), resourcePlan: String(strategyPayload.resourcePlan ?? ""), winPath: String(strategyPayload.winPath ?? ""), requirementScope: String(strategyPayload.requirementScope ?? ""), keyRisks: String(strategyPayload.keyRisks ?? ""), nonBidConsequence: String(strategyPayload.nonBidConsequence ?? "") },
    milestones: persistedMilestones,
    scenarioContext,
    g2Preparation,
    g2Readiness: row.g2_readiness_snapshot,
    s2Readiness: row.s2_readiness_snapshot,
    s3Readiness: row.s3_readiness_snapshot,
    g5Readiness: row.g5_readiness_snapshot,
    g5ReopenRequest: row.g5_reopen_request_record ? {
      id: String(row.g5_reopen_request_record.id),
      changeType: String(row.g5_reopen_request_record.change_type) as NonNullable<SalesProject["g5ReopenRequest"]>["changeType"],
      routeId: row.g5_reopen_request_record.route_id ? String(row.g5_reopen_request_record.route_id) : undefined,
      reason: String(row.g5_reopen_request_record.reason), evidenceRef: String(row.g5_reopen_request_record.evidence_ref),
      status: String(row.g5_reopen_request_record.status) as NonNullable<SalesProject["g5ReopenRequest"]>["status"],
      decisionComment: row.g5_reopen_request_record.decision_comment ? String(row.g5_reopen_request_record.decision_comment) : undefined,
    } : undefined,
    g6Readiness: row.g6_readiness_snapshot,
    externalTasks: (row.external_task_records ?? []).map(item => ({
      id: String(item.id),
      taskType: String(item.task_type) as "BID_PREPARATION" | "COMMERCIAL_SOLUTION" | "TECHNICAL_COLLABORATION" | "REQUIREMENT_BASELINE_PREPARATION" | "TECHNICAL_SOLUTION_PREPARATION" | "BOM_AND_CLOSURE_PREPARATION" | "G3_GATE_REVIEW" | "COSTING_COLLABORATION" | "G4_GATE_REVIEW" | "EPC_PRICE_EXCEPTION_APPROVAL" | "BID_PACKAGE_PREPARATION" | "BID_PACKAGE_REVIEW" | "G5_SUBMISSION_EXECUTION" | "COMMERCIAL_RESULT_TRACKING" | "CONTRACT_HANDOVER_EXECUTION" | "DOWNSTREAM_STATUS_TRACKING",
      targetSystem: String(item.target_system),
      externalTaskId: String(item.external_task_id),
      assigneeName: String(item.assignee_name),
      status: String(item.status) as "pending" | "accepted" | "completed" | "returned" | "rejected" | "cancelled",
      environment: "demo",
      simulated: Boolean(item.simulated),
      updatedAt: String(item.updated_at),
    })),
    downstreamEvents: (row.downstream_business_event_records ?? []).map(item => ({
      id: String(item.id), sourceSystem: String(item.source_system), sourceEventId: String(item.source_event_id),
      externalTaskId: item.external_task_id ? String(item.external_task_id) : undefined,
      objectType: String(item.object_type) as "Contract" | "Order" | "Delivery" | "Acceptance" | "Invoice" | "Payment",
      objectRef: String(item.object_ref),
      eventType: String(item.event_type) as "status_reported" | "created" | "updated" | "cancelled",
      businessStatus: String(item.business_status),
      amount: item.amount_cents === null || item.amount_cents === undefined ? undefined : Number(item.amount_cents) / 100,
      currency: item.currency ? String(item.currency) : undefined,
      evidenceRef: String(item.evidence_ref), occurredAt: String(item.occurred_at), environment: "demo", simulated: Boolean(item.simulated),
    })),
    sourceLineage: projectSourceLink ? { sourceType: "线索转入", sourceSystem: String(projectSourceLink.source_system) === "LEAD_MANAGEMENT_SIMULATOR" ? "线索管理APP（本地模拟）" : String(projectSourceLink.source_system), sourceRecordId: String(projectSourceLink.source_object_code ?? projectSourceLink.source_object_id), leadId: String(projectSourceLink.source_object_id), commercialProjectId: "未接入/未返回", contributor: "线索接口", convertedAt: String(projectSourceLink.imported_at ?? "D1持久化记录"), inheritedFields: Object.keys(sourceLinkProvenance).length ? Object.keys(sourceLinkProvenance) : ["客户", "项目名称", "产品范围", "金额与采购进展"], inheritedContext: [`线索评级：${String(sourceLinkLead.grade ?? "未评级")}（只读保留）；销售项目等级默认继承，G1可依据事实调整`, `请求编号：${String(procurementRequest?.request_ref ?? "待确认")}`, `线索候选事实：竞对${sourceLinkCompetitors.length}项、关键角色${sourceLinkKeyRoles.length}项、伙伴${sourceLinkPartners.length}项（均待项目确认，不自动成为项目正式角色）`], evidence: row.evidence, initialRequirement: leadRequirementRow ? { originalText: String(leadRequirementSnapshot.originalText ?? leadRequirementRow.original_text ?? ""), productRequirement: String(leadRequirementSnapshot.productRequirement ?? row.target), quantity: leadRequirementSnapshot.quantity ? String(leadRequirementSnapshot.quantity) : undefined, qualificationRequirements: leadRequirementSnapshot.qualificationRequirements ? String(leadRequirementSnapshot.qualificationRequirements) : undefined, knownConstraints: stringArrayOf(leadRequirementSnapshot.knownConstraints), unknowns: stringArrayOf(leadRequirementSnapshot.unknowns), sourceRefs: stringArrayOf(leadRequirementRow.source_refs), frozenAt: String(leadRequirementRow.source_occurred_at ?? leadRequirementRow.created_at ?? projectSourceLink.imported_at) } : undefined, candidateFacts: { competitors: sourceLinkCompetitors, keyRoles: sourceLinkKeyRoles, partners: sourceLinkPartners, parties: sourceLinkParties, contacts: sourceLinkContacts, followups: sourceLinkFollowups, attachments: sourceLinkAttachments } } : { sourceType: scenarioDefinition.name, sourceSystem: "采购请求入口", sourceRecordId: String(procurementRequest?.id ?? row.procurement_intent_id), leadId: "—", commercialProjectId: "未接入/未返回", contributor: row.owner_name, convertedAt: "D1持久化记录", inheritedFields: ["场景编码", "采购请求", "最终客户Party", "机会指纹", "标的与金额"], inheritedContext: [isEpcScenario ? `EPC询价客户：${inquiryCustomerParties.map(item => String(item.display_name)).join("、") || "待登记"}` : `采购请求客户：${String(procurementRequest?.source_party_name ?? row.customer_name)}`, `请求编号：${String(procurementRequest?.request_ref ?? "历史待核实")}`], evidence: row.evidence },
  };
}

function getGateConditions(project: SalesProject, g2Input?: G2PreparationInput) {
  const effectiveG2Input = g2Input ?? project.g2Preparation;
  const hasTech = project.resources.some((item) => item.role === "技术负责人" && item.status === "已到位");
  const hasDecision = project.relationships.some((item) => item.layer === "商务决策链" && item.influence === "高");
  const pendingDeviation = project.deviations.some((item) => item.status === "待审批");
  const reviewRequired = project.versions.some((item) => item.status === "需要重新评审");
  const hasCosting = project.versions.some((item) => item.kind === "核价方案" && ["已批准", "生效", "已提交"].includes(item.status));
  const hasBid = project.versions.some((item) => item.kind === "投标方案" && !["草稿", "需要重新评审"].includes(item.status));
  const customerIdentified = ["已匹配正式客户", "已准入"].includes(project.customerIdentity?.status ?? "");

  if (project.stage === "S0") return [
    { label: "采购意向类型与证据有效", ok: Boolean(project.intentType && project.evidence.trim()), hard: true, owner: "项目申请人" },
    { label: "客户、标的与预计金额明确", ok: Boolean(project.customer && project.target && project.amount > 0), hard: true, owner: project.owner },
    { label: "销售Owner已指派并接受责任", ok: project.resources.some((item) => item.role === "销售Owner" && item.status === "已到位"), hard: true, owner: "销售主管" },
    { label: "重复项目检查已通过", ok: true, hard: true, owner: "系统校验" },
  ];
  if (project.stage === "S1" && project.g2Readiness) return project.g2Readiness.items.map(item => ({ label: item.label, ok: item.ready, hard: item.hard, owner: item.owner }));
  if (project.stage === "S1") return [
    { label: "首版赢单策略已形成", ok: Boolean(effectiveG2Input?.winStrategy.trim()), hard: true, owner: project.owner },
    { label: "客户决策链与关系覆盖已有结论", ok: Boolean(effectiveG2Input?.relationshipCoverage.trim()), hard: true, owner: project.owner },
    { label: "最近客户接触与覆盖缺口已记录", ok: Boolean(effectiveG2Input?.customerEngagement.trim()), hard: false, owner: project.owner },
    { label: "本阶段资源投入与接受已确认", ok: Boolean(effectiveG2Input?.resourceInvestment.trim()), hard: true, owner: "销售Owner/销售主管" },
    { label: "采购/投报作业启动计划已形成", ok: Boolean(effectiveG2Input?.bidWorkInitiationPlan.trim()), hard: true, owner: "投标专员" },
    { label: "需求与方案启动评估已汇总", ok: Boolean(effectiveG2Input?.initiationAssessment.trim()), hard: true, owner: "投标/技术/方案责任人" },
    { label: "初版商务条款与偏差上下文", ok: Boolean(effectiveG2Input?.commercialContext.trim()), hard: false, owner: "商务经理" },
  ];
  if (project.stage === "S2" && project.s2Readiness) return project.s2Readiness.items.map(item => ({ label: item.label, ok: item.ready, hard: item.hard, owner: item.owner }));
  if (project.stage === "S2") return [
    { label: "需求澄清包与正式需求基线血缘可追溯", ok: false, hard: true, owner: "销售Owner协调；投标/技术责任人形成基线" },
    { label: "技术方案与报价设计BOM绑定当前需求", ok: false, hard: true, owner: "技术/方案责任人" },
    { label: "澄清和偏差已由对应责任人闭环", ok: false, hard: true, owner: "对应专业责任人" },
  ];
  if (project.stage === "S3" && project.s3Readiness) return project.s3Readiness.items.map(item => ({ label: item.label, ok: item.ready, hard: item.hard, owner: item.owner }));
  if (project.stage === "S3") return [
    { label: "有效需求与技术方案可追溯", ok: !reviewRequired, hard: true, owner: "技术负责人" },
    { label: "核价方案已批准", ok: hasCosting, hard: true, owner: "核价评审组" },
    { label: "技术负责人已到位", ok: hasTech, hard: true, owner: "销售主管" },
    { label: "交期与盈利风险已有结论", ok: project.risks.every((risk) => risk.category !== "交期" || risk.status !== "开放"), hard: false, owner: "价格授权人" },
  ];
  if (project.stage === "S4" && project.g5Readiness) return project.g5Readiness.items.map(item => ({ label: item.label, ok: item.ready, hard: item.hard, owner: item.owner }));
  if (project.stage === "S4") return [
    { label: "采购主体已与客户主数据完成匹配", ok: customerIdentified, hard: true, owner: "客户系统/项目Owner" },
    { label: "需求—技术—核价—投标版本有效", ok: !reviewRequired && hasBid, hard: true, owner: "技术/投标负责人" },
    { label: "所有方案偏差已获得授权", ok: !pendingDeviation, hard: true, owner: "价格授权人" },
    { label: "技术负责人已到位并接受责任", ok: hasTech, hard: true, owner: "销售主管" },
    { label: "客户关键商务决策人已覆盖", ok: hasDecision, hard: false, owner: "项目Owner" },
    { label: "外部投标APP提交包准备完成", ok: project.externalBid.status === "待提交" || project.externalBid.status === "已提交" || project.externalBid.status === "等待结果", hard: true, owner: project.externalBid.owner },
  ];
  if (project.stage === "S5" && project.g6Readiness) return project.g6Readiness.items.map(item => ({ label: item.label, ok: item.ready, hard: item.hard, owner: item.owner }));
  if (project.stage === "S5") return [
    { label: "正式提交版本与客户回执已固化", ok: Boolean(project.externalBid.receipt !== "—"), hard: true, owner: "投标专员" },
    { label: "中标移交包或丢标复盘已形成", ok: Boolean(project.baseline || project.lostReview), hard: true, owner: "项目Owner" },
  ];
  if (project.stage === "S6") return [
    { label: "中标基线已传递至合同APP", ok: project.baseline?.transferStatus === "已接收", hard: true, owner: "合同管理员" },
    { label: "下游状态保持只读引用", ok: true, hard: true, owner: "系统集成" },
  ];
  return [
    { label: "当前阶段核心输出已完成", ok: project.health.operation >= 60, hard: true, owner: project.owner },
    { label: "当前阶段关键资源到位", ok: project.health.resource >= 60, hard: true, owner: "销售主管" },
  ];
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

const activityCommandLabels: Record<ActivityCommand, string> = { start: "开始执行", block: "登记阻塞", resume: "解除阻塞并恢复", complete: "完成活动", cancel: "取消活动", add_evidence: "追加证据/督办意见" };

function availableActivityCommands(activity: PersistedActivityRecord, manager: boolean): ActivityCommand[] {
  if (manager) return activity.definitionCode === "ACT-SPM-06" && !["completed", "cancelled"].includes(activity.status) ? ["add_evidence", "cancel"] : ["add_evidence"];
  if (activity.status === "planned") return ["start", "block", "cancel", "add_evidence"];
  if (activity.status === "in_progress") return ["block", "complete", "cancel", "add_evidence"];
  if (activity.status === "blocked") return ["resume", "cancel", "add_evidence"];
  return ["add_evidence"];
}

export default function DemoApp() {
  const [projects, setProjects] = useState<SalesProject[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("loading");
  const [dataLoadError, setDataLoadError] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [toast, setToast] = useState("");
  const [relationOpen, setRelationOpen] = useState(false);
  const [relationLayer, setRelationLayer] = useState<Relationship["layer"]>("商务决策链");
  const [competitorOpen, setCompetitorOpen] = useState(false);
  const [epcRouteOpen, setEpcRouteOpen] = useState(false);
  const [epcExceptionRoute, setEpcExceptionRoute] = useState<NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number] | null>(null);
  const [epcWithdrawRoute, setEpcWithdrawRoute] = useState<NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number] | null>(null);
  const [g5ReopenDraft, setG5ReopenDraft] = useState<{ changeType: NonNullable<SalesProject["g5ReopenRequest"]>["changeType"]; route?: NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number] } | null>(null);
  const [g5ReopenDecision, setG5ReopenDecision] = useState<{ request: NonNullable<SalesProject["g5ReopenRequest"]>; action: "approve" | "return" } | null>(null);
  const [g1DecisionOpen, setG1DecisionOpen] = useState(false);
  const [g2DecisionOpen, setG2DecisionOpen] = useState(false);
  const [g5DecisionOpen, setG5DecisionOpen] = useState(false);
  const [g6DecisionOpen, setG6DecisionOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionContext, setActionContext] = useState<ProjectAction["context"]>("project_operation");
  const [resourceRequestOpen, setResourceRequestOpen] = useState(false);
  const [costingRequestOpen, setCostingRequestOpen] = useState(false);
  const [resourceCandidateTarget, setResourceCandidateTarget] = useState<SalesProject["resources"][number] | null>(null);
  const [partnerActionOpen, setPartnerActionOpen] = useState<PartnerAction | null>(null);
  const [riskOpen, setRiskOpen] = useState(false);
  const [riskCloseTarget, setRiskCloseTarget] = useState<SalesProject["risks"][number] | null>(null);
  const [activityCommandTarget, setActivityCommandTarget] = useState<PersistedActivityRecord | null>(null);
  const [activityCommand, setActivityCommand] = useState<ActivityCommand>("start");
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [submitBlockers, setSubmitBlockers] = useState<string[] | null>(null);
  const [actionSeed, setActionSeed] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("全部阶段");
  const [riskFilter, setRiskFilter] = useState("全部风险");
  const [ownerFilter, setOwnerFilter] = useState("全部负责人");
  const [listMode, setListMode] = useState<"table" | "card">("table");
  const [newStep, setNewStepState] = useState(1);
  const [newMaxStep, setNewMaxStep] = useState(1);
  const setNewStep = (step: number) => {
    setNewStepState(step);
    setNewMaxStep(current => Math.max(current, step));
  };
  const [newProject, setNewProject] = useState<{ scenarioCode: ScenarioType | ""; evidence: string; finalCustomer: string; sourceCustomer: string; procurementProjectName: string; requestRef: string; requestDate: string; tenderNo: string; lotNo: string; deliveryLocation: string; projectCountry: string; deliveryCountry: string; inquiryBatch: string; target: string; amount: string; bidDate: string; owner: string; leadGrade: LeadGrade; organization: string; requirementDate: string; technicalDate: string; costingDate: string; firstAction: string }>({ scenarioCode: "", evidence: "", finalCustomer: "", sourceCustomer: "", procurementProjectName: "", requestRef: "", requestDate: "", tenderNo: "", lotNo: "", deliveryLocation: "", projectCountry: "", deliveryCountry: "", inquiryBatch: "", target: "", amount: "", bidDate: "", owner: "陈晨", leadGrade: "A", organization: "杭州事业部", requirementDate: "", technicalDate: "", costingDate: "", firstAction: "" });
  const [leadConversions, setLeadConversions] = useState<LeadConversionRow[]>([]);
  const [selectedLeadConversionId, setSelectedLeadConversionId] = useState("");
  const [leadQueueError, setLeadQueueError] = useState("");
  const [leadListMode, setLeadListMode] = useState<"table" | "card">("table");
  const [leadStatusFilter, setLeadStatusFilter] = useState<"pending" | "all" | "converted">("pending");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(6);
  const [leadConversionOpen, setLeadConversionOpen] = useState(false);
  const [duplicateState, setDuplicateState] = useState<"idle" | "clear" | "found">("idle");
  const [scenarioConfirmed, setScenarioConfirmed] = useState(false);
  const [quickProjectId, setQuickProjectId] = useState("");
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([]);
  const [dashboardFocus, setDashboardFocus] = useState("all");
  const [entryContext, setEntryContext] = useState<{ source: string; title: string; summary: string; returnView?: View; activityId?: string } | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([{ role: "agent", text: "我会基于当前角色、当前项目和已记录证据提供建议，但不会代替销售员写入事实，也不会代替主管审批。" }]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditFilter, setAuditFilter] = useState<AuditCategory>("全部");
  useEffect(() => {
    const resizeLeadPage = () => setLeadPageSize(window.innerHeight >= 1050 ? 8 : window.innerHeight >= 800 ? 6 : 4);
    resizeLeadPage();
    window.addEventListener("resize", resizeLeadPage);
    return () => window.removeEventListener("resize", resizeLeadPage);
  }, []);
  const [persistedGates, setPersistedGates] = useState<Record<string, PersistedGate>>({});
  const [g2Inputs, setG2Inputs] = useState<Record<string, G2PreparationInput>>({});
  const [flowBusy, setFlowBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const loadingPlaceholder = useMemo(() => initialProjects()[0], []);
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0] ?? loadingPlaceholder;
  const manager = role === "manager";
  const selectedGate = persistedGates[selected.id];
  const selectedG2Input = g2Inputs[selected.id];
  const realPendingGates = Object.fromEntries(Object.entries(persistedGates).filter(([, gate]) => gate.status === "pending" && gate.code).map(([projectId, gate]) => [projectId, gate.code!])) as Record<string, "G1" | "G2" | "G3" | "G4" | "G5" | "G6">;
  const salesScopedCount = projects.filter((project) => project.owner === "陈晨" || project.participants?.includes("陈晨")).length;
  const roleScopedProjects = manager ? projects : projects.filter(project => project.owner === "陈晨" || project.participants?.includes("陈晨"));
  const highRiskCount = roleScopedProjects.filter(project => project.riskLevel === "高" || project.riskLevel === "重大").length;
  const auditRecords = useMemo<AuditRecord[]>(() => {
    const records: AuditRecord[] = [];
    if (selected.sourceLineage) records.push({ id: `SRC-${selected.id}`, category: "来源", title: `${selected.sourceLineage.sourceSystem} → 销售项目`, detail: `${selected.sourceLineage.sourceRecordId}｜${selected.sourceLineage.evidence}`, actor: selected.sourceLineage.contributor, time: selected.sourceLineage.convertedAt, status: "已继承", tab: "overview" });
    selected.relationships.forEach(item => records.push({ id: item.id, category: "关系", title: `${item.layer} · ${item.name}`, detail: item.evidence, actor: item.owner, time: item.lastTouch, status: item.evidence === "待补充" ? "缺少证据" : "已有证据", tab: "relations" }));
    selected.versions.forEach(item => records.push({ id: item.id, category: "版本", title: `${item.kind} ${item.id}`, detail: `${item.summary}｜上游 ${item.basedOn}`, actor: item.approver === "—" ? item.creator : item.approver, time: item.createdAt, status: item.status, tab: "versions" }));
    selected.deviations.forEach(item => records.push({ id: item.id, category: "审批", title: `${item.field}偏差 ${item.id}`, detail: `${item.requirement} → ${item.proposal}｜${item.impact}`, actor: item.approver, time: "2026-08-17", status: item.status, tab: "versions" }));
    selected.actions.forEach(item => records.push({ id: item.id, category: "行动", title: item.title, detail: `${item.result}｜证据：${item.evidence}`, actor: item.owner, time: item.actualEnd && item.actualEnd !== "—" ? item.actualEnd : item.due, status: item.status, tab: "actions" }));
    return records;
  }, [selected]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const saveS1Fact = async <T extends { readiness: G2ReadinessSnapshot }>(action: string, input: Record<string, unknown>, actorId: "sales-chen" | "manager-zhou" | "technical-zhao") => {
    const response = await fetch("/api/p0/s1-facts", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": actorId }, body: JSON.stringify({ projectCode: selected.id, action, input }) });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "S1来源记录保存失败");
    updateProject(selected.id, project => ({ ...project, g2Readiness: result.readiness, g2Preparation: result.readiness.input }));
    setG2Inputs(current => ({ ...current, [selected.id]: result.readiness.input }));
    return result;
  };

  const saveRequirementSource = async (input: RequirementSourceInput) => {
    const response = await fetch("/api/p0/s2-facts", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "requirement.save", input }) });
    const result = await response.json() as { readiness?: S2ReadinessSnapshot; error?: string };
    if (!response.ok || !result.readiness) throw new Error(result.error ?? "S2来源记录保存失败");
    updateProject(selected.id, project => ({ ...project, s2Readiness: result.readiness, nextStep: "等待技术负责人通过外部协同任务回传标准化需求与初步方案" }));
    return result;
  };

  useEffect(() => {
    let active = true;
    const requestedMode = new URLSearchParams(window.location.search).get("data");
    if (requestedMode === "sample") {
      const samples = initialProjects();
      queueMicrotask(() => {
        if (!active) return;
        setProjects(samples);
        setPersistedGates({});
        setG2Inputs({});
        setSelectedId(samples[0]?.id ?? "");
        setQuickProjectId(samples[0]?.id ?? "");
        setRecentProjectIds(samples.slice(0, 3).map(item => item.id));
        setDataLoadError("");
        setDataMode("sample");
      });
      return () => { active = false; };
    }
    fetch("/api/p0/projects", { headers: { "x-demo-actor-id": role === "manager" ? "manager-zhou" : "sales-chen" } })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error("D1 API unavailable")))
      .then((data: { projects: PersistedProjectRow[] }) => {
        if (!active) return;
        const persisted = data.projects.map(persistedToDemoProject);
        const ids = new Set(persisted.map(item => item.id));
        setProjects(persisted);
        setPersistedGates(Object.fromEntries(data.projects.filter(item => item.gate_id && ["G1", "G2", "G3", "G4", "G5", "G6"].includes(String(item.gate_code))).map(item => [item.project_code, { id: String(item.gate_id), code: item.gate_code as PersistedGate["code"], status: item.gate_status ?? "pending", executionStatus: item.gate_execution_status, comment: item.gate_comment }])));
        setG2Inputs(Object.fromEntries(data.projects.filter(item => item.gate_code === "G2" && item.gate_input_snapshot).map(item => [item.project_code, g2InputFromSnapshot(item.gate_input_snapshot!)])));
        setSelectedId(current => ids.has(current) ? current : persisted[0]?.id ?? "");
        setQuickProjectId(current => ids.has(current) ? current : persisted[0]?.id ?? "");
        setRecentProjectIds(current => {
          const retained = current.filter(id => ids.has(id));
          return retained.length ? retained.slice(0, 3) : persisted.slice(0, 3).map(item => item.id);
        });
        setDataLoadError("");
        setDataMode("business");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setProjects([]);
        setPersistedGates({});
        setG2Inputs({});
        setDataLoadError(error instanceof Error ? error.message : "D1业务数据加载失败");
        setDataMode("error");
      });
    return () => { active = false; };
  }, [role, reloadToken]);

  useEffect(() => {
    if (dataMode === "sample") return;
    let active = true;
    fetch("/api/p0/lead-conversions", { headers: { "x-demo-actor-id": role === "manager" ? "manager-zhou" : "sales-chen" } })
      .then(async response => {
        const data = await response.json() as LeadConversionRow[] | { error?: string };
        if (!response.ok || !Array.isArray(data)) throw new Error(!Array.isArray(data) ? data.error ?? "读取线索队列失败" : "读取线索队列失败");
        return data;
      })
      .then(data => { if (active) { setLeadConversions(data); setLeadQueueError(""); } })
      .catch(error => { if (active) { setLeadConversions([]); setLeadQueueError(error instanceof Error ? error.message : "读取线索队列失败"); } });
    return () => { active = false; };
  }, [role, reloadToken, dataMode]);

  const askAgent = (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const question = (preset ?? agentInput).trim();
    if (!question) return;
    const missingResources = selected.resources.filter(item => item.required && item.status !== "已到位");
    const blockers = getGateConditions(selected, selectedG2Input).filter(item => !item.ok);
    const pendingVersions = selected.versions.filter(item => item.status === "需要重新评审");
    const pendingDeviations = selected.deviations.filter(item => item.status === "待审批");
    let answer = manager
      ? `建议先处理“${blockers[0]?.label ?? selected.nextStep}”。依据是当前阶段门有${blockers.length}个缺口；请核对证据后由你作出决策。`
      : `建议先完成“${selected.nextStep}”。你可以补充事实、证据并发起协同，但资源配置、偏差和阶段推进仍需主管决定。`;
    if (/风险|异常|阻断/.test(question)) answer = `${selected.name}当前为${selected.riskLevel}风险，开放风险${selected.risks.filter(item => item.status !== "已关闭").length}项、阶段门缺口${blockers.length}项。首要处理：${selected.risks.find(item => item.status !== "已关闭")?.title ?? "暂无开放风险"}。`;
    if (/阶段|推进|门/.test(question)) answer = `项目处于${selected.stage} ${selected.stageName}。${blockers.length ? `仍有${blockers.length}项未满足，其中${blockers.filter(item => item.hard).length}项为硬阻断。` : "当前检查项已满足，可由主管结合商业判断决定是否推进。"}`;
    if (/版本|配置|偏差|核价/.test(question)) answer = `当前有${pendingVersions.length}个版本需要重新评审、${pendingDeviations.length}项偏差待审批。${pendingVersions.length || pendingDeviations.length ? "正式投标提交仍被阻断，请先查看标的物配置和审批依据。" : "版本链当前可追溯，仍需以正式批准状态为准。"}`;
    if (/资源|人员|负荷/.test(question)) answer = missingResources.length ? `缺少或待接受的关键资源：${missingResources.map(item => `${item.role}（${item.person}）`).join("、")}。${manager ? "建议比较能力、负荷和可投入时间后配置。" : "请补充工作边界与期限后向主管申请。"}` : "当前必需资源均已到位；仍应核对人员负荷和阶段任务是否匹配。";
    setAgentMessages(current => [...current, { role: "user", text: question }, { role: "agent", text: answer }]);
    setAgentInput("");
  };

  const updateProject = (id: string, change: (project: SalesProject) => SalesProject) => {
    setProjects((current) => current.map((project) => project.id === id ? change(project) : project));
  };

  const openProject = (id: string, tab: DetailTab = "overview", context?: { source: string; title: string; summary: string; returnView?: View; activityId?: string }) => {
    const returnViews: Partial<Record<string, View>> = {
      "决策与审批中心": "decisions",
      "阶段门中心": "decisions",
      "销售行动中心": "action-center",
      "资源调度": "resource-center",
      "风险与行动": "risk-center",
      "版本与配置": "configuration-center",
      "结果与复盘": "review-center",
    };
    setSelectedId(id);
    setQuickProjectId(id);
    setRecentProjectIds((current) => [id, ...current.filter((item) => item !== id)].slice(0, 3));
    setDetailTab(tab);
    setEntryContext(context ? { ...context, returnView: context.returnView ?? returnViews[context.source] } : null);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDashboardFocus = (focus: string) => {
    setDashboardFocus(focus);
    setEntryContext(null);
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openWorkspace = (target: View) => {
    setEntryContext(null);
    setView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const managerQuickDecision = (projectId: string, type: string) => {
    if (!manager) { notify("当前角色没有主管决策权限"); return; }
    if (type === "立项审批") {
      setSelectedId(projectId);
      setG1DecisionOpen(true);
      return;
    }
    if (!["资源配置", "资源协调"].includes(type)) { notify("该事项必须查看完整依据后处理"); return; }
    updateProject(projectId, project => ({ ...project, resources: project.resources.map(resource => resource.role === "技术负责人" && resource.status !== "已到位" ? { ...resource, person: "赵工", status: "待接受", load: 72, activeProjects: 3, availableFrom: "可立即投入" } : resource), health: { ...project.health, resource: Math.max(project.health.resource, 62) } }));
    notify("技术负责人已配置为赵工；仍需本人接受责任，相关阶段门已重新计算");
  };

  const showProjects = (filter?: { stage?: ProjectStage; risk?: string; owner?: string }) => {
    setStageFilter(filter?.stage ?? "全部阶段");
    setRiskFilter(filter?.risk ?? "全部风险");
    setOwnerFilter(filter?.owner ?? "全部负责人");
    setSearch("");
    setView("projects");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const quickRelation = (id: string) => {
    if (manager) { notify("客户关系事实由销售员维护；主管可查看、提出缺口和督办"); return; }
    setSelectedId(id);
    setRelationLayer("商务决策链");
    setRelationOpen(true);
  };

  const quickAction = (id: string) => {
    if (manager) { notify("主管可以发起督办，但项目行动由销售Owner维护"); return; }
    setSelectedId(id);
    setActionSeed("");
    setActionOpen(true);
  };

  const saveVoiceRecord = (projectId: string, transcript: string) => {
    if (manager) { notify("语音Touch由销售员确认录入；主管仅查看已确认事实"); return; }
    const action: ProjectAction = {
      id: `ACT-VOICE-${selected.id}-${selected.actions.length + 1}`,
      type: "客户Touch",
      title: "向客户发送调整后的交期说明",
      purpose: "确认客户对165天交付承诺的接受程度",
      owner: "陈晨",
      due: "2026-08-20",
      status: "待开始",
      evidence: "AI语音转写（销售员已确认，演示数据）",
      result: transcript,
    };
    updateProject(projectId, (project) => ({ ...project, actions: [action, ...project.actions], nextStep: action.title }));
    notify("语音内容已由销售员确认，并生成客户Touch与下一行动");
  };

  const openInitiation = () => {
    setNewStep(1);
    setNewMaxStep(1);
    setSelectedLeadConversionId("");
    setDuplicateState("idle");
    setView("new");
  };

  const resetAll = () => {
    if (dataMode === "sample") {
      const samples = initialProjects();
      setProjects(samples);
      setSelectedId(samples[0]?.id ?? "");
      setQuickProjectId(samples[0]?.id ?? "");
      setRecentProjectIds(samples.slice(0, 3).map(item => item.id));
      notify("样例模式已恢复；未修改D1业务数据");
      return;
    }
    setDetailTab("overview");
    setView("dashboard");
    setDashboardFocus(role === "manager" ? "decision" : "today");
    setEntryContext(null);
    setDataMode("loading");
    setReloadToken(current => current + 1);
    notify("正在从D1重新读取业务数据；不会删除任何业务记录");
  };

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const textMatch = !query || [project.name, project.id, project.customer, project.target, project.owner].join(" ").toLowerCase().includes(query);
    const riskMatch = riskFilter === "全部风险" || (riskFilter === "高风险及重大" ? ["高", "重大"].includes(project.riskLevel) : project.riskLevel === riskFilter);
    return textMatch && (stageFilter === "全部阶段" || project.stage === stageFilter) && riskMatch && (ownerFilter === "全部负责人" || project.owner === ownerFilter);
  }), [projects, search, stageFilter, riskFilter, ownerFilter]);

  if (dataMode === "loading") return <div className="data-source-state"><div className="brand-mark">QJ</div><span>BUSINESS DATA</span><h1>正在读取D1业务项目</h1><p>系统不会再以静态样例替代业务数据。</p></div>;
  if (dataMode === "error") return <div className="data-source-state error"><div className="brand-mark">!</div><span>DATA SOURCE ERROR</span><h1>D1业务数据加载失败</h1><p>{dataLoadError}。为防止真假数据混用，系统没有自动回退到静态样例。</p><div><button className="primary" onClick={() => setReloadToken(current => current + 1)}>重新加载业务数据</button><button className="secondary" onClick={() => { window.location.href = "/?data=sample"; }}>进入明确标识的样例模式</button></div></div>;
  if (dataMode === "business" && projects.length === 0 && view !== "new") return <div className="data-source-state"><div className="brand-mark">QJ</div><span>EMPTY BUSINESS TENANT</span><h1>当前D1中没有可访问的销售项目</h1><p>这不是样例数据回退。可从线索转入队列确认建项，也可按受控补录流程建立项目。</p><div><button className="primary" onClick={openInitiation}>进入项目立项</button><button className="secondary" onClick={() => setReloadToken(current => current + 1)}>重新检查</button></div></div>;

  const addRelationship = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const relation: Relationship = {
      id: `REL-${Math.round(event.timeStamp)}`,
      layer: String(data.get("layer")) as Relationship["layer"],
      name: String(data.get("name")),
      title: String(data.get("title")),
      attitude: String(data.get("attitude")) as Relationship["attitude"],
      influence: String(data.get("influence")) as Relationship["influence"],
      owner: String(data.get("owner")),
      evidence: String(data.get("evidence")),
      lastTouch: "2026-08-17",
    };
    try {
      if (selected.persisted) {
        const result = await saveS1Fact<{ id: string; readiness: G2ReadinessSnapshot }>("relationship.create", { layer: relation.layer, name: relation.name, title: relation.title, attitude: relation.attitude, influence: relation.influence, owner: relation.owner, evidence: relation.evidence, lastTouch: relation.lastTouch }, "sales-chen");
        relation.id = result.id;
      }
      updateProject(selected.id, (project) => {
        const relationships = [...project.relationships, relation];
        return { ...project, relationships, health: { ...project.health, relationship: relationshipHealth(relationships) } };
      });
      setRelationOpen(false);
      notify(`已新增客户关系：${relation.name}，关系覆盖与G2来源状态已重新计算`);
    } catch (error) { notify(error instanceof Error ? error.message : "客户关系保存失败"); }
  };

  const addCompetitor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = { name: String(data.get("name")), role: String(data.get("role")), relationship: Number(data.get("relationship")), technical: Number(data.get("technical")), price: Number(data.get("price")), delivery: Number(data.get("delivery")), service: Number(data.get("service")), confidence: String(data.get("confidence")), evidence: String(data.get("evidence")), observedAt: String(data.get("observedAt")) };
    setFlowBusy(true);
    try {
      if (selected.persisted) {
        const response = await fetch("/api/p0/s1-facts", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "competitor.create", input }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "竞争事实保存失败");
        setReloadToken(current => current + 1);
      } else {
        updateProject(selected.id, project => ({ ...project, competitors: [...(project.competitors ?? []), { id: `CMP-${Date.now()}`, ...input, role: input.role as "主要对手" | "低价挑战者" | "在位供应商" | "替代方案", confidence: input.confidence as "高" | "中" | "低", updatedAt: input.observedAt }] }));
      }
      setCompetitorOpen(false);
      notify("竞争事实已保存；不会自动改写赢单概率或替代策略评审");
    } catch (error) { notify(error instanceof Error ? error.message : "竞争事实保存失败"); }
    finally { setFlowBusy(false); }
  };

  const addEpcRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/epc-routes", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "route.create", input: { epcCustomer: String(data.get("epcCustomer")), inquiryRef: String(data.get("inquiryRef")), inquiryDate: String(data.get("inquiryDate")), evidenceRef: String(data.get("evidenceRef")) } }) });
      const result = await response.json() as { routeId?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "EPC报价通路保存失败");
      setEpcRouteOpen(false);
      setReloadToken(current => current + 1);
      notify(`EPC报价通路 ${result.routeId} 已登记；项目金额保持只计一次`);
    } catch (error) { notify(error instanceof Error ? error.message : "EPC报价通路保存失败"); }
    finally { setFlowBusy(false); }
  };

  const withdrawEpcRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!epcWithdrawRoute) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/epc-routes", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "route.withdraw", routeId: epcWithdrawRoute.id, reason: String(data.get("reason")), evidenceRef: String(data.get("evidenceRef")) }) });
      const result = await response.json() as { routeId?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "EPC报价通路撤回失败");
      setEpcWithdrawRoute(null);
      setReloadToken(current => current + 1);
      notify(`EPC报价通路 ${result.routeId} 已撤回；原提交包和未完成任务已受控失效`);
    } catch (error) { notify(error instanceof Error ? error.message : "EPC报价通路撤回失败"); }
    finally { setFlowBusy(false); }
  };

  const requestG5Reopen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!g5ReopenDraft) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/epc-routes", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "g5-reopen.request", input: { changeType: g5ReopenDraft.changeType, routeId: g5ReopenDraft.route?.id ?? "", reason: String(data.get("reason")), evidenceRef: String(data.get("evidenceRef")) } }) });
      const result = await response.json() as { requestId?: string; duplicate?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "G5解冻申请失败");
      setG5ReopenDraft(null);
      setReloadToken(current => current + 1);
      notify(result.duplicate ? `已有同一解冻申请 ${result.requestId}，未重复创建` : `G5解冻申请 ${result.requestId} 已提交销售主管`);
    } catch (error) { notify(error instanceof Error ? error.message : "G5解冻申请失败"); }
    finally { setFlowBusy(false); }
  };

  const decideG5Reopen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!g5ReopenDecision) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/epc-routes", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ action: "g5-reopen.decision", requestId: g5ReopenDecision.request.id, decision: g5ReopenDecision.action, comment: String(data.get("comment")) }) });
      const result = await response.json() as { gateStatus?: PersistedGate["status"]; cancelledTaskCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "G5解冻审批失败");
      if (result.gateStatus === "returned") setPersistedGates(current => ({ ...current, [selected.id]: { ...current[selected.id], status: "returned", executionStatus: "not_required", comment: "G5已按变更控制解冻，等待Owner完成变更后重新提交" } }));
      setG5ReopenDecision(null);
      setReloadToken(current => current + 1);
      notify(g5ReopenDecision.action === "approve" ? `G5已解冻；取消${result.cancelledTaskCount ?? 0}项旧版本提交任务，等待Owner执行具体变更` : "G5解冻申请已退回补充");
    } catch (error) { notify(error instanceof Error ? error.message : "G5解冻审批失败"); }
    finally { setFlowBusy(false); }
  };

  const requestEpcException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!epcExceptionRoute) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/epc-routes", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "exception.request", input: { routeId: epcExceptionRoute.id, requestedPriceYuan: Number(data.get("requestedPriceYuan")), reason: String(data.get("reason")), evidenceRef: String(data.get("evidenceRef")), validUntil: String(data.get("validUntil")) } }) });
      const result = await response.json() as { exceptionId?: string; externalTaskId?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "EPC通路价格例外申请失败");
      setEpcExceptionRoute(null);
      setReloadToken(current => current + 1);
      notify(`价格例外已提交罗总审批；外部任务 ${result.externalTaskId}`);
    } catch (error) { notify(error instanceof Error ? error.message : "EPC通路价格例外申请失败"); }
    finally { setFlowBusy(false); }
  };

  const saveG2Strategy = async (input: { decisionPreference: string; objective: string; competitiveAssessment: string; valueProposition: string; relationshipPlan: string; resourcePlan: string; winPath: string; requirementScope: string; keyRisks: string; nonBidConsequence: string; evidenceRef: string; winThemes: string[] }) => {
    if (!selected.persisted || manager) { notify("只有真实S1项目Owner可以保存策略来源版本"); return; }
    try {
      const result = await saveS1Fact<{ id: string; version: number; readiness: G2ReadinessSnapshot }>("strategy.save", input, "sales-chen");
      updateProject(selected.id, project => ({ ...project, competition: input.competitiveAssessment, strategyPlan: project.strategyPlan ? { ...project.strategyPlan, version: `STR-V${result.version}`, objective: input.objective, winThemes: input.winThemes, valueProposition: input.valueProposition, relationshipPlan: input.relationshipPlan, resourcePlan: input.resourcePlan, winPath: input.winPath, requirementScope: input.requirementScope, keyRisks: input.keyRisks, nonBidConsequence: input.nonBidConsequence, status: "草稿" } : project.strategyPlan }));
      notify(`策略来源版本 STR-V${result.version} 已保存，G2已自动刷新`);
    } catch (error) { notify(error instanceof Error ? error.message : "策略来源保存失败"); }
  };

  const saveResourceAssignment = async (resource: SalesProject["resources"][number], candidate: NonNullable<SalesProject["resourceCandidates"]>[number]) => {
    if (!selected.persisted || !manager) { notify("真实项目的关键资源由销售主管配置"); return; }
    const assigneeName = candidate.name;
    setFlowBusy(true);
    try {
      const request = selected.resourceRequests?.find(item => item.role === resource.role && item.status === "待指派");
      const result = await saveS1Fact<{ id: string; readiness: G2ReadinessSnapshot }>("resource.upsert", { candidateId: candidate.id, roleName: resource.role, assigneeName, status: "待接受", required: resource.required, evidenceRef: request ? `依据资源申请 ${request.id} 从候选池确认指派；待本人接受责任` : `销售主管基于${selected.stage}阶段角色缺口从候选池主动确认指派；待本人接受责任` }, "manager-zhou");
      updateProject(selected.id, project => ({ ...project, resources: project.resources.map(item => item.id === resource.id ? { ...item, id: result.id, person: assigneeName, status: "待接受", dataSource: `角色指派记录 ${result.id}` } : item), health: { ...project.health, resource: Math.min(100, project.health.resource + 15) } }));
      setReloadToken(current => current + 1);
      notify(`${resource.role}已确认指派${assigneeName}；${request ? "已关联Owner/系统需求" : "已同步建立主管主动资源需求"}；仍需本人接受责任后才算到位`);
    } catch (error) { notify(error instanceof Error ? error.message : "资源指派保存失败"); }
    finally { setFlowBusy(false); }
  };

  const submitResourceCandidate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceCandidateTarget || !selected.persisted || !manager) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      await saveS1Fact("resource.candidate", {
        roleName: resourceCandidateTarget.role,
        candidateName: String(data.get("candidateName")), sourceSystem: "DEMO_IDENTITY_DIRECTORY", sourceRef: String(data.get("sourceRef")),
        capabilities: String(data.get("capabilities")), loadPercent: String(data.get("loadPercent")), activeProjectCount: String(data.get("activeProjectCount")),
        availableFrom: String(data.get("availableFrom")), evidenceRef: String(data.get("evidenceRef")),
      }, "manager-zhou");
      setResourceCandidateTarget(null);
      setReloadToken(current => current + 1);
      notify(`${resourceCandidateTarget.role}候选快照已登记；尚未形成指派，也不代表人员已接受责任`);
    } catch (error) { notify(error instanceof Error ? error.message : "资源候选登记失败"); }
    finally { setFlowBusy(false); }
  };

  const submitResourceRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/resources", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "request", input: { roleName: String(data.get("roleName")), requirement: String(data.get("requirement")), requiredBy: String(data.get("requiredBy")), evidenceRef: String(data.get("evidenceRef")) } }) });
      const result = await response.json() as { request?: { id: string }; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error ?? "资源申请失败");
      setResourceRequestOpen(false);
      setReloadToken(current => current + 1);
      notify(`资源申请 ${result.request.id} 已提交给销售主管；申请不等于人员已到位`);
    } catch (error) { notify(error instanceof Error ? error.message : "资源申请失败"); }
    finally { setFlowBusy(false); }
  };

  const requestCostingTask = async () => {
    if (!manager || !selected.persisted || selected.stage !== "S3") { notify("只有销售主管可在G3批准后启动核价专业作业"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/resources", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ projectCode: selected.id, action: "costing.request" }) });
      const result = await response.json() as { task?: { externalTaskId?: string; external_task_id?: string }; authorityBoundary?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "核价协同启动失败");
      setCostingRequestOpen(false);
      setReloadToken(current => current + 1);
      notify(`核价专业作业已启动：${result.task?.externalTaskId ?? result.task?.external_task_id ?? "任务已生成"}；仍需核价人员接受并回传权威结果`);
    } catch (error) { notify(error instanceof Error ? error.message : "核价协同启动失败"); }
    finally { setFlowBusy(false); }
  };

  const submitPartnerAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!partnerActionOpen || !selected.persisted) return;
    const data = new FormData(event.currentTarget);
    const action = partnerActionOpen === "need" ? "decide_need" : partnerActionOpen === "register" ? "register" : partnerActionOpen === "verify" ? "verify" : "record_contribution";
    const input = partnerActionOpen === "need"
      ? { decision: String(data.get("decision")), reason: String(data.get("reason")), evidenceRef: String(data.get("evidenceRef")) }
      : partnerActionOpen === "register"
        ? { partnerName: String(data.get("partnerName")), partnerType: String(data.get("partnerType")), verificationEvidenceRef: String(data.get("verificationEvidenceRef")) }
        : partnerActionOpen === "verify"
          ? { engagementId: selected.partner.engagementId, decision: String(data.get("decision")), comment: String(data.get("comment")), evidenceRef: String(data.get("evidenceRef")) }
          : { engagementId: selected.partner.engagementId, contributionType: String(data.get("contributionType")), result: String(data.get("result")), evidenceRef: String(data.get("evidenceRef")), occurredAt: new Date(String(data.get("occurredAt"))).toISOString() };
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/partners", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": partnerActionOpen === "verify" ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action, input }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "伙伴业务事实保存失败");
      setPartnerActionOpen(null);
      setReloadToken(current => current + 1);
      notify(partnerActionOpen === "need" ? "伙伴需要性判断已留痕" : partnerActionOpen === "register" ? "候选伙伴已登记并等待主管复核证据" : partnerActionOpen === "verify" ? "伙伴验证结论已留痕" : "伙伴实际贡献已留痕");
    } catch (error) { notify(error instanceof Error ? error.message : "伙伴业务事实保存失败"); }
    finally { setFlowBusy(false); }
  };

  const submitRisk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/risks", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "create", input: { category: String(data.get("category")), title: String(data.get("title")), level: String(data.get("level")), description: String(data.get("description")), impact: String(data.get("impact")), ownerName: selected.owner, dueDate: String(data.get("dueDate")), evidenceRef: String(data.get("evidenceRef")) } }) });
      const result = await response.json() as { risk?: { id: string }; error?: string };
      if (!response.ok || !result.risk) throw new Error(result.error ?? "风险登记失败");
      setRiskOpen(false);
      setReloadToken(current => current + 1);
      notify(`风险 ${result.risk.id} 已登记并由${selected.owner}承担`);
    } catch (error) { notify(error instanceof Error ? error.message : "风险登记失败"); }
    finally { setFlowBusy(false); }
  };

  const closeRisk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!riskCloseTarget) return;
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/risks", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, action: "transition", input: { riskId: riskCloseTarget.id, command: "close", expectedVersion: riskCloseTarget.version ?? 1, reason: String(data.get("reason")), resolution: String(data.get("resolution")), evidenceRef: String(data.get("evidenceRef")) } }) });
      const result = await response.json() as { risk?: Record<string, unknown>; error?: string };
      if (!response.ok || !result.risk) throw new Error(result.error ?? "风险关闭失败");
      setRiskCloseTarget(null);
      setReloadToken(current => current + 1);
      notify("风险已关闭；处置结论、证据和状态流转已留痕");
    } catch (error) { notify(error instanceof Error ? error.message : "风险关闭失败"); }
    finally { setFlowBusy(false); }
  };

  const addAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const draft: ProjectAction = {
      id: `ACT-${Math.round(event.timeStamp)}`,
      type: String(data.get("type")),
      title: String(data.get("title")),
      purpose: String(data.get("purpose")),
      owner: String(data.get("owner")),
      due: String(data.get("due")),
      status: "待开始",
      evidence: String(data.get("evidence")),
      result: "待执行",
      context: actionContext,
    };
    try {
      setFlowBusy(true);
      let action = draft;
      let activityRecord: PersistedActivityRecord | undefined;
      if (selected.persisted) {
        const linkedRisk = selected.risks.find(risk => risk.title === actionSeed && risk.status === "开放");
        const response = await fetch("/api/p0/activities", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, input: { title: draft.title, purpose: draft.purpose, ownerName: draft.owner, plannedEnd: draft.due, evidenceRef: draft.evidence, context: actionContext, riskId: !manager ? linkedRisk?.id : undefined, expectedRiskVersion: !manager ? linkedRisk?.version : undefined } }) });
        const result = await response.json() as { activity?: PersistedActivityRecord; error?: string };
        if (!response.ok || !result.activity) throw new Error(result.error ?? "项目活动保存失败");
        activityRecord = result.activity;
        action = { ...draft, id: activityRecord.id, type: activityRecord.definitionCode, evidence: activityRecord.evidenceRefs.join("；") || draft.evidence };
      }
      updateProject(selected.id, (project) => ({ ...project, actions: [action, ...project.actions], activityRecords: activityRecord ? [activityRecord, ...(project.activityRecords ?? [])] : project.activityRecords, risks: project.risks.map((risk) => risk.title === actionSeed ? { ...risk, status: "处理中" } : risk) }));
      setActionOpen(false);
      setActionSeed("");
      setActionContext("project_operation");
      if (selected.persisted) setReloadToken(current => current + 1);
      notify(manager ? `主管督办“${action.title}”已持久化并下发给${action.owner}` : `行动“${action.title}”已持久化并指派给${action.owner}`);
    } catch (error) { notify(error instanceof Error ? error.message : "项目活动保存失败"); }
    finally { setFlowBusy(false); }
  };

  const saveMilestone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected.persisted) { notify("请使用D1项目维护真实里程碑"); return; }
    const data = new FormData(event.currentTarget);
    setFlowBusy(true);
    try {
      const input = { title: String(data.get("title")), milestoneType: String(data.get("milestoneType")), ownerName: String(data.get("ownerName")), plannedAt: String(data.get("plannedAt")), completionCriteria: String(data.get("completionCriteria")), evidenceRequirement: String(data.get("evidenceRequirement")), dependencyRef: String(data.get("dependencyRef") ?? ""), changeReason: String(data.get("changeReason")) };
      const response = await fetch("/api/p0/milestones", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, input }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "里程碑保存失败");
      setMilestoneOpen(false);
      setReloadToken(current => current + 1);
      notify("项目里程碑已保存；计划独立维护，实际完成仍由权威事件或完成证据更新");
    } catch (error) { notify(error instanceof Error ? error.message : "里程碑保存失败"); }
    finally { setFlowBusy(false); }
  };

  const openActivityCommand = (activityId: string) => {
    const activity = selected.activityRecords?.find(item => item.id === activityId);
    if (!activity || activity.readOnly) { notify("该活动不存在或属于外部只读投影"); return; }
    const commands = availableActivityCommands(activity, manager);
    setActivityCommandTarget(activity);
    setActivityCommand(commands[0]);
  };

  const submitActivityCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activityCommandTarget) return;
    const data = new FormData(event.currentTarget);
    try {
      setFlowBusy(true);
      const response = await fetch("/api/p0/activities/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" },
        body: JSON.stringify({
          projectCode: selected.id,
          activityId: activityCommandTarget.id,
          input: {
            commandId: crypto.randomUUID(),
            command: activityCommand,
            expectedVersion: activityCommandTarget.version,
            reason: String(data.get("reason")),
            result: String(data.get("result") ?? ""),
            evidenceRef: String(data.get("evidenceRef") ?? ""),
          },
        }),
      });
      const result = await response.json() as { activity?: PersistedActivityRecord; duplicate?: boolean; error?: string };
      if (!response.ok || !result.activity) throw new Error(result.error ?? "活动状态更新失败");
      const updated = result.activity;
      const actionStatus: ProjectAction["status"] = updated.status === "completed" ? "已完成" : updated.status === "cancelled" ? "已取消" : updated.status === "blocked" ? "已阻塞" : updated.status === "in_progress" ? "进行中" : updated.timelinessStatus === "overdue" ? "已延期" : "待开始";
      updateProject(selected.id, project => ({
        ...project,
        activityRecords: project.activityRecords?.map(item => item.id === updated.id ? updated : item),
        actions: project.actions.map(item => item.id === updated.id ? { ...item, status: actionStatus, result: updated.result ?? updated.exceptionReason ?? item.result, evidence: updated.evidenceRefs.join("；") || item.evidence, actualStart: updated.actualStart, actualEnd: updated.actualEnd } : item),
      }));
      setActivityCommandTarget(null);
      notify(`${activityCommandLabels[activityCommand]}已保存；活动版本更新为V${updated.version}`);
    } catch (error) { notify(error instanceof Error ? error.message : "活动状态更新失败"); }
    finally { setFlowBusy(false); }
  };

  const approveDeviation = (deviationId: string) => {
    if (!manager) { notify("请切换为销售主管后执行偏差审批"); return; }
    updateProject(selected.id, (project) => ({ ...project, deviations: project.deviations.map((item) => item.id === deviationId ? { ...item, status: "已批准" } : item), risks: project.risks.map((risk) => risk.evidence === deviationId ? { ...risk, status: "已关闭" } : risk) }));
    notify("偏差已批准；一致性和阶段门已重新计算，其他缺口仍保留");
  };

  const handleStrategyAction = () => {
    if (!selected.strategyPlan) { notify("当前项目尚未形成策略草案"); return; }
    if (manager) {
      if (selected.strategyPlan.status === "待主管评审") {
        updateProject(selected.id, (project) => ({ ...project, strategyPlan: project.strategyPlan ? { ...project.strategyPlan, status: "已批准" } : project.strategyPlan }));
        notify("主管已批准当前赢单策略版本；策略事实和验证行动保持独立更新");
      } else {
        updateProject(selected.id, (project) => ({ ...project, strategyPlan: project.strategyPlan ? { ...project.strategyPlan, status: "需要更新" } : project.strategyPlan }));
        notify("主管已要求更新策略，项目Owner需补充竞争事实和行动计划");
      }
      return;
    }
    updateProject(selected.id, (project) => ({ ...project, strategyPlan: project.strategyPlan ? { ...project.strategyPlan, status: "待主管评审" } : project.strategyPlan }));
    notify("策略版本已提交销售主管评审；销售员不能自行批准");
  };

  const simulateChange = () => {
    if (manager) {
      notify("客户需求事实由销售员登记；主管只能要求补充证据并督办影响评审");
      return;
    }
    updateProject(selected.id, (project) => {
      const next = project.changeCount + 1;
      const previousReq = project.versions.filter((item) => item.kind === "客户需求").at(-1);
      const newRequirement: ArtifactVersion = { id: `REQ-C${next + 1}.0`, kind: "客户需求", version: `V${next + 1}.0`, status: "生效", createdAt: "2026-08-17 11:20", creator: project.owner, approver: "客户项目负责人", basedOn: previousReq?.id ?? "客户变更函", summary: next === 2 ? "新增远程监测冗余与提前10天交付要求" : "客户新增能耗与监测要求" };
      return { ...project, changeCount: next, versions: [...project.versions.map((item) => item.kind === "客户需求" ? { ...item, status: "历史" as const } : { ...item, status: item.status === "已提交" ? item.status : "需要重新评审" as const }), newRequirement], riskLevel: "高", nextStep: "完成需求变更影响分析并重新发起技术与核价评审", risks: [{ id: `RSK-CHG-${next}`, level: "高", category: "方案", title: "新需求已生效，下游版本需要重新评审", owner: "赵工", due: "2026-08-20", status: "开放", evidence: newRequirement.id }, ...project.risks] };
    });
    notify("已创建新需求版本；技术、核价和投标版本均标记为需要重新评审");
  };

  const trySubmit = () => {
    setSubmitBlockers(null);
    if (!selected.persisted) { notify("内置静态样例不执行真实提交；请使用D1立项项目回放G5主线"); return; }
    if (selected.stage !== "S4") { notify(`当前项目在${selected.stage}，只有S4完成G5批准后才会生成正式提交任务`); return; }
    const task = selected.externalTasks?.find(item => item.taskType === "G5_SUBMISSION_EXECUTION" && ["pending", "accepted"].includes(item.status));
    notify(task ? `正式提交任务 ${task.externalTaskId} 已在独立集成测试台等待孙投标处理；主系统不能模拟改写S5` : "先在阶段门提交G5并由主管作出投标决策；批准后系统才生成正式提交任务");
  };

  const submitG1Decision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manager || selected.stage !== "S0" || !selectedGate || selectedGate.status !== "pending") { notify("当前没有可由销售主管确认的G1申请"); return; }
    const data = new FormData(event.currentTarget);
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "return" ? "return" : "approve";
    const projectGrade = String(data.get("projectGrade"));
    const gradeReason = String(data.get("gradeReason"));
    const gradeEvidence = String(data.get("gradeEvidence"));
    const comment = String(data.get("comment"));
    if (!comment.trim()) { notify(action === "return" ? "退回必须填写需要补充的事实或证据" : "批准必须填写主管判断意见"); return; }
    if (action === "approve" && projectGrade !== (selected.leadGrade ?? selected.projectGrade) && (!gradeReason.trim() || !gradeEvidence.trim())) { notify("调整项目等级必须填写原因和依据；原线索评级会保持只读"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action, comment, projectGrade, gradeReason, gradeEvidence }) });
      const result = await response.json() as { stage?: ProjectStage; stageName?: string; gateStatus?: PersistedGate["status"]; projectGrade?: LeadGrade; projectGradeReason?: string; error?: string };
      if (!response.ok || !result.stage || !result.stageName) throw new Error(result.error ?? "G1审批失败");
      updateProject(selected.id, project => ({ ...project, projectGrade: result.projectGrade ?? project.projectGrade, projectGradeReason: result.projectGradeReason ?? project.projectGradeReason, stage: result.stage!, stageName: result.stageName!, nextStep: action === "approve" ? "制定客户关系、赢单策略与按需资源计划" : "补充G1退回意见要求的来源事实后重新提交" }));
      setPersistedGates(current => action === "approve" ? (() => { const next = { ...current }; delete next[selected.id]; return next; })() : ({ ...current, [selected.id]: { ...selectedGate, status: result.gateStatus ?? "returned", comment } }));
      setG1DecisionOpen(false);
      setReloadToken(current => current + 1);
      notify(action === "approve" ? "G1已批准：线索评级保持只读，销售项目等级与审批依据已留痕，项目进入S1" : "G1已退回：补充要求已留痕，项目仍停留S0");
    } catch (error) { notify(error instanceof Error ? error.message : "G1审批失败"); }
    finally { setFlowBusy(false); }
  };

  const submitG2Decision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manager || selected.stage !== "S1" || !selectedGate || selectedGate.code !== "G2" || selectedGate.status !== "pending") { notify("当前没有可由销售主管处理的G2申请"); return; }
    const data = new FormData(event.currentTarget);
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "return" ? "return" : "approve";
    const comment = String(data.get("comment") ?? "").trim();
    const investmentScope = String(data.get("investmentScope") ?? "").trim();
    const priorityAndDeadline = String(data.get("priorityAndDeadline") ?? "").trim();
    const returnItems = String(data.get("returnItems") ?? "").trim();
    if (!comment) { notify(action === "return" ? "退回必须填写判断意见" : "批准G2必须填写投入启动判断意见"); return; }
    if (action === "approve" && (!investmentScope || !priorityAndDeadline)) { notify("批准G2必须明确投入范围、优先级和期限"); return; }
    if (action === "return" && !returnItems) { notify("退回G2必须逐项写明需补充的对象和整改要求"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g2/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action, comment, investmentScope, priorityAndDeadline, returnItems }) });
      const result = await response.json() as { stage?: ProjectStage; stageName?: string; gateStatus?: PersistedGate["status"]; error?: string };
      if (!response.ok || !result.stage || !result.stageName) throw new Error(result.error ?? "G2审批失败");
      setG2DecisionOpen(false);
      if (action === "approve") {
        updateProject(selected.id, project => ({ ...project, stage: result.stage!, stageName: result.stageName!, nextStep: "启动详细需求澄清和方案作业，等待权威系统回传" }));
        setPersistedGates(current => { const next = { ...current }; delete next[selected.id]; return next; });
        notify("G2已批准并留痕，项目进入S2需求与方案");
      } else {
        updateProject(selected.id, project => ({ ...project, nextStep: "按G2退回意见补充来源事实后重新提交" }));
        setPersistedGates(current => ({ ...current, [selected.id]: { ...selectedGate, status: result.gateStatus ?? "returned", comment } }));
        notify("G2已退回并保留冻结快照，项目保持S1");
      }
      setReloadToken(current => current + 1);
    } catch (error) { notify(error instanceof Error ? error.message : "G2审批失败"); }
    finally { setFlowBusy(false); }
  };

  const advanceStage = async () => {
    if (!manager) { notify("阶段推进需由销售主管操作"); return; }
    const blockers = getGateConditions(selected, selectedG2Input).filter((item) => item.hard && !item.ok);
    if (blockers.length) { notify(`仍有${blockers.length}个硬阻断项，暂不能推进阶段`); return; }
    if (selected.stage === "S0" && selectedGate) {
      if (selectedGate.status !== "pending") { notify(selectedGate.status === "returned" ? "该申请已退回，等待销售员补充后重新提交" : "G1已经批准，请刷新项目状态"); return; }
      setG1DecisionOpen(true);
      return;
    }
    if (selected.stage === "S1") {
      if (!selectedGate || selectedGate.status !== "pending") { notify("当前项目没有可审批的G2申请；请先由销售Owner提交双轨事实"); return; }
      setG2DecisionOpen(true);
      return;
    }
    if (selected.stage === "S2") {
      notify(selectedGate?.status === "pending" ? "该项目仍使用旧版G3任务，请由销售Owner按新流程重新触发系统校验" : "请先由销售与技术责任人形成权威来源，再由销售Owner触发G3系统校验");
      return;
    }
    if (selected.stage === "S3") {
      notify(selectedGate?.status === "pending" ? "G4正在等待财务/价格授权人确认；销售主管不能代批" : "请先形成核价专业来源，再由销售Owner申请G4核价授权门");
      return;
    }
    if (selected.stage === "S4") {
      if (!selectedGate || selectedGate.code !== "G5" || selectedGate.status !== "pending") { notify("当前没有可决策的G5申请；请先由销售Owner核对投标作业来源并提交G5"); return; }
      setG5DecisionOpen(true);
      return;
    }
    if (selected.stage === "S5") {
      await decideG6("approve");
      return;
    }
    notify(`${selected.stage}之后的阶段必须通过对应Gate推进；当前批次尚未实现，系统不会模拟改写阶段`);
  };

  const submitG5Decision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGate || selectedGate.code !== "G5") return;
    const data = new FormData(event.currentTarget);
    const decision = String(data.get("decision"));
    if (decision === "return") {
      const comment = String(data.get("comment") ?? "").trim();
      if (!comment) { notify("退回补充必须逐项说明缺失材料、责任角色和重提要求"); return; }
      if (await returnG5(comment)) setG5DecisionOpen(false);
      return;
    }
    if (decision === "decline") {
      const comment = String(data.get("comment") ?? "").trim();
      if (!comment) { notify("不投/不报必须填写经营判断、原因和证据说明"); return; }
      if (await declineG5(comment)) setG5DecisionOpen(false);
      return;
    }
    const residualHighRisks = selected.g5Readiness?.residualHighRisks ?? [];
    const deviationItems = selected.g5Readiness?.deviationItems ?? [];
    const deviationAuthorizations = deviationItems.map(item => ({
      deviationRef: item.ref,
      scope: String(data.get(`deviationScope:${item.ref}`) ?? ""),
      risk: String(data.get(`deviationRisk:${item.ref}`) ?? ""),
      applicableVersionId: String(data.get(`deviationVersion:${item.ref}`) ?? ""),
      validUntil: String(data.get(`deviationValidUntil:${item.ref}`) ?? ""),
      evidenceRef: String(data.get(`deviationEvidence:${item.ref}`) ?? ""),
    }));
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g5/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action: "approve_submit", comment: String(data.get("comment")), acceptResidualRisks: residualHighRisks.length > 0 && data.get("acceptResidualRisks") === "on", riskAcceptanceReason: String(data.get("riskAcceptanceReason") ?? ""), deviationAuthorizations }) });
      const result = await response.json() as { gateStatus?: PersistedGate["status"]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "G5决策失败");
      setG5DecisionOpen(false);
      setPersistedGates(current => ({ ...current, [selected.id]: { ...selectedGate, status: result.gateStatus ?? "approved", executionStatus: "executing", comment: "已批准投标，等待外部正式提交回执" } }));
      updateProject(selected.id, project => ({ ...project, nextStep: "等待投标专员按冻结版本正式提交并回传回执" }));
      setReloadToken(current => current + 1);
      notify(residualHighRisks.length ? `G5投标决策及${residualHighRisks.length}项剩余重大/高风险接受记录已留痕；项目等待正式提交回执` : "G5投标决策已记录；项目仍停留S4，收到正式提交回执后才进入S5");
    } catch (error) { notify(error instanceof Error ? error.message : "G5决策失败"); }
    finally { setFlowBusy(false); }
  };

  const submitG1Draft = async () => {
    if (manager || selected.stage !== "S0" || selectedGate) { notify("当前项目不是可提交的S0草稿"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g1/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; version?: number; error?: string };
      if (!response.ok || !result.gateId || result.gateStatus !== "pending") throw new Error(result.error ?? "G1提交失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G1", status: "pending", version: result.version } }));
      updateProject(selected.id, project => ({ ...project, nextStep: "G1已提交，等待销售主管审查冻结快照" }));
      setReloadToken(current => current + 1);
      notify("G1 V1来源快照已冻结并提交销售主管；草稿不再出现在Owner待提交队列");
    } catch (error) { notify(error instanceof Error ? error.message : "G1提交失败"); }
    finally { setFlowBusy(false); }
  };

  const resubmitG1 = async () => {
    if (manager || selected.stage !== "S0" || selectedGate?.status !== "returned") { notify("当前没有可重新提交的G1申请"); return; }
    try {
      const response = await fetch("/api/p0/gates/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ gateId: selectedGate.id, action: "resubmit", comment: "已按退回意见补充事实与证据，重新提交。" }) });
      const result = await response.json() as { gateStatus?: PersistedGate["status"]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "G1重新提交失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { ...selectedGate, status: result.gateStatus ?? "pending", comment: "已补充并重新提交" } }));
      updateProject(selected.id, project => ({ ...project, nextStep: "等待销售主管重新审批G1" }));
      notify("补充说明已记录，G1已重新提交销售主管");
    } catch (error) { notify(error instanceof Error ? error.message : "G1重新提交失败"); }
  };

  const submitG2Preparation = async () => {
    if (manager || selected.stage !== "S1") { notify("只有S1项目Owner可以提交G2来源事实汇总"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g2/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; input?: G2PreparationInput; readiness?: G2ReadinessSnapshot; error?: string };
      if (!response.ok || !result.gateId) throw new Error(result.error ?? "G2提交失败");
      if (!result.input || !result.readiness) throw new Error("G2服务端未返回来源快照");
      setG2Inputs(current => ({ ...current, [selected.id]: result.input! }));
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G2", status: result.gateStatus ?? "pending" } }));
      updateProject(selected.id, project => ({ ...project, g2Preparation: result.input!, g2Readiness: result.readiness!, nextStep: "等待销售主管核对冻结来源并明确投入范围、优先级和期限" }));
      notify("G2已冻结来源记录引用与摘要，并提交销售主管");
    } catch (error) { notify(error instanceof Error ? error.message : "G2提交失败"); }
    finally { setFlowBusy(false); }
  };

  const submitS2StageExit = async () => {
    if (manager || selected.stage !== "S2") { notify("只有S2项目Owner可以提交G3技术评审申请"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g3/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; readiness?: S2ReadinessSnapshot; version?: number; stage?: ProjectStage; stageName?: string; decisionRole?: string; error?: string };
      if (!response.ok || !result.gateId || result.stage !== "S2" || result.gateStatus !== "pending") throw new Error(result.error ?? "G3技术评审申请失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G3", status: "pending", version: result.version } }));
      updateProject(selected.id, project => ({ ...project, s2Readiness: result.readiness ?? project.s2Readiness, nextStep: `等待${result.decisionRole ?? "技术评审人"}审核冻结的需求与技术方案基线` }));
      notify("G3来源快照已冻结并提交技术评审人；评审通过后才进入S3");
    } catch (error) { notify(error instanceof Error ? error.message : "G3技术评审申请失败"); }
    finally { setFlowBusy(false); }
  };

  const submitS3StageExit = async () => {
    if (manager || selected.stage !== "S3") { notify("只有S3项目Owner可以申请G4"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g4/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; readiness?: S3ReadinessSnapshot; version?: number; error?: string };
      if (!response.ok || !result.gateId) throw new Error(result.error ?? "G4申请失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G4", status: result.gateStatus ?? "pending", version: result.version } }));
      updateProject(selected.id, project => ({ ...project, s3Readiness: result.readiness ?? project.s3Readiness, nextStep: "等待财务/价格授权人确认G4核价授权门" }));
      notify("G4已冻结核价专业来源引用，并生成财务/价格授权确认任务");
    } catch (error) { notify(error instanceof Error ? error.message : "G4申请失败"); }
    finally { setFlowBusy(false); }
  };

  const submitS4StageExit = async () => {
    if (manager || selected.stage !== "S4") { notify("只有S4项目Owner可以提交G5"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g5/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; readiness?: G5ReadinessSnapshot; version?: number; error?: string };
      if (!response.ok || !result.gateId) throw new Error(result.error ?? "G5申请失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G5", status: result.gateStatus ?? "pending", version: result.version } }));
      updateProject(selected.id, project => ({ ...project, g5Readiness: result.readiness ?? project.g5Readiness, nextStep: "等待销售主管作出投/不投决策及提交授权" }));
      notify("G5已冻结授权、提交包和专业评审来源，提交销售主管作一次商务决策");
    } catch (error) { notify(error instanceof Error ? error.message : "G5申请失败"); }
    finally { setFlowBusy(false); }
  };

  const declineG5 = async (comment: string) => {
    if (!manager || selected.stage !== "S4" || selectedGate?.code !== "G5" || selectedGate.status !== "pending") { notify("当前没有可执行不投/不报决策的G5申请"); return false; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g5/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action: "decline", comment }) });
      const result = await response.json() as { stage?: ProjectStage; stageName?: string; gateStatus?: PersistedGate["status"]; error?: string };
      if (!response.ok || !result.stage || !result.stageName) throw new Error(result.error ?? "G5不投决策失败");
      setPersistedGates(current => { const next = { ...current }; delete next[selected.id]; return next; });
      updateProject(selected.id, project => ({ ...project, stage: result.stage!, stageName: result.stageName!, result: "terminated", administrativeStatus: "PendingClose", nextStep: "完成不投/不报原因复盘与行政关闭" }));
      notify("G5已记录不投/不报决策，未伪造BidSubmitted；项目进入S5结果与移交");
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : "G5不投决策失败"); return false; }
    finally { setFlowBusy(false); }
  };

  const returnG5 = async (comment: string) => {
    if (!manager || selected.stage !== "S4" || selectedGate?.code !== "G5" || selectedGate.status !== "pending") { notify("当前没有可退回补充的G5申请"); return false; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g5/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action: "return", comment }) });
      const result = await response.json() as { gateStatus?: PersistedGate["status"]; error?: string };
      if (!response.ok || result.gateStatus !== "returned") throw new Error(result.error ?? "G5退回失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { ...selectedGate, status: "returned", executionStatus: "not_required", comment } }));
      updateProject(selected.id, project => ({ ...project, nextStep: "按G5退回意见补充投标材料、专业评审或授权事实后重新提交" }));
      setReloadToken(current => current + 1);
      notify("G5已退回销售Owner补充；项目仍停留S4，未形成投/不投结论");
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : "G5退回失败"); return false; }
    finally { setFlowBusy(false); }
  };

  const submitLost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manager || !selected.persisted || selected.stage !== "S5") { notify("只有S5项目Owner可以准备失标/终止复盘"); return; }
    const data = new FormData(event.currentTarget);
    const review: LostReview = { reason: String(data.get("reason")), competitor: String(data.get("competitor")), gap: String(data.get("gap")), evidence: String(data.get("evidence")), improvement: String(data.get("improvement")) };
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g6/review", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, reasonCategory: review.reason, reasonDetail: String(data.get("reasonDetail")), competitorName: review.competitor, keyGap: review.gap, evidenceRef: review.evidence, improvementAction: review.improvement, actionOwner: String(data.get("actionOwner")), dueDate: String(data.get("dueDate")) }) });
      const result = await response.json() as { readiness?: G6ReadinessSnapshot; error?: string };
      if (!response.ok || !result.readiness) throw new Error(result.error ?? "复盘保存失败");
      updateProject(selected.id, project => ({ ...project, lostReview: review, g6Readiness: result.readiness, nextStep: "核对自动汇总的G6来源并提交销售主管确认" }));
      setLostOpen(false);
      notify("结构化复盘已保存；商业结果尚未由主管确认");
    } catch (error) { notify(error instanceof Error ? error.message : "复盘保存失败"); }
    finally { setFlowBusy(false); }
  };

  const submitG6 = async (remediation?: { resolutionSummary: string; evidenceRef: string }) => {
    if (manager || !selected.persisted || selected.stage !== "S5") { notify("只有S5项目Owner可以提交G6"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g6/submission", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, remediation }) });
      const result = await response.json() as { gateId?: string; gateStatus?: PersistedGate["status"]; readiness?: G6ReadinessSnapshot; version?: number; error?: string };
      if (!response.ok || !result.gateId) throw new Error(result.error ?? "G6申请失败");
      setPersistedGates(current => ({ ...current, [selected.id]: { id: result.gateId!, code: "G6", status: result.gateStatus ?? "pending", version: result.version } }));
      updateProject(selected.id, project => ({ ...project, g6Readiness: result.readiness ?? project.g6Readiness, nextStep: "等待销售主管一次性确认商业结果及移交/关闭分支" }));
      notify("G6结果事实、基线或复盘来源已冻结并提交销售主管");
    } catch (error) { notify(error instanceof Error ? error.message : "G6申请失败"); }
    finally { setFlowBusy(false); }
  };

  const requestResultCorrection = async (routeResultId: string, reason: string, evidenceRef: string) => {
    if (manager || !selected.persisted || selected.stage !== "S5") { notify("只有S5待确认项目的销售Owner可以发起结果核实"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/result-corrections", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" }, body: JSON.stringify({ projectCode: selected.id, input: { routeResultId, reason, evidenceRef } }) });
      const result = await response.json() as { task?: { externalTaskId?: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "结果核实请求失败");
      setReloadToken(current => current + 1);
      notify(`结果核实任务已派发${result.task?.externalTaskId ? `：${result.task.externalTaskId}` : ""}；请在3010由投标作业责任人处理`);
    } catch (error) { notify(error instanceof Error ? error.message : "结果核实请求失败"); }
    finally { setFlowBusy(false); }
  };

  const decideG6 = async (action: "approve" | "return", reviewComment?: string) => {
    if (!manager || selectedGate?.code !== "G6" || selectedGate.status !== "pending") { notify("当前没有可处理的G6申请"); return; }
    setFlowBusy(true);
    try {
      const response = await fetch("/api/p0/gates/g6/decision", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": "manager-zhou" }, body: JSON.stringify({ gateId: selectedGate.id, action, comment: reviewComment }) });
      const result = await response.json() as { gateStatus?: PersistedGate["status"]; executionStatus?: PersistedGate["executionStatus"]; resultType?: "won" | "lost" | "terminated"; awardBaseline?: { id: string; manifestHash: string }; error?: string };
      if (!response.ok || !result.gateStatus) throw new Error(result.error ?? "G6决策失败");
      setG6DecisionOpen(false);
      setPersistedGates(current => ({ ...current, [selected.id]: { ...selectedGate, status: result.gateStatus!, executionStatus: result.executionStatus } }));
      if (action === "return") {
        updateProject(selected.id, project => ({ ...project, nextStep: "补充结果、基线或复盘来源后重新提交G6" }));
        notify("G6已退回；项目仍停留S5，未改变商业结果");
      } else if (result.resultType === "won" && result.awardBaseline) {
        const manifest = selected.g6Readiness?.awardBaselineManifest ?? {};
        updateProject(selected.id, project => ({ ...project, result: "won", administrativeStatus: "PendingClose", probability: 100, baseline: { id: result.awardBaseline!.id, createdAt: new Date().toLocaleString("zh-CN"), approver: "周主管", requirementId: String(manifest.requirementVersionId ?? "未提供"), technicalId: String(manifest.technicalSolutionVersionId ?? "未提供"), designBomId: String(manifest.designBomVersionId ?? "未提供"), costingId: String(manifest.costingSolutionVersionId ?? "未提供"), floorPriceId: String(manifest.pricingAuthorizationId ?? "未提供"), bidId: String(manifest.bidPackageVersionId ?? "未提供"), submissionId: String(manifest.commercialSubmissionId ?? "未提供"), resultNoticeId: String(manifest.resultNoticeId ?? "未提供"), transferStatus: "待接收", contractRef: "等待合同APP接收", manifestHash: result.awardBaseline!.manifestHash }, nextStep: "等待合同管理员校验并回传中标基线接收回执" }));
        notify("G6赢单已确认；中标基线已冻结并派发合同接收任务，收到回执后才进入S6");
      } else {
        updateProject(selected.id, project => ({ ...project, result: result.resultType ?? project.result, administrativeStatus: "Closed", probability: 0, nextStep: "商业生命周期与行政关闭均已留痕完成" }));
        notify("G6未成交分支已确认；结构化复盘满足条件，项目已行政关闭");
      }
    } catch (error) { notify(error instanceof Error ? error.message : "G6决策失败"); }
    finally { setFlowBusy(false); }
  };

  const submitG6Decision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void decideG6(String(data.get("decision")) === "return" ? "return" : "approve", String(data.get("comment") ?? ""));
  };

  const resetResult = () => {
    const original = initialProjects().find((item) => item.id === selected.id);
    if (original) updateProject(selected.id, () => original);
    notify("当前项目结果已重置，可回放另一结果分支");
  };

  const renderDashboard = () => <RoleDashboard key={`${role}-${dashboardFocus}`} projects={projects} role={role} openProject={openProject} onNewProject={openInitiation} onShowProjects={showProjects} onOpenWorkspace={openWorkspace} onQuickRelation={quickRelation} onQuickAction={quickAction} onVoiceRecord={saveVoiceRecord} onNotify={notify} quickProjectId={quickProjectId} recentProjectIds={recentProjectIds} dashboardFocus={dashboardFocus} onManagerQuickDecision={managerQuickDecision} realPendingGates={realPendingGates} onQuickProjectChange={(id) => { setQuickProjectId(id); setRecentProjectIds((current) => [id, ...current.filter((item) => item !== id)].slice(0, 3)); }} />;

  const renderProjects = () => <>
    <div className="page-title"><div><span className="eyebrow">项目组合</span><h1>销售项目列表</h1><p>按当前阶段、负责人和风险筛选，阶段不等于任务状态。</p></div><button className="primary" onClick={openInitiation}>{manager ? "线索转入与主管代建" : "线索转入与立项"}</button></div>
    <section className="panel filter-panel"><div className="search-box"><span>⌕</span><input aria-label="搜索项目" placeholder="搜索项目编号、客户、标的或负责人" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}><option>全部阶段</option>{stageDefinitions.map((stage) => <option key={stage.code} value={stage.code}>{stage.code} {stage.name}</option>)}</select><select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option>全部负责人</option>{[...new Set(projects.map((item) => item.owner))].map((owner) => <option key={owner}>{owner}</option>)}</select><select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option>全部风险</option><option>高风险及重大</option><option>待评估</option><option>重大</option><option>高</option><option>中</option><option>低</option></select><div className="view-toggle"><button className={listMode === "table" ? "active" : ""} onClick={() => setListMode("table")}>表格</button><button className={listMode === "card" ? "active" : ""} onClick={() => setListMode("card")}>卡片</button></div></section>
    <div className="result-count">共 {filteredProjects.length} 个项目 <span>· 模拟数据截至 2026-08-17</span></div>
    {listMode === "table" ? <section className="panel table-wrap"><table><thead><tr><th>项目 / 管理分级</th><th>阶段</th><th>Owner</th><th>预计金额</th><th>健康度</th><th>风险等级</th><th>提交状态</th><th /></tr></thead><tbody>{filteredProjects.map((project) => { const score = Math.round((project.health.relationship + project.health.resource + project.health.operation) / 3); const healthBand = score >= 80 ? "healthy" : score >= 60 ? "attention" : "critical"; return <tr key={project.id} onClick={() => openProject(project.id)}><td><strong>{project.name}</strong><small><span className={`rd-importance grade-${project.projectGrade ?? project.leadGrade ?? "B"}`}>项目{project.projectGrade ?? project.leadGrade ?? "B"}级</span><span className="lead-grade">线索{project.leadGrade ?? "未提供"}级</span>{project.id} · {project.customer}</small></td><td><span className={`stage-pill stage-${project.stage.toLowerCase()}`}>{project.stage}</span>{project.stageName}</td><td>{project.owner}</td><td>{money(project.amount)}</td><td><div className={`mini-health ${healthBand}`}><i style={{ width: `${score}%` }} /></div><small className={`health-text ${healthBand}`}>{score} 分 · {healthBand === "healthy" ? "健康" : healthBand === "attention" ? "待关注" : "需干预"}</small></td><td><Badge>{project.riskLevel}风险</Badge></td><td><strong className={project.result === "pending" && project.countdown <= 2 && project.countdown >= 0 ? "danger-text" : ""}>{submissionTimingLabel(project)}</strong><small>{project.result === "pending" ? project.bidDate : "结果已形成"}</small></td><td><button className="row-button">进入 ›</button></td></tr>; })}</tbody></table></section> : <div className="project-cards">{filteredProjects.map((project) => <button className="project-card" key={project.id} onClick={() => openProject(project.id)}><div className="project-card-top"><span><span className={`rd-importance grade-${project.projectGrade ?? project.leadGrade ?? "B"}`}>项目{project.projectGrade ?? project.leadGrade ?? "B"}级</span><span className="lead-grade">线索{project.leadGrade ?? "未提供"}级</span>{project.id}</span><Badge>{project.riskLevel}风险</Badge></div><h3>{project.name}</h3><p>{project.customer}</p><div className={`project-card-stage stage-${project.stage.toLowerCase()}`}><span>{project.stage}</span><div><strong>{project.stageName}</strong><small>{project.nextStep}</small></div></div><div className="project-card-foot"><span>{project.owner}</span><strong>{money(project.amount)}</strong><span className={project.result === "pending" && project.countdown <= 2 && project.countdown >= 0 ? "danger-text" : ""}>{submissionTimingLabel(project)}</span></div></button>)}</div>}
  </>;

  const renderNew = () => {
    const selectedLeadConversion = leadConversions.find(item => item.id === selectedLeadConversionId);
    const selectLeadConversion = (lead: LeadConversionRow) => {
      setSelectedLeadConversionId(lead.id);
      setLeadConversionOpen(false);
      if (lead.status !== "pending_confirmation") return;
      const snapshot = typeof lead.source_snapshot === "string" ? (() => { try { return JSON.parse(lead.source_snapshot) as Record<string, unknown>; } catch { return {}; } })() : lead.source_snapshot ?? {};
      const routing = snapshot.salesRouting && typeof snapshot.salesRouting === "object" ? snapshot.salesRouting as Record<string, unknown> : {};
      const businessContext = lead.business_context ?? {};
      const exactAmountWan = lead.amount_type === "exact" && lead.amount_min_cents ? String(lead.amount_min_cents / 1_000_000) : "";
      const scenarioCode = leadScenarioCode(lead);
      const receivedDate = String(lead.occurred_at ?? "").slice(0, 10);
      const recommendedAction = ({
        "SCN-01-DIRECT-BID": "核对招标文件、标包范围和投标截止时间，准备投标协同",
        "SCN-02-EPC-INQUIRY": "确认最终业主、EPC请求方和本次询价批次",
        "SCN-03-DIRECT-RFQ": "确认产品配置、客户预算和报价时间窗口",
        "SCN-04-OVERSEAS-PARTNER-EPC": "确认项目国家、交付国家及伙伴责任边界",
      } as Partial<Record<ScenarioType, string>>)[scenarioCode || "SCN-03-DIRECT-RFQ"] ?? "确认采购关系和下一阶段缺失事实";
      setNewStep(1);
      setNewMaxStep(1);
      setDuplicateState("idle");
      setScenarioConfirmed(false);
      setNewProject(current => ({
        ...current,
        scenarioCode,
        evidence: lead.evidence_refs.join("；"),
        finalCustomer: lead.final_customer_name ?? lead.customer_name,
        sourceCustomer: typeof businessContext.requestingPartyName === "string" && businessContext.requestingPartyName.trim()
          ? businessContext.requestingPartyName.trim()
          : lead.customer_name,
        procurementProjectName: lead.project_name,
        requestRef: lead.request_ref ?? `LEAD:${lead.lead_code}`,
        requestDate: lead.request_date ?? receivedDate,
        tenderNo: lead.tender_no ?? "",
        lotNo: lead.lot_no ?? "",
        deliveryLocation: lead.delivery_location ?? "",
        projectCountry: String(businessContext.projectCountry ?? ""),
        deliveryCountry: String(businessContext.deliveryCountry ?? ""),
        inquiryBatch: "",
        target: [lead.product_scope, typeof lead.quantity === "string" && !/^(待确认|未知|—)$/u.test(lead.quantity.trim()) ? lead.quantity.trim() : ""].filter(Boolean).join("；"),
        amount: exactAmountWan,
        bidDate: lead.submission_deadline ?? "",
        owner: lead.assigned_owner_name ?? "陈晨",
        leadGrade: ["S", "A", "B", "C"].includes(String(lead.lead_grade)) ? lead.lead_grade as LeadGrade : ["S", "A", "B", "C"].includes(String(routing.projectGradeSuggestion)) ? routing.projectGradeSuggestion as LeadGrade : "A",
        organization: typeof routing.organization === "string" && routing.organization ? routing.organization : "杭州事业部",
        requirementDate: typeof routing.requirementDate === "string" ? routing.requirementDate : "",
        technicalDate: typeof routing.technicalDate === "string" ? routing.technicalDate : "",
        costingDate: typeof routing.costingDate === "string" ? routing.costingDate : "",
        firstAction: typeof routing.firstAction === "string" && routing.firstAction.trim() ? routing.firstAction : recommendedAction,
      }));
    };
    const goForward = (step: number) => {
      setNewStep(step);
      setNewMaxStep(current => Math.max(current, step));
    };
    const checkDuplicate = async () => {
      if (!newProject.finalCustomer || !newProject.sourceCustomer || !newProject.procurementProjectName || !newProject.requestRef || !newProject.target || !newProject.amount) return notify("请先确认最终客户、请求客户、工程/采购项目、来源引用和产品范围");
      if (!newProject.tenderNo && (!newProject.deliveryLocation || !newProject.bidDate)) return notify("没有招标项目编号时，需要交付地点和采购时间窗才能完成机会查重");
      if (!newProject.scenarioCode) return notify("线索未提供业务场景，请先在线索APP补充后再转化");
      if (isEpcScenarioCode(newProject.scenarioCode) && !newProject.inquiryBatch) return notify("EPC/伙伴询价场景必须填写询价批次");
      if (newProject.scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" && (!newProject.projectCountry || !newProject.deliveryCountry)) return notify("海外伙伴/EPC询价必须确认项目国家和交付国家");
      try {
        const response = await fetch("/api/p0/projects/duplicate-check", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ ...newProject, ownerUserId: "sales-chen", leadConversionId: selectedLeadConversionId || undefined, amount: Number(newProject.amount) * 10_000 }) });
        const result = await response.json() as { duplicate?: boolean; match?: { projectCode: string }; error?: string };
        if (!response.ok) throw new Error(result.error ?? "采购机会查重失败");
        setDuplicateState(result.duplicate ? "found" : "clear");
        notify(result.duplicate ? `采购机会指纹已命中 ${result.match?.projectCode}，不得重复建项` : "服务端采购机会指纹检查通过");
      } catch (error) { notify(error instanceof Error ? error.message : "采购机会查重失败"); }
    };
    const createProject = async (submitG1: boolean) => {
      if (!selectedLeadConversionId) { notify("销售项目只能从待转化线索生成"); return; }
      if (!scenarioConfirmed || !newProject.scenarioCode) { notify("线索未提供有效业务场景，请先回线索APP补充"); return; }
      if (!newProject.finalCustomer || !newProject.sourceCustomer || !newProject.procurementProjectName || !newProject.requestRef || !newProject.requestDate || !newProject.target || !newProject.evidence || !newProject.amount || !newProject.bidDate) { notify("请补齐来源证据、客户、项目、产品、金额和客户提交时间"); return; }
      if (!newProject.tenderNo && (!newProject.deliveryLocation || !newProject.bidDate)) { notify("没有招标项目编号时，需要交付地点和采购时间窗才能形成稳定机会指纹"); return; }
      if (isEpcScenarioCode(newProject.scenarioCode) && !newProject.inquiryBatch) { notify("EPC/伙伴询价场景必须填写询价批次"); return; }
      if (newProject.scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" && (!newProject.projectCountry || !newProject.deliveryCountry)) { notify("海外伙伴/EPC询价必须确认项目国家和交付国家"); return; }
      if (duplicateState !== "clear") { notify("请先完成重复项目检查"); return; }
      if (newProject.owner !== "陈晨") { notify("当前受控人员目录只启用了销售员陈晨；系统不会把未接入的姓名伪装成可分配账号"); return; }
      if (newProject.requirementDate && newProject.requirementDate > newProject.bidDate) { notify("推荐行动截止日期不能晚于投标/报价截止日期"); return; }
      if (flowBusy) return;
      setFlowBusy(true);
      let persisted: { projectCode: string; gateId?: string; gateStatus: PersistedGate["status"] | "draft" };
      try {
        const response = await fetch("/api/p0/projects", { method: "POST", headers: { "Content-Type": "application/json", "x-demo-actor-id": manager ? "manager-zhou" : "sales-chen" }, body: JSON.stringify({ ...newProject, ownerUserId: "sales-chen", leadConversionId: selectedLeadConversionId || undefined, amount: Number(newProject.amount) * 10_000, submitG1 }) });
        const result = await response.json() as { projectCode?: string; gateId?: string; gateStatus?: PersistedGate["status"] | "draft"; error?: string };
        if (!response.ok || !result.projectCode || (submitG1 && !result.gateId)) throw new Error(result.error ?? "立项持久化失败");
        persisted = { projectCode: result.projectCode, gateId: result.gateId, gateStatus: result.gateStatus ?? (submitG1 ? "pending" : "draft") };
      } catch (error) {
        notify(error instanceof Error ? error.message : "立项持久化失败");
        setFlowBusy(false);
        return;
      }
      const id = persisted.projectCode;
      if (persisted.gateId && persisted.gateStatus !== "draft") setPersistedGates((current) => ({ ...current, [id]: { id: persisted.gateId!, code: "G1", status: persisted.gateStatus as PersistedGate["status"] } }));
      setSelectedId(id);
      setDetailTab("gate");
      setLeadConversionOpen(false);
      setView("detail");
      setReloadToken((current) => current + 1);
      setFlowBusy(false);
      notify(submitG1 ? "线索来源链、S0项目和G1 V1冻结快照已写入D1，等待销售主管审批" : manager ? "主管代建的S0草稿已保存；需由项目Owner核对并提交G1" : "S0草稿已保存；确认无误后由项目Owner提交G1");
    };
    const leadSubmitter = selectedLeadConversion?.submitter_snapshot ?? {};
    const leadGradeAssessment = selectedLeadConversion?.grade_assessment ?? {};
    const leadCustomerMaster = selectedLeadConversion?.customer_master_snapshot ?? {};
    const leadAttachments = selectedLeadConversion?.attachment_snapshot ?? [];
    const leadContext = selectedLeadConversion?.business_context ?? {};
    const leadCompetitors = Array.isArray(leadContext.competitors) ? leadContext.competitors as Array<Record<string, unknown>> : [];
    const leadKeyRoles = Array.isArray(leadContext.keyRoles) ? leadContext.keyRoles as Array<Record<string, unknown>> : [];
    const leadPartners = Array.isArray(leadContext.partners) ? leadContext.partners as Array<Record<string, unknown>> : [];
    const leadParties = Array.isArray(leadContext.parties) ? leadContext.parties as Array<Record<string, unknown>> : [];
    const leadTeamCandidates = Array.isArray(leadContext.teamCandidates) ? leadContext.teamCandidates as Array<Record<string, unknown>> : [];
    const leadContacts = selectedLeadConversion?.contact_snapshot ?? [];
    const selectedLeadSnapshot = selectedLeadConversion ? recordOf(selectedLeadConversion.source_snapshot ?? {}) : {};
    const selectedLeadFacts = recordOf(selectedLeadSnapshot.lead ?? {});
    const leadAuthenticityAssessment = recordOf(selectedLeadFacts.authenticityAssessment ?? {});
    const leadAuthenticityDimensions = Array.isArray(leadAuthenticityAssessment.dimensions) ? leadAuthenticityAssessment.dimensions as Array<Record<string, unknown>> : [];
    const leadGradeDimensions = recordOf(leadGradeAssessment.dimensions ?? {});
    const selectedInitialRequirement = selectedLeadSnapshot.initialRequirement && typeof selectedLeadSnapshot.initialRequirement === "object" ? selectedLeadSnapshot.initialRequirement as Record<string, unknown> : {};
    const selectedRequirementConstraints = Array.isArray(selectedInitialRequirement.knownConstraints) ? selectedInitialRequirement.knownConstraints.map(String) : [];
    const selectedRequirementUnknowns = Array.isArray(selectedInitialRequirement.unknowns) ? selectedInitialRequirement.unknowns.map(String) : [];
    const normalizedLeadSearch = leadSearch.trim().toLowerCase();
    const matchedLeadConversions = leadConversions.filter(lead => {
      const statusMatches = leadStatusFilter === "all" || (leadStatusFilter === "pending" ? lead.status === "pending_confirmation" : lead.status !== "pending_confirmation");
      const searchMatches = !normalizedLeadSearch || [lead.project_name, lead.lead_code, lead.customer_name, lead.final_customer_name, lead.product_scope].some(value => String(value ?? "").toLowerCase().includes(normalizedLeadSearch));
      return statusMatches && searchMatches;
    });
    const leadPageCount = Math.max(1, Math.ceil(matchedLeadConversions.length / leadPageSize));
    const safeLeadPage = Math.min(leadPage, leadPageCount);
    const filteredLeadConversions = matchedLeadConversions.slice((safeLeadPage - 1) * leadPageSize, safeLeadPage * leadPageSize);
    const selectedScenarioCode = selectedLeadConversion ? leadScenarioCode(selectedLeadConversion) : "";
    const selectedScenarioName = SCENARIO_TYPES.find(item => item.code === selectedScenarioCode)?.name;
    const selectedScenarioSource = selectedLeadConversion ? leadScenarioSourceText(selectedLeadConversion) : "";
    const selectedIsCompanyFixture = Boolean(selectedLeadConversion && String(selectedLeadConversion.field_provenance?.fixtureId ?? "").startsWith("HTML-LEAD-"));
    return <>
<div className="page-title">
<div>
<span className="eyebrow">线索人工确认转化</span>
<h1>{manager ? "主管代转化 / 分配Owner" : "销售项目转化"}</h1>
<p>所有线索先进入待转化队列；来源事实自动带入，人工确认采购关系和场景后才生成S0/G1。</p>
</div>
</div>
<section className="lead-conversion-center">
  <div className="panel lead-toolbar">
    <div className="lead-source-rule"><strong>唯一入口：线索APP人工确认转化</strong><span>来源事实带入后，人工确认场景、补齐缺口并查重，才创建S0/G1。</span></div>
    <div className="lead-toolbar-controls">
      <label className="search-box"><span>⌕</span><input aria-label="搜索线索" value={leadSearch} onChange={event => { setLeadSearch(event.target.value); setLeadPage(1); }} placeholder="搜索线索名称、编号、客户或产品" /></label>
      <select aria-label="筛选线索状态" value={leadStatusFilter} onChange={event => { setLeadStatusFilter(event.target.value as "pending" | "all" | "converted"); setLeadPage(1); }}><option value="pending">待转化</option><option value="converted">已转化</option><option value="all">全部状态</option></select>
      <div className="view-toggle"><button className={leadListMode === "table" ? "active" : ""} onClick={() => setLeadListMode("table")}>表格</button><button className={leadListMode === "card" ? "active" : ""} onClick={() => setLeadListMode("card")}>卡片</button></div>
    </div>
  </div>
  <div className="lead-workspace">
    <section className="panel lead-list-panel">
      <div className="lead-list-head"><div><strong>{leadStatusFilter === "pending" ? "待转化线索" : leadStatusFilter === "converted" ? "已转化线索" : "全部线索"}</strong><span>共 {matchedLeadConversions.length} 条 · 本页 {filteredLeadConversions.length} 条</span></div><Badge tone="warning">{leadConversions.filter(item => item.status === "pending_confirmation").length} 条待处理</Badge></div>
      {leadQueueError ? <div className="demo-boundary">线索队列读取失败：{leadQueueError}</div> : filteredLeadConversions.length === 0 ? <Empty title="没有符合条件的线索" description="请调整状态或搜索条件；公司来源样本可从3010线索模拟器导入。" /> : leadListMode === "table" ? <div className="lead-table-wrap"><table className="lead-table"><thead><tr><th>线索名称 / 编号</th><th>客户 / 最终业主</th><th>金额</th><th>等级</th><th>业务场景</th><th>状态</th></tr></thead><tbody>{filteredLeadConversions.map(lead => { const scenarioCode = leadScenarioCode(lead); return <tr key={lead.id} className={selectedLeadConversionId === lead.id ? "selected" : ""} onClick={() => selectLeadConversion(lead)}><td><strong>{lead.project_name}</strong><small>{lead.lead_code}</small></td><td><strong>{lead.customer_name}</strong><small>{lead.final_customer_name ?? "最终业主待确认"}</small></td><td><strong className={lead.amount_type === "unknown" ? "lead-value missing" : "lead-value amount"}>{leadAmountText(lead)}</strong></td><td><span className={`lead-grade grade-${String(lead.lead_grade ?? "unknown").toLowerCase()}`}>{lead.lead_grade ?? "待定"}</span></td><td><strong>{SCENARIO_TYPES.find(item => item.code === scenarioCode)?.name ?? "线索待补充"}</strong><small>{leadScenarioSourceText(lead)}</small></td><td><Badge tone={lead.status === "pending_confirmation" ? "warning" : "success"}>{lead.status === "pending_confirmation" ? "待人工转化" : "已转S0"}</Badge></td></tr>; })}</tbody></table></div> : <div className="lead-conversion-grid">{filteredLeadConversions.map(lead => { const scenarioCode = leadScenarioCode(lead); return <button key={lead.id} className={`lead-conversion-card ${selectedLeadConversionId === lead.id ? "selected" : ""} ${lead.status !== "pending_confirmation" ? "converted" : ""}`} onClick={() => selectLeadConversion(lead)}><div><span>{lead.lead_code}</span><Badge tone={lead.status === "pending_confirmation" ? "warning" : "success"}>{lead.status === "pending_confirmation" ? "待转化" : "已转化"}</Badge></div><strong>{lead.project_name}</strong><p>{lead.customer_name} · {lead.product_scope}</p><div className="lead-card-facts"><b>{leadAmountText(lead)}</b><span className={`lead-grade grade-${String(lead.lead_grade ?? "unknown").toLowerCase()}`}>{lead.lead_grade ?? "待定"}级</span></div><small>场景：{SCENARIO_TYPES.find(item => item.code === scenarioCode)?.name ?? "线索待补充"} · {leadScenarioSourceText(lead)}</small></button>; })}</div>}
      {matchedLeadConversions.length > 0 && <nav className="lead-pagination" aria-label="线索分页"><span>第 {safeLeadPage} / {leadPageCount} 页 · 根据窗口高度每页 {leadPageSize} 条</span><div><button disabled={safeLeadPage <= 1} onClick={() => setLeadPage(page => Math.max(1, page - 1))}>← 上一页</button><button disabled={safeLeadPage >= leadPageCount} onClick={() => setLeadPage(page => Math.min(leadPageCount, page + 1))}>下一页 →</button></div></nav>}
    </section>
    <aside className="panel lead-detail-panel">{selectedLeadConversion ? <>
      <header className="lead-detail-head"><div><span className="eyebrow">线索来源快照</span><h2>{selectedLeadConversion.project_name}</h2><p>{selectedLeadConversion.lead_code}</p></div><Badge tone={selectedIsCompanyFixture ? "success" : "neutral"}>{selectedIsCompanyFixture ? "公司原型来源" : "接口来源"}</Badge></header>
      <div className="lead-key-metrics"><div><span>预计金额</span><strong className={selectedLeadConversion.amount_type === "unknown" ? "missing" : "amount"}>{leadAmountText(selectedLeadConversion)}</strong></div><div><span>线索等级</span><strong className={`lead-grade grade-${String(selectedLeadConversion.lead_grade ?? "unknown").toLowerCase()}`}>{selectedLeadConversion.lead_grade ?? "待定"}级</strong></div><div><span>真实性</span><strong className={["verified", "manual_confirmed"].includes(selectedLeadConversion.authenticity_status) ? "confirmed" : "attention"}>{leadAuthenticityText(selectedLeadConversion.authenticity_status)}</strong></div></div>
      <section className={`scenario-recommendation ${selectedScenarioCode ? "confidence-high" : "confidence-low"}`}><div><span>业务场景 · {selectedScenarioSource}</span><strong>{selectedScenarioName ?? "线索尚未提供"}</strong></div><p>{selectedScenarioSource === "本地测试设定" ? "当前未连接真实线索APP，本地样本按四种场景循环分配，仅用于流程测试。" : selectedScenarioCode ? "销售项目直接继承该场景，不在本系统重新推测或改写。" : "该字段是转化前置条件；请在线索APP补充后重新推送。"}</p></section>
      <dl className="lead-detail-grid"><div><dt>客户 / 最终业主</dt><dd>{selectedLeadConversion.customer_name}<small>{selectedLeadConversion.final_customer_name ?? "最终业主待确认"}</small></dd></div><div><dt>采购关系</dt><dd>{String(leadContext.requestingPartyName ?? "请求方待确认")}<small>{String(leadContext.requestingPartyRole ?? "角色待确认")} · 提交给 {String(leadContext.submissionRecipientName ?? "待确认")}</small></dd></div><div><dt>产品范围</dt><dd>{selectedLeadConversion.product_scope}<small>{selectedLeadConversion.quantity ?? "数量待确认"}</small></dd></div><div><dt>来源与真实性依据</dt><dd>{leadSourceChannelText(selectedLeadConversion.source_channel)}<small>{selectedLeadConversion.authenticity_basis ?? "依据待补充"}</small></dd></div><div><dt>客户主数据</dt><dd>{String(leadCustomerMaster.matchStatus ?? "未匹配")}<small>{String(leadCustomerMaster.code ?? "无客户编码")}</small></dd></div><div><dt>提报 / 等级规则</dt><dd>{String(leadSubmitter.name ?? "未提供")}<small>{String(leadGradeAssessment.ruleVersion ?? "规则版本未提供")}</small></dd></div></dl>
      <section className="lead-requirement-card"><header><div><span>INITIAL CUSTOMER REQUIREMENT</span><strong>线索初始需求事实</strong></div><Badge tone="info">转化后冻结只读</Badge></header><p>{String(selectedInitialRequirement.originalText ?? selectedLeadConversion.product_scope)}</p><dl><div><dt>产品需求</dt><dd>{String(selectedInitialRequirement.productRequirement ?? selectedLeadConversion.product_scope)}</dd></div><div><dt>数量</dt><dd>{String(selectedInitialRequirement.quantity ?? selectedLeadConversion.quantity ?? "待澄清")}</dd></div><div><dt>已知约束</dt><dd>{selectedRequirementConstraints.join("；") || "线索未提供"}</dd></div><div><dt>待澄清事项</dt><dd>{selectedRequirementUnknowns.join("；") || "暂无显式缺口"}</dd></div></dl><small>这是线索培育事实，不等于G3技术评审通过后的正式客户需求基线。</small></section>
      <div className="lead-candidate-summary"><div><span>客户关键角色</span><strong>{leadKeyRoles.length}人</strong></div><div><span>竞对 / 伙伴候选</span><strong>{leadCompetitors.length} / {leadPartners.length}</strong></div><div><span>跟进 / 附件</span><strong>{selectedLeadConversion.followup_snapshot?.length ?? 0} / {leadAttachments.length}</strong></div></div>
      <div className="lead-source-sections">
        <details open><summary><span>真实性与价值评级</span><small>{leadAuthenticityDimensions.length ? `${String(leadAuthenticityAssessment.totalScore)}/${String(leadAuthenticityAssessment.maxScore)}分` : "仅有汇总结论"}</small></summary><div className="lead-source-body">{leadAuthenticityDimensions.length > 0 && <div className="lead-source-table"><div className="head"><span>审核维度</span><span>结论</span><span>得分</span></div>{leadAuthenticityDimensions.map((item, index) => <div key={`auth-${index}`}><strong>{String(item.name)}</strong><span>{String(item.conclusion)}</span><b>{String(item.score)}/{String(item.maxScore)}</b></div>)}</div>}<p className="lead-source-note">{selectedLeadConversion.authenticity_basis ?? "线索未返回真实性依据"}</p>{Object.keys(leadGradeDimensions).length > 0 && <div className="lead-grade-dimensions">{Object.entries(leadGradeDimensions).map(([key, value]) => <span key={key}><small>{({ projectScale: "项目规模", industryValue: "行业价值", customerValue: "客户价值", regionValue: "区域价值", productValue: "产品价值" } as Record<string, string>)[key] ?? key}</small><strong>{String(value)}级</strong></span>)}</div>}</div></details>
        <details><summary><span>客户主体、联系人与关键角色</span><small>{leadParties.length}个主体 · {leadContacts.length}名联系人</small></summary><div className="lead-source-body">{leadParties.length > 0 && <div className="lead-source-table parties"><div className="head"><span>主体</span><span>角色</span><span>来源/状态</span></div>{leadParties.map((item, index) => <div key={`party-${index}`}><strong>{String(item.name)}</strong><span>{({ requesting_customer: "采购请求客户", end_customer: "最终客户/业主", tendering_entity: "招标单位", tender_agent: "招标代理", design_institute: "设计单位", installation_contractor: "安装单位", epc: "EPC", partner: "伙伴" } as Record<string, string>)[String(item.role)] ?? String(item.role ?? "待确认")}</span><span>{String(item.evidence ?? item.masterStatus ?? "来源未提供")}</span></div>)}</div>}{leadKeyRoles.length > 0 ? <div className="lead-source-table roles"><div className="head"><span>关键角色</span><span>态度 / 关注点</span><span>证据</span></div>{leadKeyRoles.map((item, index) => <div key={`role-${index}`}><strong>{String(item.name)}<small>{String(item.position ?? item.role ?? "角色待确认")}</small></strong><span>{String(item.attitude ?? "态度待核实")} · {String(item.concern ?? "关注点待核实")}</span><span>{String(item.evidence ?? "线索记录")}</span></div>)}</div> : <p className="lead-source-note">线索未提供可归属到该项目的客户关键角色。</p>}{leadContacts.length > 0 && <div className="lead-contact-chips">{leadContacts.map((item, index) => <span key={`contact-${index}`}><strong>{String(item.name ?? "未命名联系人")}</strong><small>{String(item.position ?? "职位待确认")} · {String(item.phone ?? "联系方式待确认")}</small></span>)}</div>}</div></details>
        <details><summary><span>竞对、伙伴与内部协同候选</span><small>均不自动转为项目正式对象</small></summary><div className="lead-source-body"><div className="lead-source-columns"><section><h4>竞对候选</h4>{leadCompetitors.length ? leadCompetitors.map((item, index) => <article key={`competitor-${index}`}><strong>{String(item.name)}</strong><p>{String(item.verification ?? "待项目继续核实")}</p><small>{String(item.source ?? "来源待确认")}</small></article>) : <p>未提供</p>}</section><section><h4>伙伴候选</h4>{leadPartners.length ? leadPartners.map((item, index) => <article key={`partner-${index}`}><strong>{String(item.name)}</strong><p>{String(item.type ?? item.role ?? "类型待确认")}</p><small>{String(item.evidence ?? "关系待验证")}</small></article>) : <p>未提供</p>}</section><section><h4>内部协同候选</h4>{leadTeamCandidates.length ? leadTeamCandidates.map((item, index) => <article key={`team-${index}`}><strong>{String(item.name)}</strong><p>{String(item.department ?? "部门待确认")} · {String(item.suggestedRole ?? item.position ?? "角色待确认")}</p><small>仅为线索团队候选，仍需主管指派和本人接受</small></article>) : <p>未提供</p>}</section></div></div></details>
        <details><summary><span>跟进历史与附件证据</span><small>{selectedLeadConversion.followup_snapshot?.length ?? 0}条 · {leadAttachments.length}个</small></summary><div className="lead-source-body">{selectedLeadConversion.followup_snapshot?.length ? <div className="lead-history">{selectedLeadConversion.followup_snapshot.map((item, index) => <div key={`followup-${index}`}><span>{String(item.occurredAt ?? "时间未提供")}<small>{String(item.method ?? "方式未提供")} · {String(item.owner ?? "跟进人未提供")}</small></span><p>{String(item.summary ?? "跟进摘要未提供")}</p></div>)}</div> : <p className="lead-source-note">该线索没有可归属的跟进记录。</p>}{leadAttachments.length ? <div className="lead-attachment-list">{leadAttachments.map((item, index) => <div key={`attachment-${index}`}><span>{String(item.type ?? "附件")}</span><strong>{String(item.name ?? item.ref ?? "附件引用")}</strong><small>{String(item.ref ?? "原件仍由线索APP保存")}</small></div>)}</div> : <p className="lead-source-note">该线索没有可归属的附件记录。</p>}</div></details>
      </div>
      <footer className="lead-detail-footer"><span>{selectedLeadConversion.followup_snapshot?.length ?? 0} 条跟进 · {leadAttachments.length} 个附件 · {new Date(selectedLeadConversion.occurred_at).toLocaleString("zh-CN")}</span><div>{selectedLeadConversion.status === "pending_confirmation" && <button className="primary" aria-expanded={leadConversionOpen} onClick={() => setLeadConversionOpen(true)}>在当前工作区开始转化 ↓</button>}{selectedLeadConversion.project_code && <button className="secondary" onClick={() => openProject(selectedLeadConversion.project_code!, "overview")}>打开销售项目 →</button>}</div></footer>
    </> : <Empty title="请选择一条线索" description="右侧会展示金额、等级、来源快照和场景判断依据。" />}</aside>
  </div>
{selectedLeadConversion?.status === "pending_confirmation" && leadConversionOpen && <section className="lead-conversion-inline" aria-label="线索转化"><header><div><span>LEAD CONVERSION</span><strong>{selectedLeadConversion.project_name}</strong><small>{selectedLeadConversion.lead_code} · {selectedScenarioName ?? "场景待补充"}</small></div><button onClick={() => setLeadConversionOpen(false)} aria-label="收起线索转化">×</button></header><div className="wizard-shell">
<aside className="wizard-steps">{[[1, "确认场景与请求"], [2, "确认机会与查重"], [3, "确认责任并转化"]].map(([step, label]) => <button key={step} disabled={Number(step) > newMaxStep} className={newStep === step ? "active" : newMaxStep > Number(step) ? "done" : ""} onClick={() => Number(step) <= newMaxStep && setNewStep(Number(step))}>
<i>{newMaxStep > Number(step) ? "✓" : step}</i>
<span>{label}</span>
</button>)}</aside>
<section className="panel wizard-panel">
      {newStep === 1 && <>
        <div className="panel-head"><div><span className="eyebrow">步骤 1 / 3</span><h2>核对业务场景与线索来源</h2></div></div>
        <div className="form-grid two">
          <Field label="业务场景" hint="由线索APP维护并带入；销售项目只读继承，缺失时返回线索补充。"><input value={SCENARIO_TYPES.find(item => item.code === newProject.scenarioCode)?.name ?? "线索未提供，暂不可转化"} disabled /></Field>
          <Field label="来源记录引用" hint="有客户文件/询价编号时引用原编号；没有时使用线索记录号，不伪造客户编号。"><input value={newProject.requestRef} onChange={(e) => { setNewProject({ ...newProject, requestRef: e.target.value }); setScenarioConfirmed(false); setDuplicateState("idle"); }} placeholder="由线索系统带入" /></Field>
          <Field label={selectedLeadConversion?.request_date ? "客户采购请求日期" : "线索收到日期"} hint={selectedLeadConversion?.request_date ? "由线索中的客户请求事实带入。" : "当前线索未提供客户请求日期，暂以收到日期留痕，不冒充客户文件日期。"}><input type="date" value={newProject.requestDate} onChange={(e) => setNewProject({ ...newProject, requestDate: e.target.value })} /></Field>
          <Field label="来源证据引用" hint="引用线索附件、客户邮件或真实性调查证据；销售项目不重复保存招标文件。"><input value={newProject.evidence} onChange={(e) => setNewProject({ ...newProject, evidence: e.target.value })} placeholder="由线索系统带入，缺失时补充权威来源" /></Field>
        </div>
        <div className="source-evidence-card"><header><div><span>线索真实性调查</span><strong>{leadAuthenticityText(selectedLeadConversion?.authenticity_status ?? "pending")}</strong></div><Badge>{selectedLeadConversion?.source_system ?? "线索APP"}</Badge></header><p>{selectedLeadConversion?.authenticity_basis ?? "线索系统尚未返回判断依据"}</p><dl><div><dt>来源线索</dt><dd>{selectedLeadConversion?.lead_code ?? "—"}</dd></div><div><dt>关联附件</dt><dd>{leadAttachments.map(item => String(item.name ?? item.ref ?? "附件引用")).join("、") || "未提供"}</dd></div><div><dt>初始需求</dt><dd>{String(selectedInitialRequirement.originalText ?? selectedLeadConversion?.product_scope ?? "未提供")}</dd></div><div><dt>待澄清</dt><dd>{selectedRequirementUnknowns.join("；") || "暂无显式缺口"}</dd></div></dl></div>
        <div className="demo-boundary">销售项目引用线索真实性结论与原始证据；正式招标文件的版本、补遗和哈希由投标管理APP维护。</div>
        <div className="form-actions"><span /><button className="primary" onClick={() => { if (!newProject.scenarioCode) return notify("线索未提供业务场景，请先在线索APP补充后重新推送"); if (!newProject.evidence || !newProject.requestRef || !newProject.requestDate) return notify("线索必须提供可追溯来源、来源日期和证据；缺失时请先在线索侧补充"); setScenarioConfirmed(true); goForward(2); }}>核对来源并继续</button></div>
      </>}
      {newStep === 2 && <><div className="panel-head"><div><span className="eyebrow">步骤 2 / 3</span><h2>确认采购机会与客户角色</h2></div></div><div className="form-grid two"><Field label="最终客户 / 业主"><input value={newProject.finalCustomer} onChange={(e) => { const finalCustomer = e.target.value; setNewProject({ ...newProject, finalCustomer, sourceCustomer: newProject.scenarioCode && isEpcScenarioCode(newProject.scenarioCode) ? newProject.sourceCustomer : finalCustomer }); setDuplicateState("idle"); }} /></Field><Field label={newProject.scenarioCode && isEpcScenarioCode(newProject.scenarioCode) ? "询价EPC/伙伴客户" : "采购请求客户"}><input value={newProject.sourceCustomer} onChange={(e) => { setNewProject({ ...newProject, sourceCustomer: e.target.value }); setDuplicateState("idle"); }} /></Field><Field label="客户工程 / 采购项目名称" hint="由线索带入；仅在来源缺失或存在冲突时修正。"><input value={newProject.procurementProjectName} onChange={(e) => { setNewProject({ ...newProject, procurementProjectName: e.target.value }); setDuplicateState("idle"); }} /></Field><Field label="招标项目编号（可缺省）" hint="客户整个采购项目的编号，不是招标文件编号或版本号。"><input value={newProject.tenderNo} onChange={(e) => { setNewProject({ ...newProject, tenderNo: e.target.value }); setDuplicateState("idle"); }} /></Field><Field label="客户标包编号（无标包可留空）" hint="仅在客户划分了可独立报价和形成结果的标包时填写。"><input value={newProject.lotNo} onChange={(e) => { setNewProject({ ...newProject, lotNo: e.target.value }); setDuplicateState("idle"); }} /></Field><Field label={`交付地点${newProject.tenderNo ? "（可后续确认）" : "（无招标编号时用于查重）"}`}><input value={newProject.deliveryLocation} onChange={(e) => { setNewProject({ ...newProject, deliveryLocation: e.target.value }); setDuplicateState("idle"); }} /></Field>{newProject.scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC" && <><Field label="项目国家"><input value={newProject.projectCountry} onChange={(e) => setNewProject({ ...newProject, projectCountry: e.target.value })} /></Field><Field label="交付国家"><input value={newProject.deliveryCountry} onChange={(e) => setNewProject({ ...newProject, deliveryCountry: e.target.value })} /></Field></>}{newProject.scenarioCode && isEpcScenarioCode(newProject.scenarioCode) && <Field label="EPC/伙伴询价批次"><input value={newProject.inquiryBatch} onChange={(e) => setNewProject({ ...newProject, inquiryBatch: e.target.value })} /></Field>}<Field label="产品范围"><input value={newProject.target} onChange={(e) => { setNewProject({ ...newProject, target: e.target.value }); setDuplicateState("idle"); }} /></Field><Field label="项目预计金额（万元）"><input type="number" value={newProject.amount} onChange={(e) => setNewProject({ ...newProject, amount: e.target.value })} /></Field><Field label={newProject.scenarioCode === "SCN-01-DIRECT-BID" ? "投标截止日期" : "客户期望报价日期"}><input type="date" value={newProject.bidDate} onChange={(e) => { setNewProject({ ...newProject, bidDate: e.target.value }); setDuplicateState("idle"); }} /></Field></div><div className={`duplicate-box ${duplicateState}`}><div><strong>服务端采购机会指纹检查</strong><p>{duplicateState === "clear" ? "指纹未命中，可创建新的SalesProject。" : duplicateState === "found" ? "指纹已命中；必须关联既有项目，EPC/伙伴场景应新增报价通路。" : "最终业主＋工程/招标项目＋标包＋产品范围；没有招标项目编号时才补充交付地点和采购时间窗。"}</p></div><button className="secondary" onClick={() => void checkDuplicate()}>执行/重新检查</button></div><div className="form-actions"><button className="secondary" onClick={() => setNewStep(1)}>上一步</button><button className="primary" onClick={() => duplicateState === "clear" ? setNewStep(3) : notify("请先完成服务端采购机会检查")}>下一步</button></div></>}
      {newStep === 3 && <><div className="panel-head"><div><span className="eyebrow">步骤 3 / 3</span><h2>确认项目责任并转化</h2></div></div><div className="form-grid two"><Field label="线索评级（只读继承）" hint="S/A/B/C来自线索APP；转化后成为销售项目等级的默认值，G1可依据事实调整。"><input value={`${newProject.leadGrade}级`} readOnly /></Field><Field label="归属组织"><select value={newProject.organization} onChange={(e) => setNewProject({ ...newProject, organization: e.target.value })}><option>杭州事业部</option><option>衢州事业部</option><option>江西事业部</option></select></Field><Field label="项目Owner" hint={manager ? "主管可代转化并分配受控目录中的销售Owner。" : "销售员只能确认分配给自己的线索。"}><select value={newProject.owner} onChange={(e) => setNewProject({ ...newProject, owner: e.target.value })}><option>陈晨</option></select></Field><Field label="推荐行动截止日期（可调整）"><input type="date" value={newProject.requirementDate} onInput={(e) => setNewProject(current => ({ ...current, requirementDate: e.currentTarget.value }))} /></Field><Field label="系统推荐首个行动（可调整或清空）" hint="根据场景和线索缺口生成，不是G1硬条件。"><input value={newProject.firstAction} onChange={(e) => setNewProject({ ...newProject, firstAction: e.target.value })} /></Field><Field label="后续专业角色"><input value="G1批准后按阶段生成专业资源需求；线索中的人员仅保留为来源候选" disabled /></Field></div><div className="review-card"><h3>转化摘要</h3><dl><div><dt>来源线索</dt><dd>{selectedLeadConversion?.lead_code ?? "—"}</dd></div><div><dt>业务场景</dt><dd>{SCENARIO_TYPES.find(item => item.code === newProject.scenarioCode)?.name}（线索带入）</dd></div><div><dt>最终客户 / 请求方</dt><dd>{newProject.finalCustomer} / {newProject.sourceCustomer}</dd></div><div><dt>项目 / 产品</dt><dd>{newProject.procurementProjectName} / {newProject.target}</dd></div><div><dt>线索初始需求</dt><dd>{String(selectedInitialRequirement.originalText ?? selectedLeadConversion?.product_scope ?? "未提供")}</dd></div><div><dt>待澄清事项</dt><dd>{selectedRequirementUnknowns.join("；") || "暂无显式缺口"}</dd></div><div><dt>线索评级 / 组织 / Owner</dt><dd>{newProject.leadGrade}级 / {newProject.organization} / {newProject.owner}</dd></div><div><dt>销售项目等级</dt><dd>默认继承{newProject.leadGrade}级；G1主管可依据冻结事实调整</dd></div><div><dt>机会指纹</dt><dd><Badge>{duplicateState === "clear" ? "服务端已通过" : "未通过"}</Badge></dd></div></dl></div><div className="demo-boundary">保存草稿会冻结线索初始需求快照，但不会把它冒充为正式客户需求基线。竞对、客户侧关键角色、伙伴及内部建议负责人均保留为来源候选，不自动成为项目正式责任人。</div><div className="form-actions"><button className="secondary" onClick={() => setNewStep(2)}>上一步</button><button className="secondary" onClick={() => void createProject(false)} disabled={flowBusy}>{flowBusy ? "正在写入D1…" : manager ? "主管代建并保存S0草稿" : "保存S0草稿"}</button>{!manager && <button className="primary" onClick={() => void createProject(true)} disabled={flowBusy}>{flowBusy ? "正在写入D1…" : "保存并提交G1审批"}</button>}</div></>}
      </section></div></section>}
</section></>;
  };

  const renderStageRail = () => {
    const activeIndex = stageDefinitions.findIndex((item) => item.code === selected.stage);
    return <div className="stage-rail">{stageDefinitions.map((stage, index) => <button key={stage.code} className={`stage-${stage.code.toLowerCase()} ${index < activeIndex ? "complete" : ""} ${index === activeIndex ? "current" : ""}`} onClick={() => notify(`${stage.code} ${stage.name}：${stage.output}`)}><i>{index < activeIndex ? "✓" : stage.code}</i><span>{stage.name}</span></button>)}</div>;
  };

  const renderOverview = () => <div className="detail-grid"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">当前阶段</span><h2>{selected.stage} {selected.stageName}</h2></div><button className="secondary" onClick={() => setDetailTab("gate")}>查看阶段门 →</button></div><div className="stage-brief"><div><span>进入条件</span><strong>{selected.stage === "S4" ? "核价方案已批准" : selected.stage === "S3" ? "需求基线可核价" : "上一阶段批准完成"}</strong></div><div><span>核心输出</span><strong>{stageMap[selected.stage]?.output}</strong></div><div><span>Owner / 审批人</span><strong>{selected.owner} / {selected.approver}</strong></div><div><span>能否推进</span><Badge>{getGateConditions(selected).some((item) => item.hard && !item.ok) ? "存在阻断" : "允许推进"}</Badge></div></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">健康度</span><h2>当前阶段三角评估</h2></div></div><div className="health-stack"><Progress value={selected.health.relationship} label="客户关系" /><Progress value={selected.health.resource} label="关键资源" /><Progress value={selected.health.operation} label="项目运作" /></div><p className="rule-note">任一维度低于 60，项目进入重大运作风险。</p></section><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">主动运作</span><h2>当前缺口 → 动作 → 责任 → 证据</h2></div></div><div className="closure-table"><div className="closure-head"><span>当前缺口</span><span>计划动作</span><span>责任与期限</span><span>结果证据</span></div>{selected.risks.slice(0, 3).map((risk, index) => { const action = selected.actions[index]; return <div key={risk.id}><span><Badge>{risk.level}</Badge><strong>{risk.title}</strong></span><span>{action?.title ?? "尚未形成行动"}</span><span>{action ? `${action.owner} · ${action.due}` : `${risk.owner} · ${risk.due}`}</span><span>{action?.evidence || risk.evidence}</span></div>; })}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">赢单判断</span><h2>策略与竞争</h2></div></div><div className="strategy-block"><span>赢单策略</span><p>{selected.strategy}</p><span>竞争态势</span><p>{selected.competition}</p><span>赢单概率</span><div className="probability"><i style={{ width: `${selected.probability}%` }} /><strong>{selected.probability}%</strong></div></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">下一步</span><h2>首要行动</h2></div></div><div className="next-action"><span>01</span><strong>{selected.nextStep}</strong><small>责任人：{selected.owner}</small><button className="secondary" onClick={() => setDetailTab("actions")}>进入行动计划</button></div></section><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">投标协同</span><h2>外部投标管理APP引用</h2></div><Badge>{selected.externalBid.status}</Badge></div><div className="external-ref"><div><span>协同任务</span><strong>{selected.externalBid.id}</strong></div><div><span>负责人</span><strong>{selected.externalBid.owner}</strong></div><div><span>最近同步</span><strong>{selected.externalBid.updatedAt}</strong></div><div><span>正式提交哈希</span><strong>{selected.externalBid.submissionHash}</strong></div><button className="secondary" onClick={() => notify("演示边界：这里将跳转投标管理APP；本Demo不展开标书文件编制作业")}>打开投标管理APP ↗</button></div></section></div>;

  const renderRelations = () => {
    const layers: Relationship["layer"][] = ["客户高层", "商务决策链", "技术层"];
    return <><div className="section-actions"><div><span className="eyebrow">客户关系地图</span><h2>决策链覆盖与关系证据</h2><p>态度和影响力必须有证据，覆盖人员对关系推进负责。</p></div><button className="primary" onClick={() => setRelationOpen(true)}>＋ 新增关系记录</button></div><div className="relation-gap"><strong>关系缺口检查</strong><div>{layers.map((layer) => { const covered = selected.relationships.some((item) => item.layer === layer); return <span key={layer} className={covered ? "ok" : "gap"}>{covered ? "✓" : "!"} {layer}：{covered ? "已覆盖" : "未覆盖"}</span>; })}</div></div><div className="relation-columns">{layers.map((layer) => <section className="relation-column" key={layer}><div className="relation-column-head"><span>{layer === "客户高层" ? "60%" : "20%"}</span><h3>{layer}</h3><small>{layer === "客户高层" ? "战略支持与资源决策" : layer === "商务决策链" ? "采购、价格与最终评标" : "参数、方案与技术评分"}</small></div>{selected.relationships.filter((item) => item.layer === layer).map((relation) => <article className="contact-card" key={relation.id}><div className="avatar">{relation.name.slice(-1)}</div><div className="contact-main"><div><strong>{relation.name}</strong><Badge>{relation.attitude}</Badge></div><p>{relation.title} · 影响力{relation.influence}</p><dl><div><dt>覆盖负责人</dt><dd>{relation.owner}</dd></div><div><dt>最近接触</dt><dd>{relation.lastTouch}</dd></div></dl><div className="evidence"><span>证据</span>{relation.evidence}</div></div></article>)}{!selected.relationships.some((item) => item.layer === layer) && <Empty title="尚未覆盖" description="新增有证据的客户关系，补齐当前阶段缺口。" />}</section>)}</div></>;
  };

  const renderResources = () => <><div className="section-actions"><div><span className="eyebrow">伙伴与资源准备</span><h2>指派不等于到位</h2><p>只有负责人接受项目责任并有有效期记录，才视为资源已到位。</p></div><button className="secondary" onClick={() => notify(manager ? "资源协调任务已生成并模拟下发" : "资源申请已提交给销售主管")}>{manager ? "发起资源协调" : "申请关键资源"}</button></div><div className="resource-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">内部资源</span><h2>当前阶段必需角色</h2></div><span>{selected.resources.filter((item) => item.status === "已到位").length}/{selected.resources.length} 已到位</span></div><div className="resource-cards">{selected.resources.map((resource) => <article key={resource.id} className={resource.status === "缺失" ? "resource-card missing" : "resource-card"}><div><span className="resource-icon">{resource.status === "已到位" ? "✓" : "!"}</span><div><strong>{resource.role}</strong><small>{resource.required ? "当前阶段必需" : "按需"}</small></div></div><h3>{resource.person}</h3><div><Badge>{resource.status}</Badge><span>要求到位 {resource.due}</span></div>{manager && resource.status !== "已到位" && <button onClick={() => { updateProject(selected.id, (project) => ({ ...project, resources: project.resources.map((item) => item.id === resource.id ? { ...item, person: resource.role === "技术负责人" ? "赵工" : item.person, status: "已到位" } : item), health: { ...project.health, resource: Math.min(100, project.health.resource + 25) } })); notify(`${resource.role}已模拟到位，阶段门已更新`); }}>模拟指派并接受</button>}</article>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">合作伙伴</span><h2>{selected.partner.needed ? "需要伙伴" : "本项目不需要伙伴"}</h2></div><Badge>{selected.partner.match}</Badge></div>{selected.partner.needed ? <div className="partner-card"><div><span>伙伴类型</span><strong>{selected.partner.type}</strong></div><div><span>候选伙伴</span><strong>{selected.partner.name}</strong></div><div><span>匹配 / 认证</span><strong>{selected.partner.match} · {selected.partner.certification}</strong></div><div><span>关系证据</span><p>{selected.partner.evidence}</p></div><div><span>实际贡献</span><p>{selected.partner.contribution}</p></div>{selected.partner.match !== "已验证" && <button className="secondary" onClick={() => notify("已生成伙伴关系验证任务；自述认识客户不能视为到位")}>发起关系验证</button>}</div> : <div className="partner-card"><p>直销项目，客户采购主体和内部资源明确。伙伴不作为本阶段必需条件。</p></div>}</section></div></>;

  const renderResourceCapacity = () => <>
    <div className="section-actions"><div><span className="eyebrow">伙伴与资源准备</span><h2>需求、候选、指派与责任接受</h2><p>四类事实分开留痕：需求不等于候选、候选不等于指派、指派不等于本人已接受。专业角色只读引用权威作业任务。</p></div>{selected.result !== "pending" ? <Badge>结果形成，资源事实只读</Badge> : manager ? <Badge>{selected.resourceRequests?.filter(item => item.status === "待指派").length ?? 0}项待指派</Badge> : <button className="secondary" onClick={() => setResourceRequestOpen(true)}>补充资源需求</button>}</div>
    <div className="resource-layout resource-layout-single"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">内部与专业角色</span><h2>角色责任状态</h2></div><span>{selected.resources.filter(item => item.status === "已到位").length}/{selected.resources.length} 已接受</span></div>
      <div className="resource-cards capacity">{selected.resources.map(resource => {
        const candidates = (selected.resourceCandidates ?? []).filter(candidate => candidate.role === resource.role && ["候选", "已选定"].includes(candidate.status));
        const externallyProjected = resource.dataSource?.includes("外部任务");
        return <article key={resource.id} className={resource.status === "缺失" ? "resource-card missing" : resource.load && resource.load >= 85 ? "resource-card overloaded" : "resource-card"}>
          <header><span className="resource-icon">{resource.status === "已到位" ? "✓" : "!"}</span><div><strong>{resource.role}</strong><small>{resource.required ? "当前阶段必需" : "按需/只读协同"}</small></div><Badge>{resource.status}</Badge></header>
          <h3>{resource.person}</h3>
          {resource.role === "技术负责人" && <p className="resource-role-boundary"><strong>当前责任边界：</strong>形成需求标准化、技术方案、设计BOM、澄清与偏差专业成果；G3由独立技术评审人评审。下方资源申请原文按审计要求保留，不用旧表述覆盖历史记录。</p>}
          <div className="resource-load"><span>人员负荷</span><strong>{resource.person === "待指派" ? "待匹配" : resource.load === undefined ? "未接企业资源池" : `${resource.load}%`}</strong>{resource.load !== undefined && <><i><em style={{ width: `${resource.load}%` }} /></i><small>{resource.activeProjects ?? 0}个在管项目 · {resource.availableFrom}</small></>}</div>
            {candidates.length > 0 && <div className="resource-candidate-list"><span>候选池</span>{candidates.map(candidate => <div key={candidate.id}><div><strong>{candidate.name}</strong><small>{candidate.capabilities.join(" / ")} · {candidate.load === undefined ? "负荷未接入" : `负荷${candidate.load}%`} · {candidate.status}</small></div>{selected.result === "pending" && manager && resource.status !== "已到位" && <button disabled={flowBusy || candidate.status === "已选定"} onClick={() => void saveResourceAssignment(resource, candidate)}>{candidate.status === "已选定" ? "已确认" : "确认指派"}</button>}</div>)}</div>}
          <footer><small>{resource.dataSource ?? (externallyProjected ? "外部作业任务投影" : "尚无角色指派记录")}</small>{selected.result === "pending" && manager && resource.status !== "已到位" && !externallyProjected && <button className="secondary" onClick={() => setResourceCandidateTarget(resource)}>＋ 登记候选</button>}</footer>
        </article>;
      })}</div>
      {selected.resourceRequests && selected.resourceRequests.length > 0 && <div className="risk-list resource-request-history"><h3>资源需求记录（申请原文）</h3>{selected.resourceRequests.map(request => <article key={request.id}><Badge>{request.status}</Badge><div><strong>{request.role}</strong><p>{request.requirement}</p>{request.role === "技术负责人" && <small>当前职责边界已同步到上方角色卡；申请原文作为审计记录保留，G3评审权属于独立技术评审人。</small>}<small>申请依据：{request.evidence}</small></div><div><span>要求到位</span><small>{request.requiredBy}</small></div></article>)}</div>}
    </section></div>
    {(selected.sourceLineage?.candidateFacts?.partners.length ?? 0) > 0 && <section className="panel"><div className="panel-head"><div><span className="eyebrow">LEAD CANDIDATES · READ ONLY</span><h2>线索伙伴候选</h2></div><Badge>不计入伙伴准备度</Badge></div><div className="resource-cards">{selected.sourceLineage!.candidateFacts!.partners.map((item, index) => <article className="resource-card" key={`lead-partner-${index}`}><header><span className="resource-icon">?</span><div><strong>{String(item.name ?? "未命名伙伴")}</strong><small>{String(item.type ?? item.role ?? "类型待确认")}</small></div><Badge>待判断/待验证</Badge></header><p>{String(item.evidence ?? "线索未提供验证证据")}</p></article>)}</div><p className="rule-note">先判断项目是否需要伙伴，再登记和验证候选；线索推荐不会自动形成伙伴指派。</p></section>}
  </>;

  const renderActions = () => <><div className="section-actions"><div><span className="eyebrow">活动与行动计划</span><h2>客户经营、风险处置与主管督办</h2><p>系统流程任务由阶段和Gate自动生成；这里仅记录有明确业务目的、责任人、期限和证据要求的经营行动或督办。</p></div><div><button className="secondary" onClick={() => setRiskOpen(true)}>＋ 登记风险</button><button className="primary" onClick={() => { setActionSeed(""); setActionOpen(true); }}>{manager ? "＋ 发起主管督办" : "＋ 记录客户经营行动"}</button></div></div><section className="panel"><div className="panel-head"><div><span className="eyebrow">风险台账</span><h2>开放风险与处理闭环</h2></div><Badge>{selected.riskLevel}</Badge></div>{selected.risks.length === 0 ? <Empty title="尚无已登记风险" description="这表示尚未形成风险台账，不等于项目已被证明为低风险。" /> : <div className="risk-list">{selected.risks.map((risk) => <article key={risk.id}><Badge>{risk.level}</Badge><div><strong>{risk.title}</strong><p>{risk.category} · {risk.description ?? "未提供风险事实"} · 证据：{risk.evidence}</p></div><div><span>{risk.owner}</span><small>{risk.due}</small></div><Badge>{risk.status}</Badge>{risk.status === "开放" && <button className="secondary compact" disabled={manager} onClick={() => { setActionSeed(risk.title); setActionOpen(true); }}>转为行动</button>}{risk.status !== "已关闭" && <button className="secondary compact" disabled={manager} onClick={() => setRiskCloseTarget(risk)}>关闭风险</button>}</article>)}</div>}</section><section className="panel table-wrap"><div className="panel-head"><div><span className="eyebrow">行动计划</span><h2>活动执行与证据</h2></div></div><table><thead><tr><th>行动</th><th>目的</th><th>负责人</th><th>截止</th><th>状态</th><th>结论 / 证据</th></tr></thead><tbody>{selected.actions.map((action) => <tr key={action.id}><td><strong>{action.title}</strong><small>{action.type} · {action.id}</small></td><td>{action.purpose}</td><td>{action.owner}</td><td className={action.status === "已延期" ? "danger-text" : ""}>{action.due}</td><td><Badge>{action.status}</Badge></td><td><strong>{action.result}</strong><small>{action.evidence}</small></td></tr>)}</tbody></table></section></>;

  const renderPartnerGovernance = () => <section className="panel partner-governance"><div className="panel-head"><div><span className="eyebrow">伙伴事实治理</span><h2>{selected.partner.decisionStatus === "未判断" || !selected.partner.decisionStatus ? "尚未判断是否需要伙伴" : selected.partner.decisionStatus === "不需要" ? "已判断不需要伙伴" : selected.partner.name === "—" ? "需要伙伴，尚未登记候选" : selected.partner.name}</h2></div><Badge>{selected.partner.verificationStatus === "verification_pending" ? "待主管复核" : selected.partner.verificationStatus === "verified" ? "证据已核验" : selected.partner.decisionStatus ?? "未判断"}</Badge></div><div className="demo-boundary"><strong>对象边界：</strong>最终客户、EPC询价方和潜在合同客户是 Party 角色，不是经营伙伴。伙伴需要性、候选关系、证据复核和实际贡献分别留痕；伙伴未验证不会自动阻断 Gate。</div><div className="partner-card"><div><span>需要性判断</span><strong>{selected.partner.decisionStatus ?? "未判断"}</strong></div><div><span>伙伴类型 / 名称</span><strong>{selected.partner.type} · {selected.partner.name}</strong></div><div><span>验证状态</span><strong>{selected.partner.verificationStatus ?? "尚无候选"}</strong></div><div><span>判断或验证证据</span><p>{selected.partner.evidence}</p></div><div><span>实际贡献</span><p>{selected.partner.contribution}</p></div></div>{selected.persisted && selected.result === "pending" && <div className="button-row">{!manager && !selected.partner.engagementId && <button className="secondary" onClick={() => setPartnerActionOpen("need")}>{selected.partner.decisionStatus ? "调整需要性判断" : "判断是否需要伙伴"}</button>}{!manager && selected.partner.decisionStatus === "需要" && !selected.partner.engagementId && <button className="primary" onClick={() => setPartnerActionOpen("register")}>登记候选伙伴</button>}{manager && selected.partner.verificationStatus === "verification_pending" && <button className="primary" onClick={() => setPartnerActionOpen("verify")}>复核伙伴关系证据</button>}{!manager && selected.partner.engagementId && selected.partner.verificationStatus !== "rejected" && <button className="secondary" onClick={() => setPartnerActionOpen("contribution")}>记录实际贡献</button>}</div>}{selected.persisted && selected.result !== "pending" && <div className="rule-note">商业结果已形成，伙伴判断、验证与贡献事实只读；后续责任在S6遗留责任流程中登记。</div>}</section>;

  const renderPartnerModal = () => partnerActionOpen ? <Modal title={partnerActionOpen === "need" ? "伙伴需要性判断" : partnerActionOpen === "register" ? "登记候选伙伴" : partnerActionOpen === "verify" ? "复核伙伴关系证据" : "记录伙伴实际贡献"} onClose={() => setPartnerActionOpen(null)}><form onSubmit={submitPartnerAction} className="modal-form"><div className="demo-boundary">客户或EPC不能作为伙伴重复登记；所有结论必须引用可追溯事实，不以伙伴自述替代客户侧或项目侧证据。</div>{partnerActionOpen === "need" && <><Field label="需要性结论"><select name="decision" defaultValue={selected.partner.decisionStatus === "不需要" ? "not_needed" : "needed"}><option value="needed">需要伙伴</option><option value="not_needed">不需要伙伴</option></select></Field><Field label="判断原因"><textarea name="reason" required placeholder="说明客户、地域、服务、资质或项目运作事实为何需要/不需要伙伴" /></Field><Field label="判断证据"><input name="evidenceRef" required placeholder="客户要求、项目策略记录或其他证据编号" /></Field></>}{partnerActionOpen === "register" && <><Field label="伙伴名称"><input name="partnerName" required /></Field><Field label="伙伴类型"><input name="partnerType" required placeholder="如：属地服务伙伴、认证伙伴" /></Field><Field label="关系验证证据"><textarea name="verificationEvidenceRef" required placeholder="客户确认、合同附件、历史合作记录等；伙伴自述不能直接通过" /></Field></>}{partnerActionOpen === "verify" && <><Field label="候选伙伴"><input value={selected.partner.name} readOnly /></Field><Field label="复核结论"><select name="decision"><option value="verified">证据有效</option><option value="rejected">证据不足/关系无效</option></select></Field><Field label="主管复核意见"><textarea name="comment" required /></Field><Field label="复核依据"><input name="evidenceRef" required /></Field></>}{partnerActionOpen === "contribution" && <><Field label="伙伴"><input value={selected.partner.name} readOnly /></Field><Field label="贡献类型"><input name="contributionType" required placeholder="如：现场窗口协调、技术接口澄清" /></Field><Field label="实际结果"><textarea name="result" required placeholder="记录已经发生的结果，不写计划或宣传语" /></Field><div className="form-grid two"><Field label="发生时间"><input name="occurredAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></Field><Field label="贡献证据"><input name="evidenceRef" required /></Field></div></>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setPartnerActionOpen(null)}>取消</button><button className="primary" disabled={flowBusy}>保存并留痕</button></div></form></Modal> : null;

  const renderVersions = () => {
    const order = ["客户需求", "技术方案", "核价方案", "投标方案"];
    const currentVersions = order.map((kind) => selected.versions.filter((item) => item.kind === kind).at(-1)).filter(Boolean) as ArtifactVersion[];
    return <><div className="section-actions"><div><span className="eyebrow">标的物版本主线</span><h2>客户要什么 → 按什么<Term>核价</Term> → 最终承诺什么</h2><p>一致性不要求文档完全相同，而要求<Term>偏差</Term>可识别、评估、审批和追溯。</p></div><div className="button-row">{selected.id === "QJ-2026-0819" && <button className="secondary" onClick={simulateChange}>模拟再次需求变更</button>}<button className="primary" onClick={trySubmit}>模拟正式提交</button></div></div><div className="version-chain">{currentVersions.map((version, index) => <div className={`version-node ${statusTone(version.status)}`} key={version.id}><div className="node-index">0{index + 1}</div><span>{version.kind}</span><strong>{version.version}</strong><Badge>{version.status}</Badge><small>{version.id}</small>{index < currentVersions.length - 1 && <i className="chain-arrow">→</i>}</div>)}<div className="version-node baseline-node"><div className="node-index">05</div><span>中标<Term>基线</Term></span><strong>{selected.baseline?.id ?? "待生成"}</strong><Badge>{selected.baseline ? "已固化" : "未形成"}</Badge><small>{selected.baseline?.contractRef ?? "合同/订单待引用"}</small></div></div><div className="version-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">追溯矩阵</span><h2>当前生效链与一致性</h2></div><Badge>{selected.versions.some((item) => item.status === "需要重新评审") ? "需要重新评审" : selected.deviations.some((item) => item.status === "待审批") ? "存在未批准偏差" : "一致或偏差已授权"}</Badge></div><div className="trace-matrix"><div className="trace-head"><span>比较项</span><span>客户需求</span><span>技术方案</span><span>核价方案</span><span>投标方案</span><span>结论</span></div>{[["型号与范围", "主变+成套", "逐项覆盖", "成本已计入", "正式响应", "一致"], ["数量", "1批", "配置清单", "完整计价", "完整报价", "一致"], ["交付周期", "150天", "技术可行", "储备165天", "承诺165天", selected.deviations.some((item) => item.status === "待审批") ? "待授权" : "已授权"], ["需求变更", `第${selected.changeCount}次`, "影响检查", "影响检查", "影响检查", selected.versions.some((item) => item.status === "需要重新评审") ? "需重评" : "已关闭"]].map((row) => <div key={row[0]}>{row.map((cell, i) => <span key={i}>{i === 5 ? <Badge>{cell}</Badge> : cell}</span>)}</div>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">偏差清单</span><h2>{selected.deviations.length} 项偏差</h2></div></div>{selected.deviations.length ? <div className="deviation-list">{selected.deviations.map((deviation) => <article key={deviation.id}><div><strong>{deviation.id} · {deviation.field}</strong><Badge>{deviation.status}</Badge></div><p><span>需求</span>{deviation.requirement}</p><p><span>方案</span>{deviation.proposal}</p><p><span>影响</span>{deviation.impact}</p><small>审批人：{deviation.approver}</small>{deviation.status === "待审批" && <button className="primary compact" onClick={() => approveDeviation(deviation.id)}>{manager ? "批准偏差" : "查看审批要求"}</button>}</article>)}</div> : <Empty title="无开放偏差" description="当前版本之间未发现需要授权的差异。" />}</section><section className="panel span-3"><div className="panel-head"><div><span className="eyebrow">版本时间线</span><h2>历史版本不可覆盖</h2></div></div><div className="timeline">{[...selected.versions].reverse().map((version) => <article key={version.id}><i /><div><div><strong>{version.kind} {version.version}</strong><Badge>{version.status}</Badge>{version.immutable && <Badge tone="neutral">已锁定</Badge>}</div><p>{version.summary}</p><small>{version.createdAt} · 创建：{version.creator} · 批准：{version.approver}</small><span>上游来源：{version.basedOn}</span></div></article>)}</div></section></div></>;
  };

  const renderGate = () => {
    const conditions = getGateConditions(selected, selectedG2Input);
    const blockers = conditions.filter((item) => !item.ok);
    return <><div className="section-actions"><div><span className="eyebrow"><Term>阶段门</Term>检查</span><h2>{selected.stage} {selected.stageName} → 下一阶段</h2><p>阶段是管理标签；检查当前阶段输出、任务、风险、负责人和批准责任。</p></div><Badge>{blockers.length ? `${blockers.length}项未满足` : "全部满足"}</Badge></div><div className="gate-layout"><section className="panel span-2"><div className="gate-summary"><div><span>进入条件</span><strong>{selected.stage === "S4" ? "核价评审已通过" : "上一阶段批准完成"}</strong></div><div><span>核心输出</span><strong>{stageMap[selected.stage]?.output}</strong></div><div><span>审批人</span><strong>{selected.approver}</strong></div><div><span>推进结论</span><Badge>{blockers.some((item) => item.hard) ? "禁止推进" : blockers.length ? "可申请例外" : "允许推进"}</Badge></div></div><div className="condition-list">{conditions.map((condition) => <article key={condition.label} className={condition.ok ? "ok" : "blocked"}><i>{condition.ok ? "✓" : "!"}</i><div><strong>{condition.label}</strong><small>{condition.hard ? "硬校验" : "管理要求"} · 责任人：{condition.owner}</small></div><Badge>{condition.ok ? "已满足" : "未满足"}</Badge></article>)}</div><div className="gate-actions"><button className="secondary" onClick={() => notify(manager ? "项目已模拟退回当前阶段Owner补充材料" : "已查看退回条件")}>退回补充</button><button className="secondary" onClick={() => notify("例外审批申请已生成；Demo不执行真实审批流")}>申请例外</button><button className="danger-button" onClick={() => notify("终止操作需要原因和主管确认；Demo未改变项目状态")}>终止项目</button><button className="primary" onClick={advanceStage}>{manager ? "批准推进下一阶段" : "提交主管审批"}</button></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">阶段责任</span><h2>未完成任务与风险</h2></div></div><div className="gate-side"><div><span>未完成任务</span><strong>{selected.actions.filter((item) => item.status !== "已完成").length}</strong></div><div><span>开放风险</span><strong>{selected.risks.filter((item) => item.status !== "已关闭").length}</strong></div><div><span>阻断偏差</span><strong>{selected.deviations.filter((item) => item.status === "待审批").length}</strong></div></div><div className="decision-note"><strong>主管检查建议</strong><p>{blockers.length ? `先关闭“${blockers[0].label}”等缺口，再决定阶段推进。` : "当前硬条件已满足，可结合商业判断批准推进。"}</p></div></section></div></>;
  };

  const renderResult = () => <><div className="section-actions"><div><span className="eyebrow">结果与移交</span><h2>结果事实与行政关闭分离</h2><p>中标形成可追溯基线；丢标须完成结构化复盘后才能关闭。</p></div>{selected.id === "QJ-2026-0820" && selected.result !== "pending" && <button className="secondary" onClick={resetResult}>重置当前项目结果</button>}</div>{selected.stage !== "S5" && selected.stage !== "S6" && <section className="panel"><Empty title="尚未进入结果阶段" description="完成正式投标提交并获得客户回执后，才进入结果与移交。" /></section>}{(selected.stage === "S5" || selected.stage === "S6") && <div className="result-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">客户结果</span><h2>{selected.result === "pending" ? "等待正式结果" : selected.result === "won" ? "项目中标" : "项目丢标"}</h2></div><Badge>{selected.result === "pending" ? "待确认" : selected.result === "won" ? "中标" : "丢标"}</Badge></div>{selected.result === "pending" && <div className="result-choice"><div><strong>正式提交已固化</strong><p>{selected.externalBid.receipt}</p></div><p>请选择一个分支完成演示。结果由销售主管确认；销售员可跟踪但不能替代审批。</p><div><button className="win-button" onClick={simulateWin}>✓ 模拟项目中标</button><button className="lose-button" onClick={() => manager ? setLostOpen(true) : notify("请切换为销售主管填写丢标结果")}>× 模拟项目丢标</button></div></div>}{selected.result === "won" && selected.baseline && <div className="baseline-package"><div className="baseline-stamp">WIN</div><h3>中标移交基线包</h3><p>基线一经生成不可覆盖；后续变更需创建新版本并重新审批。</p><dl><div><dt>基线编号</dt><dd>{selected.baseline.id}</dd></div><div><dt>客户需求</dt><dd>{selected.baseline.requirementId}</dd></div><div><dt>技术方案</dt><dd>{selected.baseline.technicalId}</dd></div><div><dt>核价方案</dt><dd>{selected.baseline.costingId}</dd></div><div><dt>投标方案</dt><dd>{selected.baseline.bidId}</dd></div><div><dt>批准人 / 时间</dt><dd>{selected.baseline.approver} · {selected.baseline.createdAt}</dd></div></dl></div>}{selected.result === "lost" && selected.lostReview && <div className="lost-review"><h3>结构化丢标复盘</h3><dl><div><dt>主要原因</dt><dd>{selected.lostReview.reason}</dd></div><div><dt>竞争对手</dt><dd>{selected.lostReview.competitor}</dd></div><div><dt>关键差距</dt><dd>{selected.lostReview.gap}</dd></div><div><dt>结果证据</dt><dd>{selected.lostReview.evidence}</dd></div><div><dt>改进行动</dt><dd>{selected.lostReview.improvement}</dd></div></dl></div>}</section><section className="panel"><div className="panel-head"><div><span className="eyebrow">下游系统</span><h2>只读跟踪</h2></div></div>{selected.baseline ? <div className="downstream"><article><i>✓</i><div><strong>合同APP已接收</strong><small>{selected.baseline.contractRef}</small></div><Badge>{selected.baseline.transferStatus}</Badge></article><article><i>○</i><div><strong>订单状态</strong><small>等待合同生效后创建</small></div><Badge>只读</Badge></article><article><i>○</i><div><strong>交付与验收</strong><small>尚未开始</small></div><Badge>只读</Badge></article><article><i>○</i><div><strong>开票与回款</strong><small>尚无财务事实</small></div><Badge>只读</Badge></article></div> : <Empty title="尚无中标基线" description="只有批准的中标版本组合才能传递到合同APP。" />}</section></div>}</>;

  const simulateWin = () => notify("旧版内存结果模拟已停用；真实项目必须接收L2.9结果事实并通过G6。");
  // 保留旧版渲染器作为V0.1回退基线；当前界面统一使用下方新版工作区。
  void renderOverview; void renderRelations; void renderActions; void renderVersions; void renderGate; void renderResult;

  const renderModernOverview = () => <OverviewWorkspace project={selected} manager={manager} gateStatus={selectedGate?.code === "G5" ? selectedGate.status : undefined} onTab={setDetailTab} onAction={() => { setActionSeed(""); setActionOpen(true); }} onAddEpcRoute={() => setEpcRouteOpen(true)} onWithdrawEpcRoute={setEpcWithdrawRoute} onRequestPriceException={setEpcExceptionRoute} onRequestG5Reopen={(changeType, route) => setG5ReopenDraft({ changeType, route })} onDecideG5Reopen={(request, action) => setG5ReopenDecision({ request, action })} />;
  const renderModernRelations = () => <RelationsWorkspace project={selected} manager={manager} onAdd={(layer) => { if (manager) { notify("客户关系事实由销售员维护；主管可以提出缺口和发起督办"); return; } setRelationLayer(layer ?? "商务决策链"); setRelationOpen(true); }} onRiskAction={(title) => { setActionSeed(title); setActionOpen(true); }} />;
  const renderModernStrategy = () => <StrategyWorkspace project={selected} manager={manager} onAction={(title) => { if (manager) { notify(`已生成策略督办：${title}`); return; } setActionSeed(title); setActionOpen(true); }} onStrategyAction={handleStrategyAction} onAddCompetitor={() => setCompetitorOpen(true)} onSaveG2Strategy={(input) => void saveG2Strategy(input)} onNotify={notify} />;
  const renderModernActions = () => <ActionsWorkspace project={selected} manager={manager} focusActivityId={entryContext?.activityId} onAdd={() => { setActionSeed(""); setActionOpen(true); }} onRisk={(title) => { setActionSeed(title); setActionOpen(true); }} onAddMilestone={() => setMilestoneOpen(true)} onOpenResources={() => setDetailTab("resources")} onUpdateActivity={openActivityCommand} />;
  const renderModernVersions = () => <VersionsWorkspace project={selected} manager={manager} onChange={simulateChange} onSubmit={trySubmit} onApprove={approveDeviation} onSaveRequirement={(input) => void saveRequirementSource(input).then(() => notify("需求澄清包已保存为不可变新版本；正式需求基线仍须由专业作业形成")).catch(error => notify(error instanceof Error ? error.message : "需求澄清包保存失败"))} onNotify={notify} />;
  const renderModernGate = () => <GateWorkspace project={selected} manager={manager} conditions={getGateConditions(selected, selectedG2Input)} onAdvance={() => manager ? selected.stage === "S5" ? setG6DecisionOpen(true) : void advanceStage() : selected.stage === "S0" && !selectedGate ? void submitG1Draft() : selected.stage === "S0" && selectedGate?.status === "returned" ? void resubmitG1() : notify("请按当前阶段门要求补齐事实并提交")} onSubmitG2={() => void submitG2Preparation()} onNavigateG2Source={(tab) => setDetailTab(tab)} onNavigateS2Source={() => setDetailTab("versions")} onSubmitS2={() => void submitS2StageExit()} onRequestCosting={() => setCostingRequestOpen(true)} onSubmitS3={() => void submitS3StageExit()} onSubmitS4={() => void submitS4StageExit()} onSubmitG6={(remediation) => void submitG6(remediation)} gateStatus={selectedGate?.status} gateComment={selectedGate?.comment} g2Readiness={selected.g2Readiness} s2Readiness={selected.s2Readiness} s3Readiness={selected.s3Readiness} g5Readiness={selected.g5Readiness} g6Readiness={selected.g6Readiness} />;
  const renderModernResult = () => <ResultWorkspace project={selected} manager={manager} gateStatus={selectedGate?.code === "G6" ? selectedGate.status : undefined} gateExecutionStatus={selectedGate?.code === "G6" ? selectedGate.executionStatus : undefined} onPrepareReview={() => setLostOpen(true)} onOpenGate={() => setDetailTab("gate")} onRequestResultCorrection={(routeResultId, reason, evidenceRef) => void requestResultCorrection(routeResultId, reason, evidenceRef)} onAddPostAwardResponsibility={() => { setActionSeed(""); setActionContext("post_award_responsibility"); setActionOpen(true); }} onManagePostAwardResponsibilities={() => setDetailTab("actions")} onReset={resetResult} onNotify={notify} />;

  const renderDetail = () => <>{entryContext && <section className="decision-context-banner"><div><span>{entryContext.source}</span><strong>正在处理：{entryContext.title}</strong><p>{entryContext.summary}</p></div><div><Badge>已定位到相关工作区</Badge><button className="secondary" onClick={() => { const target = entryContext.returnView ?? "dashboard"; setEntryContext(null); openWorkspace(target); }}>返回{entryContext.source}</button><button className="primary" onClick={() => notify("请在当前高亮工作区核对事实并执行允许的操作")}>开始处理 ↓</button></div></section>}<div className="project-hero"><button className="back-button" onClick={() => setView("projects")}>← 返回项目列表</button><div className="project-hero-main"><div><div className="project-id"><span>{selected.id}</span><Badge>项目{selected.projectGrade ?? selected.leadGrade ?? "B"}级</Badge><Badge>线索{selected.leadGrade ?? "未提供"}级</Badge><Badge>{selected.riskLevel}风险</Badge><Badge>{selected.scenarioContext?.scenario ?? selected.intentType}</Badge><Badge>{selected.customerIdentity?.status ?? "客户待匹配"}</Badge><Badge>{selected.administrativeStatus ?? "Active"}</Badge></div><h1>{selected.name}</h1><p>{selected.scenarioContext?.endCustomer ?? selected.customer} · {selected.target}</p></div><div className="project-hero-stats"><div><span>项目预计金额</span><strong>{money(selected.amount)}</strong><small>{["EPC客户询价", "国内EPC询价", "海外伙伴/EPC询价"].includes(selected.scenarioContext?.scenario ?? "") ? "多EPC/伙伴通路只计一次" : "SalesProject口径"}</small></div><div><span>赢单概率</span><strong>{probabilityLabel(selected)}</strong></div><div><span>提交状态</span><strong className={selected.result === "pending" && selected.countdown <= 2 && selected.countdown >= 0 ? "danger-text" : ""}>{submissionTimingLabel(selected)}</strong></div><div><span>Owner</span><strong>{selected.owner}</strong></div></div></div>{renderStageRail()}<p className="stage-caption">S0–S6是管理阶段；ACT活动执行状态、时间状态、G1–G7门禁与商业结果分别记录。</p></div><nav className="detail-tabs" aria-label="项目详情导航">{detailTabs.filter((tab) => tab.id !== "result" || ["S5", "S6"].includes(selected.stage)).map((tab) => <button key={tab.id} className={detailTab === tab.id ? "active" : ""} onClick={() => setDetailTab(tab.id)}>{tab.label}{tab.id === "gate" && getGateConditions(selected).some((item) => !item.ok) && <i>{getGateConditions(selected).filter((item) => !item.ok).length}</i>}</button>)}</nav><div className={`detail-content modern-detail ${entryContext ? "context-target" : ""}`}>{detailTab === "overview" && renderModernOverview()}{detailTab === "relations" && renderModernRelations()}{detailTab === "strategy" && renderModernStrategy()}{detailTab === "resources" && <>{renderResourceCapacity()}{renderPartnerGovernance()}</>}{detailTab === "actions" && renderModernActions()}{detailTab === "versions" && renderModernVersions()}{detailTab === "gate" && renderModernGate()}{detailTab === "result" && renderModernResult()}</div></>;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">QJ</div><div><strong>钱江电气</strong><span>销售项目管理 APP</span></div></div>
      <div className="topbar-center"><span className={`demo-tag ${dataMode === "sample" ? "sample" : "business"}`}>{dataMode === "sample" ? "静态样例模式" : "D1业务数据"}</span><span>{dataMode === "sample" ? "样例与业务项目完全隔离" : "当前页面只读取持久化业务项目"}</span></div>
      <div className="topbar-actions">
        <button className="topbar-tool audit" onClick={() => setAuditOpen(true)}><i>证</i><span>审计证据</span></button>
        <button className="topbar-tool agent" onClick={() => setAgentOpen(true)}><i>AI</i><span>智能助手</span></button>
        <button className="help-button" onClick={() => setGlossaryOpen(true)}>？ 术语帮助</button>
        <div className="role-switch" aria-label="演示角色切换"><button className={role === "sales" ? "active" : ""} onClick={() => { setRole("sales"); setDashboardFocus("all"); if (["rules", "decisions", "resource-center", "risk-center", "configuration-center", "review-center", "action-center"].includes(view)) setView("dashboard"); notify("已切换为销售员视角：确认线索转入、维护事实、推动行动并发起申请"); }}>销售员</button><button className={role === "manager" ? "active" : ""} onClick={() => { setRole("manager"); if (["action-center"].includes(view)) setView("dashboard"); notify("已切换为销售主管视角：可代建并分配Owner，负责立项决策、资源配置、偏差审批和阶段推进"); }}>销售主管</button></div>
        <button className="avatar-button" aria-label="当前用户">{manager ? "周" : "陈"}</button>
      </div>
    </header>
    <aside className="sidebar">{manager ? <><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => openDashboardFocus("todo")}><i>◫</i><span>主管工作台</span></button><button className={view === "projects" || view === "detail" ? "active" : ""} onClick={() => openWorkspace("projects")}><i>▦</i><span>项目组合</span><em>{projects.length}</em></button><button className={view === "new" ? "active" : ""} onClick={openInitiation}><i>＋</i><span>线索转入与代建</span></button><button className={view === "decisions" ? "active" : ""} onClick={() => openWorkspace("decisions")}><i>✓</i><span>阶段门中心</span><em>{Object.keys(realPendingGates).length}</em></button></nav><div className="sidebar-section"><span>专项管理</span><button className={view === "resource-center" ? "active" : ""} onClick={() => openWorkspace("resource-center")}><i>人</i><span>资源与角色</span><em>{projects.reduce((sum, project) => sum + project.resources.filter(item => item.required && item.status !== "已到位").length, 0)}</em></button><button className={view === "risk-center" ? "active" : ""} onClick={() => openWorkspace("risk-center")}><i>!</i><span>风险与督办</span><em>{highRiskCount}</em></button></div><div className="sidebar-section system"><span>系统</span><button className={view === "rules" ? "active" : ""} onClick={() => openWorkspace("rules")}><i>⚙</i><span>平台规则配置</span><em>只读</em></button></div></> : <><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => openDashboardFocus("all")}><i>◫</i><span>今日工作台</span></button><button className={view === "projects" || view === "detail" ? "active" : ""} onClick={() => showProjects({ owner: "陈晨" })}><i>▦</i><span>我的销售项目</span><em>{salesScopedCount}</em></button><button className={view === "new" ? "active" : ""} onClick={openInitiation}><i>＋</i><span>线索转入与立项</span></button></nav></>}<div className="sidebar-bottom"><div><span>当前视角</span><strong>{manager ? "销售主管 · 周主管" : "销售员 · 陈晨"}</strong><small>{dataMode === "sample" ? "样例数据，不写入D1" : "D1业务数据"}</small></div><button onClick={resetAll}>{dataMode === "sample" ? "↻ 重置样例" : "↻ 刷新业务数据"}</button></div></aside>
    <main className={view === "detail" ? "main detail-main" : "main"}>{view === "dashboard" && renderDashboard()}{view === "projects" && renderProjects()}{view === "new" && renderNew()}{view === "detail" && renderDetail()}{view === "decisions" && <DecisionCenter projects={projects} realPendingGates={realPendingGates} onOpenProject={openProject} onNotify={notify} />}{view === "resource-center" && <ResourceCenter projects={projects} onOpenProject={openProject} onNotify={notify} />}{view === "risk-center" && <RiskCenter projects={projects} onOpenProject={openProject} onNotify={notify} />}{view === "configuration-center" && <ConfigurationCenter projects={projects} onOpenProject={openProject} />}{view === "review-center" && <ReviewCenter projects={projects} onOpenProject={openProject} onNotify={notify} />}{view === "action-center" && <SalesActionCenter projects={projects} onOpenProject={openProject} onNotify={notify} />}{view === "rules" && <RulesWorkspace manager={manager} onNotify={notify} />}</main>
    {agentOpen && <div className="global-drawer-backdrop" role="presentation" onMouseDown={event => event.currentTarget === event.target && setAgentOpen(false)}>
      <aside className="global-side-drawer agent-drawer" role="dialog" aria-modal="true" aria-label="Agent统一对话窗口">
        <header><div><span>QJ SALES AGENT</span><h2>项目智能助手</h2><p>{manager ? "主管视角 · 辅助解释风险与决策依据" : "销售员视角 · 辅助整理事实与下一行动"}</p></div><button onClick={() => setAgentOpen(false)} aria-label="关闭">×</button></header>
        <section className="agent-context"><span>当前上下文</span><strong>{selected.name}</strong><small>{selected.stage} {selected.stageName} · {selected.riskLevel}风险 · {manager ? "主管权限" : "销售执行权限"}</small></section>
        <div className="agent-prompts"><button type="button" onClick={() => askAgent(undefined, "这个项目当前最大的风险是什么？")}>解释风险</button><button type="button" onClick={() => askAgent(undefined, "当前阶段为什么不能推进？")}>检查阶段门</button><button type="button" onClick={() => askAgent(undefined, "核价、版本和偏差目前是什么状态？")}>核对版本</button><button type="button" onClick={() => askAgent(undefined, "资源和人员负荷有什么缺口？")}>检查资源</button></div>
        <div className="agent-conversation">{agentMessages.map((message, index) => <article key={`${message.role}-${index}`} className={message.role}><i>{message.role === "agent" ? "AI" : manager ? "周" : "陈"}</i><p>{message.text}</p></article>)}</div>
        <form className="agent-composer" onSubmit={askAgent}><textarea value={agentInput} onChange={event => setAgentInput(event.target.value)} placeholder="询问风险、阶段、资源、核价或版本…" /><button className="primary">发送</button></form>
        <footer>Agent依据当前演示数据生成建议；不会自动写入客户事实、批准偏差、配置资源或推进阶段。</footer>
      </aside>
    </div>}
    {auditOpen && <div className="global-drawer-backdrop" role="presentation" onMouseDown={event => event.currentTarget === event.target && setAuditOpen(false)}>
      <aside className="global-side-drawer audit-drawer" role="dialog" aria-modal="true" aria-label="审计证据抽屉">
        <header><div><span>AUDIT & EVIDENCE</span><h2>审计证据</h2><p>汇总当前项目的来源、关系、版本、审批与行动证据</p></div><button onClick={() => setAuditOpen(false)} aria-label="关闭">×</button></header>
        <section className="audit-context"><div><span>当前项目</span><strong>{selected.name}</strong><small>{selected.id} · {selected.stage} {selected.stageName}</small></div><Badge tone="info">演示只读账本</Badge></section>
        <nav className="audit-filters">{(["全部", "来源", "关系", "版本", "审批", "行动"] as AuditCategory[]).map(category => <button key={category} className={auditFilter === category ? "active" : ""} onClick={() => setAuditFilter(category)}>{category}<b>{category === "全部" ? auditRecords.length : auditRecords.filter(item => item.category === category).length}</b></button>)}</nav>
        <div className="audit-records">{auditRecords.filter(item => auditFilter === "全部" || item.category === auditFilter).map(item => <article key={`${item.category}-${item.id}`}><i>{item.category.slice(0, 1)}</i><div><span>{item.category} · {item.id}</span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time} · 责任/操作人：{item.actor}</small></div><Badge>{item.status}</Badge><button onClick={() => { setAuditOpen(false); openProject(selected.id, item.tab, { source: "审计证据", title: item.title, summary: item.detail }); }}>定位 ›</button></article>)}</div>
        <footer>本抽屉展示可追溯关系和模拟证据摘要；真实文件、签名与审批日志仍由各权威系统保存。</footer>
      </aside>
    </div>}
    {renderPartnerModal()}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    {g1DecisionOpen && <Modal title="G1快速审查｜立项与项目等级" onClose={() => setG1DecisionOpen(false)} drawer><form onSubmit={submitG1Decision} className="modal-form"><div className="demo-boundary"><strong>一次正式决策：</strong>线索原始评级永久只读；销售项目等级默认继承该评级，主管只能依据冻结的客户、采购、金额、战略属性和风险事实作有留痕的调整。</div><section className="panel"><div className="panel-head"><div><span className="eyebrow">冻结申请与定级事实</span><h2>{selected.name}</h2></div><Badge>{selectedGate?.code ?? "G1"} · {selectedGate?.status ?? "pending"}</Badge></div><div className="review-card"><dl><div><dt>采购客户 / 标的</dt><dd>{selected.customer} / {selected.target}</dd></div><div><dt>采购意向证据</dt><dd>{selected.evidence}</dd></div><div><dt>项目Owner</dt><dd>{selected.owner}</dd></div><div><dt>预计金额 / 交标日</dt><dd>{money(selected.amount)} / {selected.bidDate}</dd></div><div><dt>线索评级 / 评分</dt><dd>{selected.leadGrade ?? selected.projectGrade ?? "B"}级 / {selected.leadAssessment?.score ?? "未提供"}</dd></div><div><dt>真实性结论</dt><dd>{selected.leadAssessment?.authenticityStatus ?? "未提供"}｜{selected.leadAssessment?.authenticityBasis ?? "未提供依据"}</dd></div><div><dt>采购进度 / 金额口径</dt><dd>{selected.leadAssessment?.procurementProgress ?? "未提供"} / {selected.leadAssessment?.amountType ?? "未提供"}</dd></div><div><dt>重大项目来源标识</dt><dd>{selected.leadAssessment?.majorProject ? "是" : "否或未提供"}｜{selected.leadAssessment?.majorProjectBasis ?? "未提供依据"}</dd></div><div><dt>评级明细</dt><dd>{selected.leadAssessment?.gradeAssessment ? Object.entries(selected.leadAssessment.gradeAssessment).map(([key, value]) => `${key}：${String(value)}`).join("；") : "线索APP未传评级明细，主管不得据此假设自动评分"}</dd></div><div><dt>来源时间</dt><dd>{selected.leadAssessment?.occurredAt ?? "未提供"}</dd></div><div><dt>硬条件</dt><dd>{getGateConditions(selected).filter(item => item.hard && item.ok).length}/{getGateConditions(selected).filter(item => item.hard).length} 已满足</dd></div></dl></div></section><div className="form-grid two"><Field label="销售项目等级" hint="默认继承线索S/A/B/C；调整不会覆盖线索原始评级。"><select name="projectGrade" defaultValue={selected.projectGrade ?? selected.leadGrade ?? "B"} required><option>S</option><option>A</option><option>B</option><option>C</option></select></Field><Field label="等级调整原因" hint="仅在项目等级与线索评级不一致时必填。"><textarea name="gradeReason" defaultValue={selected.projectGradeReason ?? ""} placeholder="说明为何项目管理打法需要升降级" /></Field><Field label="等级调整依据"><textarea name="gradeEvidence" placeholder="客户/采购事实、金额、战略属性、风险或正式证据编号" /></Field></div><Field label="G1主管审批意见"><textarea name="comment" required placeholder="批准时说明立项判断和S1关注点；退回时说明需要补充的事实或证据" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG1DecisionOpen(false)}>取消</button><button type="submit" name="decision" value="return" className="secondary" formNoValidate disabled={flowBusy}>退回补充</button><button type="submit" name="decision" value="approve" className="primary" disabled={flowBusy}>{flowBusy ? "正在校验并提交…" : "批准立项并进入S1"}</button></div></form></Modal>}
    {g2DecisionOpen && <Modal title="G2正式审查｜投入启动" onClose={() => setG2DecisionOpen(false)} drawer><form onSubmit={submitG2Decision} className="modal-form"><div className="demo-boundary"><strong>冻结来源审查：</strong>本页不重复录入业务事实。批准必须明确投入范围、已接受角色、优先级和期限；退回必须指向具体对象与整改要求。来源变化后旧快照不能批准。</div><section className="panel"><div className="panel-head"><div><span className="eyebrow">G2冻结来源</span><h2>{selected.name}</h2></div><Badge>{selectedGate?.status === "pending" ? "等待主管结论" : selectedGate?.status ?? "未提交"}</Badge></div><div className="cw-source-fact-grid compact">{selected.g2Readiness?.items.map(item => <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.track}</span><Badge>{item.ready ? "已齐套" : item.hard ? "硬缺口" : "管理上下文待补"}</Badge></header><h3>{item.label}</h3><p>{item.summary || "尚无来源事实"}</p><small>{item.owner} · {item.sourceType} · {item.sourceRefs.join(" / ") || "无来源记录"}</small></article>)}</div></section><div className="form-grid two"><Field label="本阶段投入范围" hint="批准时必填；写明启动哪些需求、方案或投报工作及其边界。"><textarea name="investmentScope" placeholder="例如：启动主变技术澄清、方案与正式招标响应；暂不承诺未确认的交期偏差" /></Field><Field label="优先级与期限" hint="批准时必填；责任角色来自上方冻结来源，不在此重新指派。"><textarea name="priorityAndDeadline" placeholder="例如：P0需求澄清 9月5日前；P1方案初版 9月8日前" /></Field><Field label="退回项与整改要求" hint="退回时必填；逐项写明对象、问题、责任人和补充要求。"><textarea name="returnItems" placeholder="例如：客户决策链—商务决策人缺失—销售Owner—补充拜访证据" /></Field></div><Field label="G2主管判断意见"><textarea name="comment" required placeholder="说明为何允许投入或为何退回；不得只写‘同意’" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG2DecisionOpen(false)}>取消</button><button type="submit" name="decision" value="return" className="secondary" disabled={flowBusy}>退回补充</button><button type="submit" name="decision" value="approve" className="primary" disabled={flowBusy || !selected.g2Readiness?.items.filter(item => item.hard).every(item => item.ready)}>批准投入并进入S2</button></div></form></Modal>}
    {epcRouteOpen && <Modal title="新增EPC报价通路" onClose={() => setEpcRouteOpen(false)}><form onSubmit={addEpcRoute} className="modal-form"><div className="demo-boundary"><strong>业务口径：</strong>同一最终采购机会仍是一个 SalesProject；新增EPC客户只增加报价通路，不新增或累加项目预计金额。多家EPC默认继承项目统一授权报价。</div><Field label="EPC客户名称"><input name="epcCustomer" required placeholder="填写收到询价的EPC客户全称" /></Field><div className="form-grid two"><Field label="EPC询价编号"><input name="inquiryRef" required placeholder="邮件、函件或平台询价编号" /></Field><Field label="询价日期"><input name="inquiryDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field></div><Field label="询价证据"><textarea name="evidenceRef" required placeholder="询价邮件、函件、平台记录或已归档文件编号" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setEpcRouteOpen(false)}>取消</button><button className="primary" disabled={flowBusy}>登记报价通路</button></div></form></Modal>}
    {epcWithdrawRoute && <Modal title={`撤回EPC报价通路｜${epcWithdrawRoute.epcCustomer}`} onClose={() => setEpcWithdrawRoute(null)}><form onSubmit={withdrawEpcRoute} className="modal-form"><div className="demo-boundary"><strong>受控撤回：</strong>仅能撤回尚无客户/平台正式提交回执的通路。系统保留通路记录，将相关提交包、价格例外和未完成外部任务标记失效；最后一条有效通路不能在此撤回。</div><Field label="撤回原因"><textarea name="reason" required placeholder="说明EPC退出、询价取消、重复通路或范围不再适用的已核实事实" /></Field><Field label="撤回依据"><textarea name="evidenceRef" required placeholder="客户邮件、平台通知、正式函件或可追溯记录编号" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setEpcWithdrawRoute(null)}>取消</button><button className="primary" disabled={flowBusy}>确认受控撤回</button></div></form></Modal>}
    {g5ReopenDraft && <Modal title="申请解冻G5冻结批次" onClose={() => setG5ReopenDraft(null)}><form onSubmit={requestG5Reopen} className="modal-form"><div className="demo-boundary"><strong>不是直接改数据：</strong>主管批准后只撤销尚未执行的当前G5提交授权、取消旧版本提交任务，并将Gate退回。随后仍需新增/撤回通路、重新组包并重新提交G5。任一通路已有正式回执时系统会拒绝解冻。</div><Field label="拟变更事项"><input readOnly value={g5ReopenDraft.changeType === "add_route" ? "新增后到EPC报价通路" : g5ReopenDraft.changeType === "withdraw_route" ? `撤回通路：${g5ReopenDraft.route?.epcCustomer ?? "—"}` : g5ReopenDraft.changeType === "route_price_change" ? "变更通路报价" : "变更通路材料"} /></Field><Field label="解冻原因"><textarea name="reason" required placeholder="说明冻结后发生了什么新事实、为什么原冻结批次不能继续执行" /></Field><Field label="解冻依据"><textarea name="evidenceRef" required placeholder="客户询价、撤回通知、澄清函或其他可追溯证据" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG5ReopenDraft(null)}>取消</button><button className="primary" disabled={flowBusy}>提交销售主管审批</button></div></form></Modal>}
    {g5ReopenDecision && <Modal title={`${g5ReopenDecision.action === "approve" ? "批准" : "退回"}G5解冻申请`} onClose={() => setG5ReopenDecision(null)}><form onSubmit={decideG5Reopen} className="modal-form"><div className="demo-boundary"><strong>审批边界：</strong>{g5ReopenDecision.action === "approve" ? "服务端会再次确认当前批次没有任何正式提交回执；符合时撤销旧提交授权并保留原决策历史。批准不等于批准新增通路、例外价格或新提交包。" : "退回只要求Owner补充原因或证据，不改变当前冻结批次。"}</div><Field label="申请原因"><textarea readOnly value={g5ReopenDecision.request.reason} /></Field><Field label="主管意见"><textarea name="comment" required placeholder="写明对客户变化事实、尚未提交状态和重新决策必要性的判断" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG5ReopenDecision(null)}>取消</button><button className="primary" disabled={flowBusy}>提交{g5ReopenDecision.action === "approve" ? "解冻批准" : "退回意见"}</button></div></form></Modal>}
    {g5DecisionOpen && <Modal title="G5商务决策与提交授权" onClose={() => setG5DecisionOpen(false)} wide><form onSubmit={submitG5Decision} className="modal-form"><div className="demo-boundary"><strong>一次决策：</strong>本表同时完成投/报判断和按冻结提交包执行的授权，不新增第二个Gate。重大/高等级剩余风险和专业评审偏差必须在本次决策中逐项确认，原专业评审不能代替授权。</div>{(selected.g5Readiness?.deviationItems?.length ?? 0) > 0 && <section className="panel"><div className="panel-head"><div><span className="eyebrow">专业偏差快照</span><h2>{selected.g5Readiness!.deviationItems!.length}项待逐项授权</h2></div><Badge>G5决策责任</Badge></div><div className="risk-list">{selected.g5Readiness!.deviationItems!.map((item, index) => <article key={item.ref}><Badge>{item.reviewType === "business" ? "商务" : item.reviewType === "technical" ? "技术" : "资质"}</Badge><div><strong>偏差 {index + 1}</strong><p>{item.description}</p></div><small>来源：{item.ref}</small><div className="form-grid two"><Field label="授权范围"><textarea name={`deviationScope:${item.ref}`} required placeholder="明确允许偏离的事项、边界及不得突破的条件" /></Field><Field label="剩余风险"><textarea name={`deviationRisk:${item.ref}`} required placeholder="说明批准后仍然存在的影响和控制措施" /></Field><Field label="适用提交包版本"><select name={`deviationVersion:${item.ref}`} required>{item.applicableVersionIds.map(versionId => <option key={versionId} value={versionId}>{versionId}</option>)}</select></Field><Field label="授权有效期"><input name={`deviationValidUntil:${item.ref}`} type="date" required defaultValue={selected.bidDate} /></Field><Field label="授权证据"><textarea name={`deviationEvidence:${item.ref}`} required placeholder="会议纪要、审批单或其他可追溯证据编号" /></Field></div></article>)}</div></section>}{(selected.g5Readiness?.residualHighRisks?.length ?? 0) > 0 && <section className="panel"><div className="panel-head"><div><span className="eyebrow">剩余风险快照</span><h2>{selected.g5Readiness!.residualHighRisks!.length}项重大/高风险</h2></div><Badge>需要显式接受</Badge></div><div className="risk-list">{selected.g5Readiness!.residualHighRisks!.map(risk => <article key={String(risk.id)}><Badge>{String(risk.level)}</Badge><div><strong>{String(risk.title)}</strong><p>{String(risk.category)} · 当前状态：{String(risk.status)} · V{String(risk.version)}</p></div><div><span>{String(risk.owner_name)}</span><small>{String(risk.due_date)}</small></div></article>)}</div><label className="demo-boundary"><input name="acceptResidualRisks" type="checkbox" required /> 我已逐项核对以上风险，确认在当前控制措施和商业判断下仍决定投/报，并承担本次决策责任。</label><Field label="剩余风险接受依据"><textarea name="riskAcceptanceReason" required placeholder="逐项说明控制措施、决策依据、剩余影响以及投标后继续跟踪责任；不得只写‘同意承担’" /></Field></section>}<Field label="G5经营决策意见"><textarea name="comment" required placeholder="批准时说明经营依据与授权范围；退回时逐项说明补充要求；不投/不报时说明胜率、资源、风险和机会成本判断" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG5DecisionOpen(false)}>取消</button><button type="submit" name="decision" value="return" className="secondary" formNoValidate disabled={flowBusy}>退回补充</button><button type="submit" name="decision" value="decline" className="secondary" formNoValidate disabled={flowBusy}>决定不投 / 不报</button><button type="submit" name="decision" value="approve" className="primary" disabled={flowBusy || selected.g5Readiness?.items.some(item => item.hard && !item.ready) || selected.g5Readiness?.activitySnapshot?.hasHardBlocker}>批准投/报并授权提交</button></div></form></Modal>}
    {g6DecisionOpen && <Modal title="G6正式审查｜结果与移交/关闭" onClose={() => setG6DecisionOpen(false)} drawer><form onSubmit={submitG6Decision} className="modal-form"><div className="demo-boundary"><strong>一次正式决策：</strong>主管核对冻结的L2.9结果、提交回执和中标承诺基线或未成交复盘。批准只启动合同接收或行政关闭，不允许在此改写外部结果。</div><section className="panel"><div className="panel-head"><div><span className="eyebrow">G6冻结来源</span><h2>{selected.name}</h2></div><Badge>{selectedGate?.status === "pending" ? "等待主管结论" : selectedGate?.status ?? "未提交"}</Badge></div><div className="cw-source-fact-grid compact">{selected.g6Readiness?.items.map(item => <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Badge>{item.ready ? "已齐套" : "硬缺口"}</Badge></header><h3>{item.label}</h3><p>{item.summary}</p><small>{item.sourceType} · {item.sourceRefs.join(" / ") || "无来源记录"}</small></article>)}</div></section><Field label="G6主管审查意见"><textarea name="comment" required placeholder="说明核对的结果依据、移交范围或关闭依据；不得只写‘同意’" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setG6DecisionOpen(false)}>取消</button><button type="submit" name="decision" value="return" className="secondary" disabled={flowBusy}>退回补充</button><button type="submit" name="decision" value="approve" className="primary" disabled={flowBusy || !selected.g6Readiness?.items.every(item => item.ready) || selected.g6Readiness?.activitySnapshot?.hasHardBlocker}>确认结果并执行分支</button></div></form></Modal>}
    {epcExceptionRoute && <Modal title={`申请通路价格例外｜${epcExceptionRoute.epcCustomer}`} onClose={() => setEpcExceptionRoute(null)}><form onSubmit={requestEpcException} className="modal-form"><div className="demo-boundary">该申请不会修改项目统一授权报价，只在价格授权人批准后作用于当前EPC通路；申请价不得低于G4授权底价，且G5冻结后不可变价。</div><div className="form-grid two"><Field label="项目统一报价（元）"><input value={(epcExceptionRoute.quotedAmount * 10_000).toFixed(0)} readOnly /></Field><Field label="申请例外报价（元）"><input name="requestedPriceYuan" type="number" min={epcExceptionRoute.authorizedFloorPrice * 10_000} required /></Field><Field label="例外有效期"><input name="validUntil" type="date" required defaultValue={String(selected.g5Readiness?.pricingAuthorization?.valid_until ?? selected.bidDate)} /></Field><Field label="授权底价（元）"><input value={(epcExceptionRoute.authorizedFloorPrice * 10_000).toFixed(0)} readOnly /></Field></div><Field label="差异原因"><textarea name="reason" required placeholder="说明配置、范围、交付、税费或商务条款的实际差异，不得只写‘客户要求’" /></Field><Field label="例外证据"><textarea name="evidenceRef" required placeholder="客户差异要求、澄清纪要、测算依据或可追溯文件编号" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setEpcExceptionRoute(null)}>取消</button><button className="primary" disabled={flowBusy}>提交价格授权人审批</button></div></form></Modal>}
    {relationOpen && <Modal title="新增客户关系记录" onClose={() => setRelationOpen(false)}><form onSubmit={addRelationship} className="modal-form"><div className="form-grid two"><Field label="关系层级"><select name="layer" value={relationLayer} onChange={event => setRelationLayer(event.target.value as Relationship["layer"])}><option>客户高层</option><option>商务决策链</option><option>技术层</option></select></Field><Field label="姓名"><input name="name" required placeholder="客户联系人" /></Field><Field label="客户角色/职务"><input name="title" required placeholder="如：采购决策负责人" /></Field><Field label="态度"><select name="attitude"><option>支持</option><option>中立</option><option>反对</option></select></Field><Field label="影响力"><select name="influence"><option>高</option><option>中</option><option>低</option></select></Field><Field label="覆盖负责人"><select name="owner"><option>{selected.owner}</option><option>刘总</option><option>赵工</option></select></Field></div><Field label="关系证据" hint="没有证据的‘认识客户’不能计为有效覆盖。"><textarea name="evidence" required placeholder="拜访纪要、客户确认、历史合作记录等" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setRelationOpen(false)}>取消</button><button className="primary">保存并更新覆盖</button></div></form></Modal>}
    {competitorOpen && <Modal title="新增已核实竞争公司事实" onClose={() => setCompetitorOpen(false)} wide><form onSubmit={addCompetitor} className="modal-form"><div className="form-grid two"><Field label="竞争公司"><input name="name" required placeholder="填写公司或替代方案名称" /></Field><Field label="竞争角色"><select name="role"><option>主要对手</option><option>低价挑战者</option><option>在位供应商</option><option>替代方案</option></select></Field></div><div className="form-grid five"><Field label="客户关系"><input name="relationship" type="number" min="0" max="100" defaultValue="50" required /></Field><Field label="技术匹配"><input name="technical" type="number" min="0" max="100" defaultValue="50" required /></Field><Field label="价格竞争力"><input name="price" type="number" min="0" max="100" defaultValue="50" required /></Field><Field label="交付可信度"><input name="delivery" type="number" min="0" max="100" defaultValue="50" required /></Field><Field label="服务与业绩"><input name="service" type="number" min="0" max="100" defaultValue="50" required /></Field></div><div className="form-grid two"><Field label="可信度"><select name="confidence"><option>中</option><option>高</option><option>低</option></select></Field><Field label="事实日期"><input name="observedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field></div><Field label="证据或来源" hint="评分是项目团队判断；必须能追溯到客户反馈、公开资料、会议纪要或其他来源。"><textarea name="evidence" required placeholder="填写事实内容和证据编号，不要只写‘听说’" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setCompetitorOpen(false)}>取消</button><button className="primary" disabled={flowBusy}>保存竞争事实</button></div></form></Modal>}
    {resourceRequestOpen && <Modal title="补充项目资源需求" onClose={() => setResourceRequestOpen(false)}><form onSubmit={submitResourceRequest} className="modal-form"><div className="demo-boundary"><strong>职责分离：</strong>标准技术角色需求会随G1自动生成；此处用于Owner补充非标准或发生变化的需求。核价、价格授权、投标等专业角色由对应权威作业任务带入，不在这里人工指派。</div><Field label="所需项目角色"><select name="roleName" defaultValue="技术负责人"><option>技术负责人</option><option>高层伙伴</option><option>渠道经理</option><option>服务协调</option></select></Field><Field label="能力与投入要求"><textarea name="requirement" required placeholder="说明本阶段需要完成的工作、必要能力和预计投入，不填写具体候选人" /></Field><div className="form-grid two"><Field label="要求到位日期"><input name="requiredBy" type="date" required defaultValue={selected.bidDate} /></Field><Field label="申请依据"><input name="evidenceRef" required placeholder="阶段计划、客户要求或资源缺口证据编号" /></Field></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setResourceRequestOpen(false)}>取消</button><button className="primary" disabled={flowBusy}>提交补充需求</button></div></form></Modal>}
    {costingRequestOpen && <Modal title="确认启动核价专业作业" onClose={() => setCostingRequestOpen(false)}><div className="modal-form"><div className="demo-boundary"><strong>这不是核价审批，也不是人员自动到位。</strong><br />系统仅把G3已批准的技术方案与报价设计BOM作为只读输入，创建外部核价协同任务；核价人员仍需接受任务并在权威系统形成成本、测算价、毛利、风险储备和交期结论。</div><div className="review-card"><h3>本次启动依据</h3><dl><div><dt>销售项目</dt><dd>{selected.id} · {selected.name}</dd></div><div><dt>当前阶段</dt><dd>{selected.stage} {selected.stageName}</dd></div><div><dt>批准技术方案</dt><dd>{selected.s3Readiness?.items.find(item => item.key === "technicalBaseline")?.sourceRefs.join(" / ") || "由服务端在提交时重新校验"}</dd></div><div><dt>报价设计BOM</dt><dd>{selected.s3Readiness?.items.find(item => item.key === "quotationDesignBom")?.sourceRefs.join(" / ") || "由服务端在提交时重新校验"}</dd></div><div><dt>演示责任映射</dt><dd>刘工 · 3010核价协同测试台；生产环境须由专业资源/核价系统映射实际责任人</dd></div></dl></div><div className="form-actions"><button className="secondary" onClick={() => setCostingRequestOpen(false)}>取消</button><button className="primary" disabled={flowBusy} onClick={() => void requestCostingTask()}>{flowBusy ? "正在创建任务…" : "确认启动核价协同"}</button></div></div></Modal>}
    {resourceCandidateTarget && <Modal title={`登记资源候选｜${resourceCandidateTarget.role}`} onClose={() => setResourceCandidateTarget(null)}><form onSubmit={submitResourceCandidate} className="modal-form"><div className="demo-boundary"><strong>候选不是指派：</strong>本页只保存主管核对过的候选快照。候选被确认指派后状态变为“待接受”；只有本人通过协同身份接受责任，才成为“已到位”。当前未连接企业资源池，以下负荷字段均明确标记为演示快照。</div><Field label="候选人">{resourceCandidateTarget.role === "技术负责人" ? <select name="candidateName" defaultValue="赵工"><option>赵工</option></select> : <input name="candidateName" required placeholder="输入已从当前演示身份目录核对的姓名" />}</Field><input type="hidden" name="sourceRef" value={resourceCandidateTarget.role === "技术负责人" ? "technical-zhao" : `demo-resource-${resourceCandidateTarget.role}`} /><Field label="能力依据"><textarea name="capabilities" required defaultValue={resourceCandidateTarget.role === "技术负责人" ? "变压器技术方案；需求澄清；报价设计BOM" : "项目协同；客户资源协调"} placeholder="用逗号或分号分隔；写已核实能力，不写泛化评价" /></Field><div className="form-grid two"><Field label="当前负荷（%）"><input name="loadPercent" type="number" min="0" max="100" placeholder="未核实可留空" /></Field><Field label="在管项目数"><input name="activeProjectCount" type="number" min="0" placeholder="未核实可留空" /></Field><Field label="最早可投入日期"><input name="availableFrom" type="date" /></Field><Field label="候选来源"><input value="演示身份目录（未接企业资源池）" readOnly /></Field></div><Field label="候选依据"><textarea name="evidenceRef" required placeholder="资源池记录、主管确认记录、能力/排期依据；不得只写‘主管推荐’" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setResourceCandidateTarget(null)}>取消</button><button className="primary" disabled={flowBusy}>保存候选快照</button></div></form></Modal>}
    {riskOpen && <Modal title={manager ? "识别并下发项目风险" : "登记项目经营风险"} onClose={() => setRiskOpen(false)}><form onSubmit={submitRisk} className="modal-form"><div className="demo-boundary"><strong>风险不是评分标签：</strong>必须记录已知事实、可能影响、责任人、期限和来源证据。主管可以识别风险，但后续处置和关闭仍由项目Owner完成。</div><div className="form-grid two"><Field label="风险类别"><select name="category"><option>关系</option><option>资源</option><option>方案</option><option>盈利</option><option>交期</option><option>交标</option><option>结果</option><option>其他</option></select></Field><Field label="风险等级"><select name="level" defaultValue="中"><option>低</option><option>中</option><option>高</option><option>重大</option></select></Field></div><Field label="风险标题"><input name="title" required placeholder="用一句话描述不确定事件及其影响" /></Field><Field label="已核实风险事实"><textarea name="description" required placeholder="写明已发生或已确认的事实，不把猜测写成结论" /></Field><Field label="可能影响"><textarea name="impact" required placeholder="说明对赢单、利润、交期、承诺或阶段推进的影响" /></Field><div className="form-grid two"><Field label="风险Owner"><input value={selected.owner} readOnly /></Field><Field label="处置期限"><input name="dueDate" type="date" required defaultValue={selected.bidDate} /></Field></div><Field label="来源证据"><input name="evidenceRef" required placeholder="客户邮件、会议纪要、专业结论或系统记录编号" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setRiskOpen(false)}>取消</button><button className="primary" disabled={flowBusy}>登记风险</button></div></form></Modal>}
    {riskCloseTarget && <Modal title={`关闭风险｜${riskCloseTarget.title}`} onClose={() => setRiskCloseTarget(null)}><form onSubmit={closeRisk} className="modal-form"><div className="demo-boundary"><strong>关闭标准：</strong>风险不存在、已经避免、影响已被接受或控制措施已生效，必须写清结论并提供证据；创建行动本身不等于风险关闭。</div><Field label="关闭原因"><textarea name="reason" required placeholder="说明为什么现在具备关闭条件" /></Field><Field label="处置结论"><textarea name="resolution" required placeholder="说明实际采取了什么措施、结果是什么、剩余影响如何处理" /></Field><Field label="关闭证据"><input name="evidenceRef" required placeholder="客户确认、评审结论、行动结果或其他可追溯记录编号" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setRiskCloseTarget(null)}>取消</button><button className="primary" disabled={flowBusy}>确认关闭并留痕</button></div></form></Modal>}
    {milestoneOpen && <Modal title="维护项目里程碑" onClose={() => setMilestoneOpen(false)}><form onSubmit={saveMilestone} className="modal-form"><div className="demo-boundary"><strong>里程碑不是普通任务：</strong>它记录关键结果和日期锚点。流程执行仍由任务和活动负责，Gate仍独立决定阶段是否推进。</div><div className="form-grid two"><Field label="里程碑名称"><input name="title" required placeholder="例如：客户确认需求范围" /></Field><Field label="类型"><select name="milestoneType"><option>项目管理</option><option>客户节点</option><option>外部作业</option><option>Gate锚点</option></select></Field><Field label="负责人"><input name="ownerName" required defaultValue={selected.owner} /></Field><Field label="计划日期"><input name="plannedAt" type="date" required defaultValue={selected.bidDate} /></Field></div><Field label="完成标准"><textarea name="completionCriteria" required placeholder="描述可被验证的结果，不填写泛化动作" /></Field><Field label="证据要求"><textarea name="evidenceRequirement" required placeholder="客户确认、系统回执、批准版本或其他权威证据" /></Field><Field label="前置依赖（可选）"><input name="dependencyRef" placeholder="关联Gate、任务、活动或其他里程碑编号" /></Field><Field label="建立或调整原因"><textarea name="changeReason" required placeholder="说明为什么这个节点需要纳入项目计划" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setMilestoneOpen(false)}>取消</button><button className="primary" disabled={flowBusy}>保存里程碑</button></div></form></Modal>}
    {actionOpen && <Modal title={actionContext === "post_award_responsibility" ? "登记成交后遗留责任" : manager ? "发起主管督办" : actionSeed ? "从风险创建行动" : "记录客户经营行动"} onClose={() => { setActionOpen(false); setActionSeed(""); setActionContext("project_operation"); }}><form onSubmit={addAction} className="modal-form"><div className="form-grid two"><Field label={actionContext === "post_award_responsibility" ? "责任类型" : "行动类型"}><select name="type">{actionContext === "post_award_responsibility" ? <><option>客户承诺跟进</option><option>合同差异协调</option><option>履约问题协调</option><option>开票回款跟进</option></> : manager ? <><option>主管督办</option><option>资源协调督办</option><option>阶段补充要求</option></> : <><option>关系推动</option><option>技术交流</option><option>高层拜访</option><option>客户澄清</option><option>资源协调</option><option>投标协同</option></>}</select></Field><Field label={actionContext === "post_award_responsibility" ? "责任人" : manager ? "督办责任人" : "负责人"}><select name="owner"><option>{selected.owner}</option>{!selected.persisted && <>{selected.participants?.filter(item => item !== selected.owner).map(item => <option key={item}>{item}</option>)}<option>赵工</option><option>刘总</option></>}</select></Field><Field label={actionContext === "post_award_responsibility" ? "责任事项" : manager ? "督办事项" : "行动名称"}><input name="title" required defaultValue={actionSeed ? `${manager ? "督办" : "关闭风险"}：${actionSeed}` : ""} placeholder={actionContext === "post_award_responsibility" ? "明确需要销售继续跟踪闭环的事项" : manager ? "明确需要Owner补充的事实或关闭的缺口" : "清晰描述要完成的动作"} /></Field><Field label="截止日期"><input name="due" type="date" required defaultValue={selected.bidDate} /></Field></div><Field label={actionContext === "post_award_responsibility" ? "责任目标" : "目的"}><textarea name="purpose" required defaultValue={actionSeed ? `${manager ? "要求责任人补齐事实、结论或证据" : "形成证据并关闭风险"}“${actionSeed}”` : ""} placeholder={actionContext === "post_award_responsibility" ? "说明要跟到什么业务结果；不得替代合同、订单等下游事实" : "该行动要解决什么问题"} /></Field><Field label="证据要求"><input name="evidence" required placeholder={actionContext === "post_award_responsibility" ? "如：客户确认、协调纪要、合同APP事件或回款凭证引用" : "如：客户确认邮件、会议纪要、评审结论或接受责任记录"} /></Field>{actionContext === "post_award_responsibility" ? <div className="demo-boundary">遗留责任只记录销售需要继续推动的事项；合同、订单、履约、开票和回款状态仍由下游系统权威回传。</div> : selected.persisted && <div className="demo-boundary">当前真实业务边界：ACT-SPM活动由项目销售Owner承担；技术、核价和投标人员通过外部协同任务参与。</div>}{manager && <div className="demo-boundary">主管创建的是督办任务，不替项目Owner填写客户事实，也不代替Owner开始或完成活动。</div>}<div className="form-actions"><button type="button" className="secondary" onClick={() => { setActionOpen(false); setActionContext("project_operation"); }}>取消</button><button className="primary" disabled={flowBusy}>{actionContext === "post_award_responsibility" ? "登记责任" : manager ? "生成并下发督办" : "创建并指派"}</button></div></form></Modal>}
    {activityCommandTarget && <Modal title={`活动流转｜${activityCommandTarget.definitionCode}`} onClose={() => setActivityCommandTarget(null)}><form onSubmit={submitActivityCommand} className="modal-form"><div className="demo-boundary"><strong>{activityCommandTarget.title}</strong><br />当前状态：{activityCommandTarget.status} · 版本V{activityCommandTarget.version} · Owner：{activityCommandTarget.ownerName}</div><Field label="允许的业务命令"><select value={activityCommand} onChange={event => setActivityCommand(event.target.value as ActivityCommand)}>{availableActivityCommands(activityCommandTarget, manager).map(command => <option value={command} key={command}>{activityCommandLabels[command]}</option>)}</select></Field><Field label="操作原因"><textarea name="reason" required placeholder={activityCommand === "block" ? "说明阻塞事实、影响和需要谁处理" : activityCommand === "cancel" ? "说明取消依据，不能只填写‘不做了’" : "说明本次操作对应的真实业务事实"} /></Field>{activityCommand === "complete" && <Field label="完成结果"><textarea name="result" required placeholder="填写已经形成的结果，不要只写‘已完成’" /></Field>}<Field label={activityCommand === "start" ? "进展证据（可选）" : "证据引用"}><textarea name="evidenceRef" required={activityCommand !== "start"} placeholder="会议纪要、客户邮件、文件编号、系统记录ID或其他可追溯来源" /></Field>{manager ? <div className="demo-boundary">主管只能追加督办证据；对ACT-SPM-06可以取消督办，但不能代替Owner开始、恢复或完成。</div> : <div className="demo-boundary">完成、阻塞、恢复和取消均会形成不可变流转记录；完成或取消后不能重新打开。</div>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setActivityCommandTarget(null)}>取消</button><button className="primary" disabled={flowBusy}>确认{activityCommandLabels[activityCommand]}</button></div></form></Modal>}
    {lostOpen && <Modal title="准备失标 / 终止结构化复盘" onClose={() => setLostOpen(false)} wide><form onSubmit={submitLost} className="modal-form"><div className="form-grid two"><Field label="主要原因分类"><select name="reason"><option>价格竞争力不足</option><option>技术方案差距</option><option>客户关系覆盖不足</option><option>资质或业绩不足</option><option>交期无法满足</option><option>客户项目取消</option><option>经营决策不投/不报</option></select></Field><Field label="中标竞争方 / 未披露说明"><input name="competitor" placeholder="如：A厂；未披露时请说明" /></Field></div><Field label="原因事实说明"><textarea name="reasonDetail" required placeholder="写明已核实的事实，不只选择原因标签" /></Field><Field label="关键差距"><textarea name="gap" required placeholder="说明可验证的差距；终止时说明决策依据" /></Field><Field label="复盘证据"><input name="evidence" required placeholder="未中标通知、客户反馈、评标摘要或G5决策证据" /></Field><Field label="改进行动"><textarea name="improvement" required placeholder="明确改进事项和后续验证方式" /></Field><div className="form-grid two"><Field label="行动责任人"><input name="actionOwner" required defaultValue={selected.owner} /></Field><Field label="完成期限"><input name="dueDate" type="date" required /></Field></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setLostOpen(false)}>取消</button><button className="lose-button" disabled={flowBusy}>保存复盘材料（不确认结果）</button></div></form></Modal>}
    {submitBlockers && submitBlockers.length > 0 && <Modal title="正式提交已被阻止" onClose={() => setSubmitBlockers(null)}><div className="blocked-dialog"><div className="blocked-symbol">!</div><p>系统发现以下未满足条件。正式提交版本不可绕过控制：</p>{submitBlockers.map((item) => <div key={item}><span>×</span><strong>{item}</strong></div>)}<p className="rule-note">处理偏差后阶段门会重新计算，但关系或资源缺口仍独立存在。</p><div className="form-actions"><button className="secondary" onClick={() => setSubmitBlockers(null)}>返回处理</button>{selected.deviations.some((item) => item.status === "待审批") && <button className="primary" onClick={() => { setSubmitBlockers(null); setDetailTab("versions"); }}>查看偏差审批</button>}</div></div></Modal>}
    {glossaryOpen && <Modal title="销售项目管理术语" onClose={() => setGlossaryOpen(false)} wide><div className="glossary-list">{glossary.map(([term, definition]) => <article key={term}><strong>{term}</strong><p>{definition}</p></article>)}</div><div className="demo-boundary">说明：术语定义用于本演示原型，最终口径应由业务、财务和投标管理团队共同确认。</div></Modal>}
  </div>;
}
