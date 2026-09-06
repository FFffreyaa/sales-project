import { getD1Binding } from "@/db";
import type { LeadConversionEventEnvelope } from "../../../packages/integration-contracts/src";
import { FlowError, type DemoActor } from "./p0-flow";

function required(value: unknown, label: string, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw new FlowError(`${label}不能为空。`);
  if (value.trim().length > max) throw new FlowError(`${label}超过${max}字。`);
  return value.trim();
}

function optional(value: unknown, max = 500) {
  if (value === undefined || value === null || value === "") return undefined;
  return required(value, "可选字段", max);
}

function validDate(value: unknown, label: string, requiredValue = false) {
  if (!requiredValue && (value === undefined || value === null || value === "")) return undefined;
  const date = required(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new FlowError(`${label}格式必须为 YYYY-MM-DD。`);
  return date;
}

function optionalTimestamp(value: unknown, label: string) {
  const parsed = optional(value, 40);
  if (parsed && Number.isNaN(Date.parse(parsed))) throw new FlowError(`${label}格式不合法。`);
  return parsed;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function parseLeadConversionEnvelope(raw: unknown): LeadConversionEventEnvelope {
  if (!raw || typeof raw !== "object") throw new FlowError("线索转化事件格式不正确。");
  const data = raw as Record<string, unknown>;
  if (data.eventType !== "LeadQualifiedForConversion" || data.sourceSystem !== "LEAD_MANAGEMENT_SIMULATOR" || data.environment !== "demo" || data.simulated !== true) throw new FlowError("当前接口只接受本地线索管理模拟事件。", 403);
  if (!data.lead || typeof data.lead !== "object" || !data.opportunity || typeof data.opportunity !== "object") throw new FlowError("线索和机会快照不能为空。");
  const lead = data.lead as Record<string, unknown>;
  const opportunity = data.opportunity as Record<string, unknown>;
  const amountRaw = opportunity.amount;
  if (!amountRaw || typeof amountRaw !== "object") throw new FlowError("线索金额口径不能为空。");
  const amount = amountRaw as Record<string, unknown>;
  const amountType = String(amount.type);
  if (!['exact', 'range', 'unknown'].includes(amountType)) throw new FlowError("线索金额口径不合法。");
  const minYuan = amount.minYuan === undefined ? undefined : Number(amount.minYuan);
  const maxYuan = amount.maxYuan === undefined ? undefined : Number(amount.maxYuan);
  if (minYuan !== undefined && (!Number.isFinite(minYuan) || minYuan < 0)) throw new FlowError("线索最低金额不合法。");
  if (maxYuan !== undefined && (!Number.isFinite(maxYuan) || maxYuan < 0 || (minYuan !== undefined && maxYuan < minYuan))) throw new FlowError("线索最高金额不合法。");
  if (amountType === "exact" && (minYuan === undefined || minYuan <= 0)) throw new FlowError("准确金额必须大于0。");
  const occurredAt = required(data.occurredAt, "事件发生时间", 40);
  if (Number.isNaN(Date.parse(occurredAt))) throw new FlowError("事件发生时间格式不合法。");
  const leadType = String(lead.type);
  if (leadType !== "tender" && leadType !== "demand") throw new FlowError("线索类型不合法。");
  const leadCategory = optional(lead.category, 20);
  if (leadCategory && !["客户线索", "项目线索", "伙伴线索"].includes(leadCategory)) throw new FlowError("线索分类不合法。");
  const leadGrade = optional(lead.grade, 1);
  if (leadGrade && !["S", "A", "B", "C"].includes(leadGrade)) throw new FlowError("线索等级不合法。");
  const authenticityStatus = String(lead.authenticityStatus);
  if (!['verified', 'manual_confirmed'].includes(authenticityStatus)) throw new FlowError("只有已验证真实性的线索可以进入转化队列。");
  const scenario = optional(opportunity.suggestedScenarioCode, 40);
  if (scenario && !["SCN-01-DIRECT-BID", "SCN-02-EPC-INQUIRY", "SCN-03-DIRECT-RFQ", "SCN-04-OVERSEAS-PARTNER-EPC"].includes(scenario)) throw new FlowError("建议业务场景不合法。");
  const salesRouting = data.salesRouting && typeof data.salesRouting === "object" ? data.salesRouting as Record<string, unknown> : undefined;
  const routingGrade = salesRouting ? required(salesRouting.projectGradeSuggestion, "项目等级建议", 1) : undefined;
  if (routingGrade && !["S", "A", "B", "C"].includes(routingGrade)) throw new FlowError("项目等级建议不合法。");
  const gradeAssessment = record(lead.gradeAssessment);
  const gradeDimensions = record(gradeAssessment?.dimensions) ?? {};
  for (const value of Object.values(gradeDimensions)) if (value !== undefined && !["S", "A", "B", "C"].includes(String(value))) throw new FlowError("线索分维度等级不合法。");
  const authenticityAssessment = record(lead.authenticityAssessment);
  const authenticityDimensions = Array.isArray(authenticityAssessment?.dimensions) ? authenticityAssessment.dimensions.map((item) => {
    const dimension = record(item);
    const score = Number(dimension?.score);
    const maxScore = Number(dimension?.maxScore);
    if (!dimension || !Number.isFinite(score) || !Number.isFinite(maxScore) || score < 0 || maxScore <= 0 || score > maxScore) throw new FlowError("真实性审核维度分数不合法。");
    return { name: required(dimension.name, "真实性审核维度", 120), score, maxScore, conclusion: required(dimension.conclusion, "真实性审核结论", 500) };
  }).slice(0, 20) : [];
  const authenticityTotal = authenticityAssessment ? Number(authenticityAssessment.totalScore) : 0;
  const authenticityMax = authenticityAssessment ? Number(authenticityAssessment.maxScore) : 0;
  if (authenticityAssessment && (!authenticityDimensions.length || !Number.isFinite(authenticityTotal) || !Number.isFinite(authenticityMax) || authenticityTotal < 0 || authenticityMax <= 0 || authenticityTotal > authenticityMax)) throw new FlowError("真实性审核汇总分数不合法。");
  const majorProject = record(lead.majorProject);
  if (majorProject && typeof majorProject.flagged !== "boolean") throw new FlowError("重大工程标记不合法。");
  if (majorProject && !["rule", "manual", "both"].includes(String(majorProject.source))) throw new FlowError("重大工程标记来源不合法。");
  const customerMaster = record(opportunity.customerMaster);
  if (customerMaster && !["matched", "temporary", "unmatched"].includes(String(customerMaster.matchStatus))) throw new FlowError("客户主数据匹配状态不合法。");
  const requirement = record(data.initialRequirement);
  const requirementSources = Array.isArray(requirement?.sourceRefs) ? requirement.sourceRefs.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 30) : [];
  const knownConstraints = Array.isArray(requirement?.knownConstraints) ? requirement.knownConstraints.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 30) : [];
  const unknowns = Array.isArray(requirement?.unknowns) ? requirement.unknowns.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 30) : [];
  return {
    eventId: required(data.eventId, "事件ID", 120), eventType: "LeadQualifiedForConversion", sourceSystem: "LEAD_MANAGEMENT_SIMULATOR", environment: "demo", simulated: true, occurredAt,
    lead: {
      id: required(lead.id, "线索ID", 120), code: required(lead.code, "线索编号", 120), type: leadType, category: leadCategory as LeadConversionEventEnvelope["lead"]["category"],
      grade: leadGrade as LeadConversionEventEnvelope["lead"]["grade"], score: lead.score === undefined ? undefined : Number(lead.score),
      authenticityStatus: authenticityStatus as LeadConversionEventEnvelope["lead"]["authenticityStatus"], sourceChannel: required(lead.sourceChannel, "线索来源渠道", 120),
      assignedOwnerExternalId: lead.assignedOwnerExternalId === "sales-chen" ? "sales-chen" : undefined, assignedOwnerName: optional(lead.assignedOwnerName, 120),
      submitterExternalId: optional(lead.submitterExternalId, 120), submitterName: optional(lead.submitterName, 120), submittedAt: optionalTimestamp(lead.submittedAt, "线索提报时间"),
      authenticityBasis: optional(lead.authenticityBasis, 1000),
      authenticityAssessment: authenticityAssessment ? { dimensions: authenticityDimensions, totalScore: authenticityTotal, maxScore: authenticityMax, conclusion: required(authenticityAssessment.conclusion, "真实性审核汇总结论", 1000), assessedAt: optionalTimestamp(authenticityAssessment.assessedAt, "真实性审核时间"), assessor: optional(authenticityAssessment.assessor, 120) } : undefined,
      gradeAssessment: gradeAssessment ? { dimensions: gradeDimensions as NonNullable<LeadConversionEventEnvelope["lead"]["gradeAssessment"]>["dimensions"], basis: optional(gradeAssessment.basis, 2000), ruleVersion: optional(gradeAssessment.ruleVersion, 120), manuallyAdjusted: Boolean(gradeAssessment.manuallyAdjusted) } : undefined,
      majorProject: majorProject ? { flagged: Boolean(majorProject.flagged), basis: optional(majorProject.basis, 1000), source: String(majorProject.source) as "rule" | "manual" | "both" } : undefined,
    },
    opportunity: {
      projectName: required(opportunity.projectName, "线索项目名称", 200), customerName: required(opportunity.customerName, "线索客户名称", 200), finalCustomerName: optional(opportunity.finalCustomerName, 200),
      projectCountry: optional(opportunity.projectCountry, 120), deliveryCountry: optional(opportunity.deliveryCountry, 120),
      region: optional(opportunity.region, 120), industry: optional(opportunity.industry, 120), productScope: required(opportunity.productScope, "产品需求", 500), quantity: optional(opportunity.quantity, 120),
      amount: { type: amountType as "exact" | "range" | "unknown", minYuan, maxYuan, currency: "CNY" }, procurementProgress: optional(opportunity.procurementProgress, 120),
      procurementMethod: ["tender", "epc_inquiry", "direct_rfq", "unknown"].includes(String(opportunity.procurementMethod)) ? String(opportunity.procurementMethod) as LeadConversionEventEnvelope["opportunity"]["procurementMethod"] : "unknown",
      requestingPartyName: optional(opportunity.requestingPartyName, 200),
      requestingPartyRole: ["end_customer", "epc", "tender_agent", "unknown"].includes(String(opportunity.requestingPartyRole)) ? String(opportunity.requestingPartyRole) as LeadConversionEventEnvelope["opportunity"]["requestingPartyRole"] : "unknown",
      submissionRecipientName: optional(opportunity.submissionRecipientName, 200),
      suggestedScenarioCode: scenario as LeadConversionEventEnvelope["opportunity"]["suggestedScenarioCode"], requestRef: optional(opportunity.requestRef, 160), requestDate: validDate(opportunity.requestDate, "采购请求日期"),
      tenderNo: optional(opportunity.tenderNo, 160), lotNo: optional(opportunity.lotNo, 120), deliveryLocation: optional(opportunity.deliveryLocation, 200), submissionDeadline: validDate(opportunity.submissionDeadline, "投标/报价截止日期"),
      competitorContext: optional(opportunity.competitorContext, 1000), fundingSource: optional(opportunity.fundingSource, 300), projectPriority: optional(opportunity.projectPriority, 120), sourcePlatform: optional(opportunity.sourcePlatform, 200), sourceUrl: optional(opportunity.sourceUrl, 1000),
      customerMaster: customerMaster ? { code: optional(customerMaster.code, 160), matchStatus: String(customerMaster.matchStatus) as "matched" | "temporary" | "unmatched" } : undefined,
    },
    initialRequirement: {
      originalText: optional(requirement?.originalText, 4000) ?? required(opportunity.productScope, "客户初始需求", 4000),
      productRequirement: optional(requirement?.productRequirement, 2000) ?? required(opportunity.productScope, "产品需求", 2000),
      quantity: optional(requirement?.quantity, 120) ?? optional(opportunity.quantity, 120),
      qualificationRequirements: optional(requirement?.qualificationRequirements, 2000),
      knownConstraints,
      unknowns,
      sourceRefs: requirementSources.length ? requirementSources : (Array.isArray(data.evidenceRefs) ? data.evidenceRefs.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 30) : []),
    },
    salesRouting: salesRouting ? {
      organization: required(salesRouting.organization, "归属组织", 120), projectGradeSuggestion: routingGrade as "S" | "A" | "B" | "C",
      requirementDate: validDate(salesRouting.requirementDate, "需求确认计划", true)!, technicalDate: validDate(salesRouting.technicalDate, "技术方案计划", true)!, costingDate: validDate(salesRouting.costingDate, "核价计划", true)!,
      firstAction: required(salesRouting.firstAction, "立项后首个行动", 300),
    } : undefined,
    evidenceRefs: Array.isArray(data.evidenceRefs) ? data.evidenceRefs.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 20) : [],
    competitors: Array.isArray(data.competitors) ? data.competitors.filter((item): item is LeadConversionEventEnvelope["competitors"][number] => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string").slice(0, 30) : [],
    keyRoles: Array.isArray(data.keyRoles) ? data.keyRoles.filter((item): item is LeadConversionEventEnvelope["keyRoles"][number] => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string").slice(0, 50) : [],
    partners: Array.isArray(data.partners) ? data.partners.filter((item): item is LeadConversionEventEnvelope["partners"][number] => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string").slice(0, 30) : [],
    contacts: Array.isArray(data.contacts) ? data.contacts.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 50) : [],
    followups: Array.isArray(data.followups) ? data.followups.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 100) : [],
    attachments: Array.isArray(data.attachments) ? data.attachments.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 100) : [],
    teamCandidates: Array.isArray(data.teamCandidates) ? data.teamCandidates.filter((item): item is NonNullable<LeadConversionEventEnvelope["teamCandidates"]>[number] => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string").slice(0, 50) : [],
    parties: Array.isArray(data.parties) ? data.parties.filter((item): item is NonNullable<LeadConversionEventEnvelope["parties"]>[number] => {
      if (!item || typeof item !== "object") return false;
      const party = item as Record<string, unknown>;
      return typeof party.name === "string" && Boolean(party.name.trim()) && ["requesting_customer", "end_customer", "tendering_entity", "tender_agent", "design_institute", "installation_contractor", "epc", "partner"].includes(String(party.role));
    }).slice(0, 50) : [],
    duplicateCheck: data.duplicateCheck && typeof data.duplicateCheck === "object" && ["clear", "suspected", "confirmed_distinct"].includes(String((data.duplicateCheck as Record<string, unknown>).status)) ? data.duplicateCheck as LeadConversionEventEnvelope["duplicateCheck"] : undefined,
    fieldProvenance: data.fieldProvenance && typeof data.fieldProvenance === "object" ? data.fieldProvenance as Record<string, unknown> : {},
  };
}

export async function processLeadConversionEvent(event: LeadConversionEventEnvelope) {
  const db = getD1Binding();
  const existing = await db.prepare("SELECT i.*,p.project_code FROM lead_conversion_inbox i LEFT JOIN sales_projects p ON p.id=i.converted_project_id WHERE i.event_id=? OR (i.source_system=? AND i.lead_id=?) LIMIT 1").bind(event.eventId, event.sourceSystem, event.lead.id).first<Record<string, unknown>>();
  if (existing) {
    if (existing.event_id === event.eventId || existing.status !== "pending_confirmation" || String(existing.occurred_at) > event.occurredAt) {
      return { duplicate: true, inboxId: existing.id, status: existing.status, projectCode: existing.project_code ?? null };
    }
    const o = event.opportunity;
    await db.prepare(`UPDATE lead_conversion_inbox SET event_id=?,lead_code=?,lead_type=?,lead_grade=?,lead_score=?,grade_assessment=?,major_project=?,major_project_basis=?,authenticity_status=?,authenticity_basis=?,source_channel=?,submitter_snapshot=?,assigned_owner_external_id=?,assigned_owner_name=?,customer_name=?,final_customer_name=?,project_name=?,region=?,industry=?,product_scope=?,quantity=?,amount_type=?,amount_min_cents=?,amount_max_cents=?,currency=?,procurement_progress=?,suggested_scenario_code=?,request_ref=?,request_date=?,tender_no=?,lot_no=?,delivery_location=?,submission_deadline=?,business_context=?,customer_master_snapshot=?,evidence_refs=?,attachment_snapshot=?,contact_snapshot=?,followup_snapshot=?,source_snapshot=?,field_provenance=?,occurred_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_confirmation'`).bind(
      event.eventId, event.lead.code, event.lead.type, event.lead.grade ?? null, event.lead.score ?? null, JSON.stringify(event.lead.gradeAssessment ?? {}), event.lead.majorProject?.flagged ? 1 : 0, event.lead.majorProject?.basis ?? null, event.lead.authenticityStatus, event.lead.authenticityBasis ?? null, event.lead.sourceChannel, JSON.stringify({ externalId: event.lead.submitterExternalId, name: event.lead.submitterName, submittedAt: event.lead.submittedAt }),
      event.lead.assignedOwnerExternalId ?? null, event.lead.assignedOwnerName ?? null, o.customerName, o.finalCustomerName ?? null, o.projectName, o.region ?? null, o.industry ?? null, o.productScope, o.quantity ?? null, o.amount.type, o.amount.minYuan === undefined ? null : Math.round(o.amount.minYuan * 100), o.amount.maxYuan === undefined ? null : Math.round(o.amount.maxYuan * 100), o.amount.currency, o.procurementProgress ?? null, o.suggestedScenarioCode ?? null, o.requestRef ?? null, o.requestDate ?? null, o.tenderNo ?? null, o.lotNo ?? null, o.deliveryLocation ?? null, o.submissionDeadline ?? null,
      JSON.stringify({ competitorContext: o.competitorContext, competitors: event.competitors, keyRoles: event.keyRoles, partners: event.partners, parties: event.parties ?? [], teamCandidates: event.teamCandidates ?? [], duplicateCheck: event.duplicateCheck, projectCountry: o.projectCountry, deliveryCountry: o.deliveryCountry, fundingSource: o.fundingSource, projectPriority: o.projectPriority, sourcePlatform: o.sourcePlatform, sourceUrl: o.sourceUrl, procurementMethod: o.procurementMethod, requestingPartyName: o.requestingPartyName, requestingPartyRole: o.requestingPartyRole, submissionRecipientName: o.submissionRecipientName, leadCategory: event.lead.category }), JSON.stringify(o.customerMaster ?? {}), JSON.stringify(event.evidenceRefs), JSON.stringify(event.attachments), JSON.stringify(event.contacts), JSON.stringify(event.followups), JSON.stringify(event), JSON.stringify(event.fieldProvenance), event.occurredAt, existing.id,
    ).run();
    return { duplicate: false, updated: true, inboxId: existing.id, status: "pending_confirmation", projectCode: null };
  }
  const inboxId = crypto.randomUUID();
  const o = event.opportunity;
  await db.prepare(`INSERT INTO lead_conversion_inbox (id,event_id,lead_id,lead_code,source_system,lead_type,lead_grade,lead_score,grade_assessment,major_project,major_project_basis,authenticity_status,authenticity_basis,source_channel,submitter_snapshot,assigned_owner_external_id,assigned_owner_name,customer_name,final_customer_name,project_name,region,industry,product_scope,quantity,amount_type,amount_min_cents,amount_max_cents,currency,procurement_progress,suggested_scenario_code,request_ref,request_date,tender_no,lot_no,delivery_location,submission_deadline,business_context,customer_master_snapshot,evidence_refs,attachment_snapshot,contact_snapshot,followup_snapshot,source_snapshot,field_provenance,status,environment,simulated,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      inboxId, event.eventId, event.lead.id, event.lead.code, event.sourceSystem, event.lead.type, event.lead.grade ?? null, event.lead.score ?? null, JSON.stringify(event.lead.gradeAssessment ?? {}), event.lead.majorProject?.flagged ? 1 : 0, event.lead.majorProject?.basis ?? null, event.lead.authenticityStatus, event.lead.authenticityBasis ?? null, event.lead.sourceChannel, JSON.stringify({ externalId: event.lead.submitterExternalId, name: event.lead.submitterName, submittedAt: event.lead.submittedAt }),
      event.lead.assignedOwnerExternalId ?? null, event.lead.assignedOwnerName ?? null, o.customerName, o.finalCustomerName ?? null, o.projectName, o.region ?? null, o.industry ?? null, o.productScope, o.quantity ?? null,
      o.amount.type, o.amount.minYuan === undefined ? null : Math.round(o.amount.minYuan * 100), o.amount.maxYuan === undefined ? null : Math.round(o.amount.maxYuan * 100), o.amount.currency, o.procurementProgress ?? null,
      o.suggestedScenarioCode ?? null, o.requestRef ?? null, o.requestDate ?? null, o.tenderNo ?? null, o.lotNo ?? null, o.deliveryLocation ?? null, o.submissionDeadline ?? null,
      JSON.stringify({ competitorContext: o.competitorContext, competitors: event.competitors, keyRoles: event.keyRoles, partners: event.partners, parties: event.parties ?? [], teamCandidates: event.teamCandidates ?? [], duplicateCheck: event.duplicateCheck, projectCountry: o.projectCountry, deliveryCountry: o.deliveryCountry, fundingSource: o.fundingSource, projectPriority: o.projectPriority, sourcePlatform: o.sourcePlatform, sourceUrl: o.sourceUrl, procurementMethod: o.procurementMethod, requestingPartyName: o.requestingPartyName, requestingPartyRole: o.requestingPartyRole, submissionRecipientName: o.submissionRecipientName, leadCategory: event.lead.category }), JSON.stringify(o.customerMaster ?? {}),
      JSON.stringify(event.evidenceRefs), JSON.stringify(event.attachments), JSON.stringify(event.contacts), JSON.stringify(event.followups), JSON.stringify(event), JSON.stringify(event.fieldProvenance), "pending_confirmation", "demo", 1, event.occurredAt,
    ).run();
  return { duplicate: false, inboxId, status: "pending_confirmation", autoConverted: false, reason: "线索已进入待转化队列；销售Owner需确认采购关系、业务场景和项目责任后才能生成S0/G1。" };
}

export async function listLeadConversionsFor(actor: DemoActor) {
  if (actor.role !== "sales" && actor.role !== "manager") throw new FlowError("当前角色无权查看线索转化队列。", 403);
  const db = getD1Binding();
  const acceptanceFilter = "i.event_id NOT LIKE 'G6-ACCEPTANCE-%' AND i.event_id NOT LIKE 'B2-%'";
  const condition = actor.role === "manager" ? `WHERE ${acceptanceFilter}` : `WHERE ${acceptanceFilter} AND (i.assigned_owner_external_id IS NULL OR i.assigned_owner_external_id=?)`;
  const statement = db.prepare(`SELECT i.*,p.project_code,p.stage,p.stage_name FROM lead_conversion_inbox i LEFT JOIN sales_projects p ON p.id=i.converted_project_id ${condition} ORDER BY CASE i.status WHEN 'pending_confirmation' THEN 0 ELSE 1 END,i.occurred_at DESC`);
  const result = actor.role === "manager" ? await statement.all<Record<string, unknown>>() : await statement.bind(actor.id).all<Record<string, unknown>>();
  return result.results.map(row => ({ ...row, evidence_refs: typeof row.evidence_refs === "string" ? JSON.parse(row.evidence_refs) : row.evidence_refs, attachment_snapshot: typeof row.attachment_snapshot === "string" ? JSON.parse(row.attachment_snapshot) : row.attachment_snapshot, grade_assessment: typeof row.grade_assessment === "string" ? JSON.parse(row.grade_assessment) : row.grade_assessment, submitter_snapshot: typeof row.submitter_snapshot === "string" ? JSON.parse(row.submitter_snapshot) : row.submitter_snapshot, business_context: typeof row.business_context === "string" ? JSON.parse(row.business_context) : row.business_context, customer_master_snapshot: typeof row.customer_master_snapshot === "string" ? JSON.parse(row.customer_master_snapshot) : row.customer_master_snapshot, contact_snapshot: typeof row.contact_snapshot === "string" ? JSON.parse(row.contact_snapshot) : row.contact_snapshot, followup_snapshot: typeof row.followup_snapshot === "string" ? JSON.parse(row.followup_snapshot) : row.followup_snapshot, field_provenance: typeof row.field_provenance === "string" ? JSON.parse(row.field_provenance) : row.field_provenance }));
}
