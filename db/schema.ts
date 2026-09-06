import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), displayName: text("display_name").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(), code: text("code").notNull(), name: text("name").notNull(), ...timestamps,
}, (table) => [uniqueIndex("roles_code_uq").on(table.code)]);
export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id), roleId: text("role_id").notNull().references(() => roles.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

/** 统一客户/Party引用。当前未接客户主数据时只建立temporary记录，不伪造“已匹配”。 */
export const parties = sqliteTable("parties", {
  id: text("id").primaryKey(), displayName: text("display_name").notNull(), normalizedName: text("normalized_name").notNull(), partyKind: text("party_kind").notNull(), masterStatus: text("master_status").notNull().default("temporary"), sourceSystem: text("source_system").notNull(), sourceRef: text("source_ref").notNull(), ...timestamps,
}, (table) => [uniqueIndex("parties_normalized_name_uq").on(table.normalizedName), uniqueIndex("parties_source_uq").on(table.sourceSystem, table.sourceRef)]);

export const procurementIntents = sqliteTable("procurement_intents", {
  id: text("id").primaryKey(), scenarioCode: text("scenario_code").notNull().default("SCN-03-DIRECT-RFQ"), intentType: text("intent_type").notNull(), evidence: text("evidence").notNull(), customerName: text("customer_name").notNull(), target: text("target").notNull(), amountCents: integer("amount_cents").notNull(), bidDate: text("bid_date").notNull(), ownerUserId: text("owner_user_id").notNull().references(() => users.id), duplicateStatus: text("duplicate_status").notNull().default("clear"), sourceSnapshot: text("source_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(), createdBy: text("created_by").notNull().references(() => users.id), version: integer("version").notNull().default(1), ...timestamps,
}, (table) => [
  index("procurement_intents_customer_idx").on(table.customerName),
  check("procurement_intents_amount_nonnegative", sql`${table.amountCents} >= 0`),
  check("procurement_intents_duplicate_status_ck", sql`${table.duplicateStatus} in ('clear','suspected','confirmed_distinct','merge_required')`),
]);

export const salesProjects = sqliteTable("sales_projects", {
  id: text("id").primaryKey(), projectCode: text("project_code").notNull(), procurementIntentId: text("procurement_intent_id").notNull().references(() => procurementIntents.id), name: text("name").notNull(), customerName: text("customer_name").notNull(), target: text("target").notNull(), amountCents: integer("amount_cents").notNull(), projectGrade: text("project_grade").notNull(), leadGrade: text("lead_grade"), projectGradeReason: text("project_grade_reason"), projectGradeEvidence: text("project_grade_evidence"), projectImportance: text("project_importance"), projectImportanceReason: text("project_importance_reason"), organization: text("organization").notNull(), ownerUserId: text("owner_user_id").notNull().references(() => users.id), ownerName: text("owner_name").notNull(), stage: text("stage").notNull().default("S0"), stageName: text("stage_name").notNull().default("待立项"), lifecycleStatus: text("lifecycle_status").notNull().default("待立项"), result: text("result").notNull().default("pending"), administrativeStatus: text("administrative_status").notNull().default("Active"), bidDate: text("bid_date").notNull(), evidence: text("evidence").notNull(), detailSnapshot: text("detail_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(), version: integer("version").notNull().default(1), ...timestamps,
}, (table) => [
  uniqueIndex("sales_projects_code_uq").on(table.projectCode), uniqueIndex("sales_projects_intent_uq").on(table.procurementIntentId), index("sales_projects_owner_stage_idx").on(table.ownerUserId, table.stage), check("sales_projects_stage_ck", sql`${table.stage} in ('S0','S1','S2','S3','S4','S5','S6')`), check("sales_projects_lead_grade_ck", sql`${table.leadGrade} is null or ${table.leadGrade} in ('S','A','B','C')`), check("sales_projects_importance_ck", sql`${table.projectImportance} is null or ${table.projectImportance} in ('普通','重点','重大')`),
]);

/** 线索系统转化入站记录。原始快照不可被销售项目后续修订覆盖。 */
export const leadConversionInbox = sqliteTable("lead_conversion_inbox", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  leadId: text("lead_id").notNull(),
  leadCode: text("lead_code").notNull(),
  sourceSystem: text("source_system").notNull(),
  leadType: text("lead_type").notNull(),
  leadGrade: text("lead_grade"),
  leadScore: integer("lead_score"),
  gradeAssessment: text("grade_assessment", { mode: "json" }).$type<Record<string, unknown>>(),
  majorProject: integer("major_project", { mode: "boolean" }).notNull().default(false),
  majorProjectBasis: text("major_project_basis"),
  authenticityStatus: text("authenticity_status").notNull(),
  authenticityBasis: text("authenticity_basis"),
  sourceChannel: text("source_channel").notNull(),
  submitterSnapshot: text("submitter_snapshot", { mode: "json" }).$type<Record<string, unknown>>(),
  assignedOwnerExternalId: text("assigned_owner_external_id"),
  assignedOwnerName: text("assigned_owner_name"),
  customerName: text("customer_name").notNull(),
  finalCustomerName: text("final_customer_name"),
  projectName: text("project_name").notNull(),
  region: text("region"),
  industry: text("industry"),
  productScope: text("product_scope").notNull(),
  quantity: text("quantity"),
  amountType: text("amount_type").notNull().default("unknown"),
  amountMinCents: integer("amount_min_cents"),
  amountMaxCents: integer("amount_max_cents"),
  currency: text("currency").notNull().default("CNY"),
  procurementProgress: text("procurement_progress"),
  suggestedScenarioCode: text("suggested_scenario_code"),
  requestRef: text("request_ref"),
  requestDate: text("request_date"),
  tenderNo: text("tender_no"),
  lotNo: text("lot_no"),
  deliveryLocation: text("delivery_location"),
  submissionDeadline: text("submission_deadline"),
  businessContext: text("business_context", { mode: "json" }).$type<Record<string, unknown>>(),
  customerMasterSnapshot: text("customer_master_snapshot", { mode: "json" }).$type<Record<string, unknown>>(),
  evidenceRefs: text("evidence_refs", { mode: "json" }).$type<string[]>().notNull(),
  attachmentSnapshot: text("attachment_snapshot", { mode: "json" }).$type<Array<Record<string, unknown>>>().notNull(),
  contactSnapshot: text("contact_snapshot", { mode: "json" }).$type<Array<Record<string, unknown>>>().notNull(),
  followupSnapshot: text("followup_snapshot", { mode: "json" }).$type<Array<Record<string, unknown>>>().notNull(),
  sourceSnapshot: text("source_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  fieldProvenance: text("field_provenance", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending_confirmation"),
  convertedProjectId: text("converted_project_id").references(() => salesProjects.id),
  convertedBy: text("converted_by").references(() => users.id),
  convertedAt: text("converted_at"),
  processingError: text("processing_error"),
  environment: text("environment").notNull().default("demo"),
  simulated: integer("simulated", { mode: "boolean" }).notNull().default(true),
  occurredAt: text("occurred_at").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("lead_conversion_inbox_event_uq").on(table.eventId),
  uniqueIndex("lead_conversion_inbox_source_lead_uq").on(table.sourceSystem, table.leadId),
  index("lead_conversion_inbox_status_owner_idx").on(table.status, table.assignedOwnerExternalId),
  check("lead_conversion_inbox_type_ck", sql`${table.leadType} in ('tender','demand')`),
  check("lead_conversion_inbox_grade_ck", sql`${table.leadGrade} is null or ${table.leadGrade} in ('S','A','B','C')`),
  check("lead_conversion_inbox_amount_type_ck", sql`${table.amountType} in ('exact','range','unknown')`),
  check("lead_conversion_inbox_status_ck", sql`${table.status} in ('pending_confirmation','auto_converted','manually_converted','rejected')`),
]);

/** 销售项目到上游业务对象的不可变来源链接。 */
export const projectSourceLinks = sqliteTable("project_source_links", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  sourceSystem: text("source_system").notNull(),
  sourceObjectType: text("source_object_type").notNull(),
  sourceObjectId: text("source_object_id").notNull(),
  sourceObjectCode: text("source_object_code"),
  relationType: text("relation_type").notNull(),
  sourceSnapshot: text("source_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  fieldProvenance: text("field_provenance", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  importedAt: text("imported_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("project_source_links_source_uq").on(table.sourceSystem, table.sourceObjectType, table.sourceObjectId),
  index("project_source_links_project_idx").on(table.projectId, table.relationType),
]);

/** 线索转化时冻结的初始客户需求事实；后续澄清和正式需求基线不得覆盖本快照。 */
export const leadRequirementSnapshots = sqliteTable("lead_requirement_snapshots", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  sourceSystem: text("source_system").notNull(),
  leadId: text("lead_id").notNull(),
  leadCode: text("lead_code").notNull(),
  snapshotVersion: integer("snapshot_version").notNull().default(1),
  originalText: text("original_text").notNull(),
  requirementSnapshot: text("requirement_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  sourceRefs: text("source_refs", { mode: "json" }).$type<string[]>().notNull(),
  fieldProvenance: text("field_provenance", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  sourceOccurredAt: text("source_occurred_at").notNull(),
  immutable: integer("immutable", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("lead_requirement_snapshots_project_uq").on(table.projectId),
  uniqueIndex("lead_requirement_snapshots_source_uq").on(table.sourceSystem, table.leadId, table.snapshotVersion),
  check("lead_requirement_snapshots_immutable_ck", sql`${table.immutable} = 1`),
]);

/** 最终采购机会指纹；EPC询价客户不进入此键。 */
export const opportunityFingerprints = sqliteTable("opportunity_fingerprints", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), fingerprintKey: text("fingerprint_key").notNull(), finalCustomerName: text("final_customer_name").notNull(), procurementProjectName: text("procurement_project_name").notNull(), tenderNo: text("tender_no"), lotNo: text("lot_no"), deliveryLocation: text("delivery_location").notNull(), productScope: text("product_scope").notNull(), procurementTimeWindow: text("procurement_time_window"), verificationStatus: text("verification_status").notNull().default("confirmed"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("opportunity_fingerprints_project_uq").on(table.projectId), uniqueIndex("opportunity_fingerprints_key_uq").on(table.fingerprintKey)]);

/** 一个SalesProject可接收多个采购请求；EPC多询价只增加请求和报价通路。 */
export const procurementRequests = sqliteTable("procurement_requests", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), procurementIntentId: text("procurement_intent_id").notNull().references(() => procurementIntents.id), requestType: text("request_type").notNull(), requestRef: text("request_ref").notNull(), sourcePartyId: text("source_party_id").notNull().references(() => parties.id), finalCustomerPartyId: text("final_customer_party_id").notNull().references(() => parties.id), inquiryBatch: text("inquiry_batch"), evidenceRef: text("evidence_ref").notNull(), requestedSubmissionDate: text("requested_submission_date").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("procurement_requests_source_uq").on(table.sourcePartyId, table.requestRef), index("procurement_requests_project_idx").on(table.projectId, table.status)]);

/** 客户直接投标的外部投标轮次；EPC询价继续使用QuotationRoute。 */
export const bidRounds = sqliteTable("bid_rounds", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  roundNo: integer("round_no").notNull(),
  roundType: text("round_type").notNull().default("initial"),
  externalBidId: text("external_bid_id"),
  authoritySystem: text("authority_system").notNull().default("BID_MANAGEMENT_APP"),
  status: text("status").notNull().default("registered"),
  tenderDocumentRef: text("tender_document_ref").notNull(),
  tenderDocumentVersion: text("tender_document_version"),
  tenderDocumentHash: text("tender_document_hash"),
  bidDeadline: text("bid_deadline").notNull(),
  sourceEventId: text("source_event_id"),
  sourceSnapshot: text("source_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  latestSyncedAt: text("latest_synced_at"),
  ...timestamps,
}, (table) => [
  uniqueIndex("bid_rounds_project_round_uq").on(table.projectId, table.roundNo),
  uniqueIndex("bid_rounds_external_uq").on(table.authoritySystem, table.externalBidId),
  index("bid_rounds_project_status_idx").on(table.projectId, table.status),
  check("bid_rounds_type_ck", sql`${table.roundType} in ('initial','rebid','supplement')`),
  check("bid_rounds_status_ck", sql`${table.status} in ('registered','active','on_hold','submitted','resulted','cancelled')`),
]);

export const salesProjectPartyRoles = sqliteTable("sales_project_party_roles", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), partyId: text("party_id").notNull().references(() => parties.id), roleType: text("role_type").notNull(), sourceRequestId: text("source_request_id").references(() => procurementRequests.id), status: text("status").notNull().default("active"), ...timestamps,
}, (table) => [uniqueIndex("sales_project_party_roles_uq").on(table.projectId, table.partyId, table.roleType), index("sales_project_party_roles_project_idx").on(table.projectId, table.status)]);

export const stageGateInstances = sqliteTable("stage_gate_instances", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), gateCode: text("gate_code").notNull(), sourceStage: text("source_stage").notNull(), targetStage: text("target_stage"), status: text("status").notNull().default("pending"), executionStatus: text("execution_status").notNull().default("not_required"), completedAt: text("completed_at"), requestedBy: text("requested_by").notNull().references(() => users.id), requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`), decidedBy: text("decided_by").references(() => users.id), decisionComment: text("decision_comment"), decidedAt: text("decided_at"), version: integer("version").notNull().default(1), definitionVersion: text("definition_version").notNull().default("LIFECYCLE_GATE_V1"), migratedFrom: text("migrated_from"), ...timestamps,
}, (table) => [index("stage_gate_instances_project_idx").on(table.projectId, table.gateCode), uniqueIndex("stage_gate_instances_project_gate_uq").on(table.projectId, table.gateCode), check("stage_gate_instances_status_ck", sql`${table.status} in ('pending','returned','approved')`)]);
export const gateDecisions = sqliteTable("gate_decisions", {
  id: text("id").primaryKey(), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), gateVersion: integer("gate_version").notNull(), decision: text("decision").notNull(), comment: text("comment").notNull(), actorUserId: text("actor_user_id").notNull().references(() => users.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("gate_decisions_gate_idx").on(table.gateInstanceId), uniqueIndex("gate_decisions_gate_version_uq").on(table.gateInstanceId, table.gateVersion)]);
export const gateSubmissionSnapshots = sqliteTable("gate_submission_snapshots", {
  id: text("id").primaryKey(), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), submissionVersion: integer("submission_version").notNull(), inputSnapshot: text("input_snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(), submittedBy: text("submitted_by").notNull().references(() => users.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("gate_submission_snapshots_gate_idx").on(table.gateInstanceId), uniqueIndex("gate_submission_snapshots_version_uq").on(table.gateInstanceId, table.submissionVersion)]);
export const domainEvents = sqliteTable("domain_events", {
  id: text("id").primaryKey(), aggregateType: text("aggregate_type").notNull(), aggregateId: text("aggregate_id").notNull(), eventType: text("event_type").notNull(), payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(), actorUserId: text("actor_user_id").notNull().references(() => users.id), occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("domain_events_aggregate_idx").on(table.aggregateType, table.aggregateId)]);
export const auditRecords = sqliteTable("audit_records", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), category: text("category").notNull(), action: text("action").notNull(), beforeState: text("before_state", { mode: "json" }).$type<Record<string, unknown> | null>(), afterState: text("after_state", { mode: "json" }).$type<Record<string, unknown>>().notNull(), actorUserId: text("actor_user_id").notNull().references(() => users.id), occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_records_project_idx").on(table.projectId, table.occurredAt)]);

/**
 * 双轨活动共享语义字典。ACT-SPM 实例由本系统权威执行；ACT-BID 仅用于校验外部投影语义。
 */
export const activityDefinitions = sqliteTable("activity_definitions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  version: integer("version").notNull().default(1),
  parentCode: text("parent_code"),
  trackType: text("track_type").notNull(),
  name: text("name").notNull(),
  ltcNodeCode: text("ltc_node_code"),
  authoritySystem: text("authority_system").notNull(),
  completionEvent: text("completion_event").notNull(),
  executable: integer("executable", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("activity_definitions_code_version_uq").on(table.code, table.version),
  index("activity_definitions_track_idx").on(table.trackType, table.active),
  check("activity_definitions_track_ck", sql`${table.trackType} in ('SALES_PROJECT_MANAGEMENT','BID_OPERATION')`),
]);

/** 本系统权威的销售项目管理活动实例；外部投标作业不得写入此表。 */
export const activityInstances = sqliteTable("activity_instances", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  definitionId: text("definition_id").notNull().references(() => activityDefinitions.id),
  title: text("title").notNull(),
  purpose: text("purpose").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  ownerName: text("owner_name").notNull(),
  status: text("status").notNull().default("planned"),
  timelinessStatus: text("timeliness_status").notNull().default("on_track"),
  plannedStart: text("planned_start"),
  plannedEnd: text("planned_end").notNull(),
  actualStart: text("actual_start"),
  actualEnd: text("actual_end"),
  result: text("result"),
  exceptionReason: text("exception_reason"),
  businessObjectRefs: text("business_object_refs", { mode: "json" }).$type<Array<Record<string, string>>>().notNull(),
  gateInstanceId: text("gate_instance_id").references(() => stageGateInstances.id),
  version: integer("version").notNull().default(1),
  lastCommandId: text("last_command_id"),
  createdBy: text("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  index("activity_instances_project_idx").on(table.projectId, table.status, table.plannedEnd),
  index("activity_instances_definition_idx").on(table.definitionId, table.status),
  uniqueIndex("activity_instances_project_lifecycle_uq").on(table.projectId, table.definitionId).where(sql`${table.definitionId} in ('ACT-SPM-02@1','ACT-SPM-03@1','ACT-SPM-04@1','ACT-SPM-07@1','ACT-SPM-08@1')`),
  check("activity_instances_status_ck", sql`${table.status} in ('planned','in_progress','blocked','completed','cancelled')`),
  check("activity_instances_timeliness_ck", sql`${table.timelinessStatus} in ('on_track','due_soon','overdue','completed_late')`),
]);

export const activityEvidenceRefs = sqliteTable("activity_evidence_refs", {
  id: text("id").primaryKey(),
  activityInstanceId: text("activity_instance_id").notNull().references(() => activityInstances.id),
  evidenceType: text("evidence_type").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  sourceCommandId: text("source_command_id"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("activity_evidence_refs_activity_idx").on(table.activityInstanceId), uniqueIndex("activity_evidence_refs_command_uq").on(table.sourceCommandId)]);

/** 不可变活动流转账本。 */
export const activityTransitions = sqliteTable("activity_transitions", {
  id: text("id").primaryKey(),
  activityInstanceId: text("activity_instance_id").notNull().references(() => activityInstances.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(),
  commandId: text("command_id"),
  domainEventId: text("domain_event_id").references(() => domainEvents.id),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("activity_transitions_activity_idx").on(table.activityInstanceId, table.occurredAt), uniqueIndex("activity_transitions_command_uq").on(table.commandId)]);

/** 命令幂等回执账本；同一 commandId 只能对应同一活动、操作者和请求指纹。 */
export const activityCommandReceipts = sqliteTable("activity_command_receipts", {
  commandId: text("command_id").primaryKey(),
  activityInstanceId: text("activity_instance_id").notNull().references(() => activityInstances.id),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  command: text("command").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  expectedVersion: integer("expected_version").notNull(),
  resultingVersion: integer("resulting_version").notNull(),
  resultingStatus: text("resulting_status").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("activity_command_receipts_activity_idx").on(table.activityInstanceId, table.createdAt)]);

/** 外部 ACT-BID 的只读本地投影。唯一事实仍归 sourceSystem。 */
export const externalActivityProjections = sqliteTable("external_activity_projections", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  definitionId: text("definition_id").notNull().references(() => activityDefinitions.id),
  sourceSystem: text("source_system").notNull(),
  externalActivityInstanceId: text("external_activity_instance_id").notNull(),
  ownerExternalId: text("owner_external_id").notNull(),
  ownerName: text("owner_name").notNull(),
  status: text("status").notNull(),
  plannedStart: text("planned_start"),
  plannedEnd: text("planned_end"),
  actualStart: text("actual_start"),
  actualEnd: text("actual_end"),
  businessObjectRefs: text("business_object_refs", { mode: "json" }).$type<Array<Record<string, string>>>().notNull(),
  evidenceRefs: text("evidence_refs", { mode: "json" }).$type<string[]>().notNull(),
  blocker: text("blocker"),
  completionEvent: text("completion_event"),
  sourceEventId: text("source_event_id"),
  environment: text("environment").notNull(),
  simulated: integer("simulated", { mode: "boolean" }).notNull(),
  sourceUpdatedAt: text("source_updated_at").notNull(),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (table) => [
  uniqueIndex("external_activity_projections_source_uq").on(table.sourceSystem, table.externalActivityInstanceId),
  index("external_activity_projections_project_idx").on(table.projectId, table.status),
  check("external_activity_projections_status_ck", sql`${table.status} in ('pending','accepted','in_progress','blocked','completed','returned','rejected','cancelled')`),
]);

export const projectStrategyVersions = sqliteTable("project_strategy_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), status: text("status").notNull().default("draft"), decisionPreference: text("decision_preference").notNull(), objective: text("objective").notNull(), competitiveAssessment: text("competitive_assessment").notNull(), strategyPayload: text("strategy_payload", { mode: "json" }).$type<Record<string, unknown>>(), evidenceRef: text("evidence_ref").notNull(), createdBy: text("created_by").notNull().references(() => users.id), approvedBy: text("approved_by").references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("project_strategy_versions_uq").on(table.projectId, table.version), index("project_strategy_versions_project_idx").on(table.projectId, table.status)]);

/** 项目计划锚点。计划由项目侧维护，实际状态可由权威领域事件回写。 */
export const projectMilestones = sqliteTable("project_milestones", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), title: text("title").notNull(), milestoneType: text("milestone_type").notNull(), ownerName: text("owner_name").notNull(), plannedAt: text("planned_at").notNull(), actualAt: text("actual_at"), status: text("status").notNull().default("planned"), completionCriteria: text("completion_criteria").notNull(), evidenceRequirement: text("evidence_requirement").notNull(), evidenceRef: text("evidence_ref"), dependencyRef: text("dependency_ref"), sourceType: text("source_type").notNull().default("management"), sourceRef: text("source_ref"), changeReason: text("change_reason"), version: integer("version").notNull().default(1), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [index("project_milestones_project_date_idx").on(table.projectId, table.plannedAt), check("project_milestones_status_ck", sql`${table.status} in ('planned','in_progress','blocked','completed','cancelled')`), check("project_milestones_source_ck", sql`${table.sourceType} in ('management','gate','external_event')`)]);

export const customerRelationshipRecords = sqliteTable("customer_relationship_records", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), layer: text("layer").notNull(), personName: text("person_name").notNull(), title: text("title").notNull(), attitude: text("attitude").notNull(), influence: text("influence").notNull(), ownerName: text("owner_name").notNull(), evidenceRef: text("evidence_ref").notNull(), lastTouchAt: text("last_touch_at").notNull(), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [index("customer_relationship_records_project_idx").on(table.projectId, table.layer), check("customer_relationship_records_layer_ck", sql`${table.layer} in ('客户高层','商务决策链','技术层')`)]);

/** 项目侧已经核实的竞争事实。线索候选不能直接写入本表。 */
export const projectCompetitorFacts = sqliteTable("project_competitor_facts", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), competitorName: text("competitor_name").notNull(), competitorRole: text("competitor_role").notNull(), relationshipScore: integer("relationship_score").notNull(), technicalScore: integer("technical_score").notNull(), priceScore: integer("price_score").notNull(), deliveryScore: integer("delivery_score").notNull(), serviceScore: integer("service_score").notNull(), confidence: text("confidence").notNull(), evidenceRef: text("evidence_ref").notNull(), observedAt: text("observed_at").notNull(), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [
  index("project_competitor_facts_project_idx").on(table.projectId, table.observedAt),
  check("project_competitor_facts_role_ck", sql`${table.competitorRole} in ('主要对手','低价挑战者','在位供应商','替代方案')`),
  check("project_competitor_facts_confidence_ck", sql`${table.confidence} in ('高','中','低')`),
]);

/** “需要伙伴/不需要伙伴”本身是可审计判断，不能由是否存在伙伴记录反向猜测。 */
export const partnerNeedDecisions = sqliteTable("partner_need_decisions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), decision: text("decision").notNull(), reason: text("reason").notNull(), evidenceRef: text("evidence_ref").notNull(), decidedBy: text("decided_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("partner_need_decisions_project_uq").on(table.projectId)]);

/** 经营伙伴与EPC客户严格分离；伙伴只有经证据验证后才可视为可用。 */
export const partnerEngagements = sqliteTable("partner_engagements", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), partnerName: text("partner_name").notNull(), partnerType: text("partner_type").notNull(), needStatus: text("need_status").notNull(), verificationStatus: text("verification_status").notNull().default("candidate"), verificationEvidenceRef: text("verification_evidence_ref").notNull(), verificationDecisionEvidenceRef: text("verification_decision_evidence_ref"), verificationComment: text("verification_comment"), verifiedBy: text("verified_by").references(() => users.id), verifiedAt: text("verified_at"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("partner_engagements_project_name_uq").on(table.projectId, table.partnerName), index("partner_engagements_project_status_idx").on(table.projectId, table.verificationStatus)]);

export const partnerContributions = sqliteTable("partner_contributions", {
  id: text("id").primaryKey(), partnerEngagementId: text("partner_engagement_id").notNull().references(() => partnerEngagements.id), projectId: text("project_id").notNull().references(() => salesProjects.id), contributionType: text("contribution_type").notNull(), result: text("result").notNull(), evidenceRef: text("evidence_ref").notNull(), occurredAt: text("occurred_at").notNull(), recordedBy: text("recorded_by").notNull().references(() => users.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("partner_contributions_project_idx").on(table.projectId, table.occurredAt)]);

/** G7只读下游事件；状态含义由来源系统给出，本系统不据此臆造经营关闭阈值。 */
export const downstreamBusinessEvents = sqliteTable("downstream_business_events", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), sourceSystem: text("source_system").notNull(), sourceEventId: text("source_event_id").notNull(), externalTaskId: text("external_task_id").notNull(), objectType: text("object_type").notNull(), objectRef: text("object_ref").notNull(), eventType: text("event_type").notNull(), businessStatus: text("business_status").notNull(), amountCents: integer("amount_cents"), currency: text("currency"), evidenceRef: text("evidence_ref").notNull(), occurredAt: text("occurred_at").notNull(), environment: text("environment").notNull().default("demo"), simulated: integer("simulated", { mode: "boolean" }).notNull().default(true), payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("downstream_business_events_source_uq").on(table.sourceSystem, table.sourceEventId), index("downstream_business_events_project_idx").on(table.projectId, table.objectType, table.occurredAt)]);

export const roleAssignments = sqliteTable("role_assignments", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), roleName: text("role_name").notNull(), assigneeName: text("assignee_name").notNull(), status: text("status").notNull(), required: integer("required", { mode: "boolean" }).notNull().default(true), evidenceRef: text("evidence_ref").notNull(), acceptedAt: text("accepted_at"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("role_assignments_project_role_uq").on(table.projectId, table.roleName), index("role_assignments_project_idx").on(table.projectId, table.status)]);

/** 销售Owner提出的资源需求。申请、主管指派和专业人员接受是三个不同事实。 */
export const resourceRequests = sqliteTable("resource_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  roleName: text("role_name").notNull(),
  requirement: text("requirement").notNull(),
  requiredBy: text("required_by").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  assignmentId: text("assignment_id").references(() => roleAssignments.id),
  fulfilledAt: text("fulfilled_at"),
  ...timestamps,
}, (table) => [
  index("resource_requests_project_status_idx").on(table.projectId, table.status),
  uniqueIndex("resource_requests_project_role_open_uq").on(table.projectId, table.roleName).where(sql`${table.status} in ('pending','assigned')`),
  check("resource_requests_status_ck", sql`${table.status} in ('pending','assigned','fulfilled','cancelled')`),
]);

/** 项目角色候选清单。候选、最终指派与本人接受必须分开留痕。 */
export const resourceCandidates = sqliteTable("resource_candidates", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  roleName: text("role_name").notNull(),
  candidateName: text("candidate_name").notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceRef: text("source_ref").notNull(),
  capabilities: text("capabilities", { mode: "json" }).$type<string[]>().notNull(),
  loadPercent: integer("load_percent"),
  activeProjectCount: integer("active_project_count"),
  availableFrom: text("available_from"),
  status: text("status").notNull().default("candidate"),
  evidenceRef: text("evidence_ref").notNull(),
  proposedBy: text("proposed_by").notNull().references(() => users.id),
  selectedBy: text("selected_by").references(() => users.id),
  selectedAt: text("selected_at"),
  environment: text("environment").notNull().default("demo"),
  simulated: integer("simulated", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  uniqueIndex("resource_candidates_project_role_name_uq").on(table.projectId, table.roleName, table.candidateName),
  index("resource_candidates_project_role_idx").on(table.projectId, table.roleName, table.status),
  check("resource_candidates_status_ck", sql`${table.status} in ('candidate','selected','rejected','withdrawn')`),
  check("resource_candidates_load_ck", sql`${table.loadPercent} is null or (${table.loadPercent} >= 0 and ${table.loadPercent} <= 100)`),
]);

/** 本系统权威的项目经营风险台账；关闭必须保留处置结论和证据。 */
export const projectRisks = sqliteTable("project_risks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  category: text("category").notNull(),
  title: text("title").notNull(),
  level: text("level").notNull(),
  description: text("description").notNull(),
  impact: text("impact").notNull(),
  ownerName: text("owner_name").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("open"),
  evidenceRef: text("evidence_ref").notNull(),
  resolution: text("resolution"),
  closureEvidenceRef: text("closure_evidence_ref"),
  mitigationActivityId: text("mitigation_activity_id").references(() => activityInstances.id),
  closedBy: text("closed_by").references(() => users.id),
  closedAt: text("closed_at"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  index("project_risks_project_status_idx").on(table.projectId, table.status, table.level),
  check("project_risks_level_ck", sql`${table.level} in ('低','中','高','重大')`),
  check("project_risks_status_ck", sql`${table.status} in ('open','mitigating','closed')`),
]);

/** 风险状态不可变流转账本。 */
export const projectRiskTransitions = sqliteTable("project_risk_transitions", {
  id: text("id").primaryKey(),
  riskId: text("risk_id").notNull().references(() => projectRisks.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("project_risk_transitions_risk_idx").on(table.riskId, table.occurredAt)]);

/** G5同一次商务决策中对重大/高等级剩余风险的显式接受记录，不形成额外Gate。 */
export const gateRiskAcceptances = sqliteTable("gate_risk_acceptances", {
  id: text("id").primaryKey(),
  riskId: text("risk_id").notNull().references(() => projectRisks.id),
  gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id),
  gateVersion: integer("gate_version").notNull(),
  riskVersion: integer("risk_version").notNull(),
  riskLevel: text("risk_level").notNull(),
  acceptanceReason: text("acceptance_reason").notNull(),
  acceptedBy: text("accepted_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("gate_risk_acceptances_risk_gate_version_uq").on(table.riskId, table.gateInstanceId, table.gateVersion),
  index("gate_risk_acceptances_gate_idx").on(table.gateInstanceId, table.gateVersion),
  check("gate_risk_acceptances_level_ck", sql`${table.riskLevel} in ('高','重大')`),
]);

export const solutionPreparationRecords = sqliteTable("solution_preparation_records", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), requirementGaps: text("requirement_gaps").notNull(), technicalDifficulty: text("technical_difficulty").notNull(), solutionResourceNeeds: text("solution_resource_needs").notNull(), evidenceRef: text("evidence_ref").notNull(), sourceSystem: text("source_system").notNull().default("TECHNICAL_COLLABORATION_SIMULATOR"), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("solution_preparation_records_uq").on(table.projectId, table.version), index("solution_preparation_records_project_idx").on(table.projectId, table.status)]);

/** 投标作业APP权威的标书/询价拆解、投标策略与工作计划；销售项目APP只读引用。 */
export const bidPreparationVersions = sqliteTable("bid_preparation_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), scenarioCode: text("scenario_code").notNull(), sourceType: text("source_type").notNull(), sourceRef: text("source_ref").notNull(), sourceVersion: text("source_version").notNull(), sourceHash: text("source_hash"), bidRoundId: text("bid_round_id").references(() => bidRounds.id), technicalRequirements: text("technical_requirements").notNull(), commercialRequirements: text("commercial_requirements").notNull(), evaluationCriteria: text("evaluation_criteria").notNull(), qualificationRequirements: text("qualification_requirements").notNull(), identifiedRisks: text("identified_risks").notNull(), bidStrategy: text("bid_strategy").notNull(), workPlan: text("work_plan").notNull(), evidenceRef: text("evidence_ref").notNull(), sourceSystem: text("source_system").notNull().default("BID_COLLABORATION_SIMULATOR"), status: text("status").notNull().default("effective"), preparedBy: text("prepared_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("bid_preparation_project_version_uq").on(table.projectId, table.version), index("bid_preparation_project_status_idx").on(table.projectId, table.status), check("bid_preparation_source_type_ck", sql`${table.sourceType} in ('TenderRequest','EPCInquiry','DirectRFQ')`), check("bid_preparation_status_ck", sql`${table.status} in ('effective','superseded')`)]);

/** 商务经理形成的商务响应与偏差版本；报价清单只保存权威引用，最终价格仍由核价与授权对象控制。 */
export const commercialSolutionVersions = sqliteTable("commercial_solution_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), bidPreparationVersionId: text("bid_preparation_version_id").notNull().references(() => bidPreparationVersions.id), paymentTerms: text("payment_terms").notNull(), deliveryTerms: text("delivery_terms").notNull(), guaranteeTerms: text("guarantee_terms").notNull(), breachLiability: text("breach_liability").notNull(), pricingStrategy: text("pricing_strategy").notNull(), quotationListRef: text("quotation_list_ref").notNull(), commercialDeviations: text("commercial_deviations").notNull(), riskAssessment: text("risk_assessment").notNull(), mitigationPlan: text("mitigation_plan").notNull(), costingStatus: text("costing_status").notNull().default("pending_costing"), evidenceRef: text("evidence_ref").notNull(), sourceSystem: text("source_system").notNull().default("BID_COLLABORATION_SIMULATOR"), status: text("status").notNull().default("effective"), preparedBy: text("prepared_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("commercial_solution_project_version_uq").on(table.projectId, table.version), index("commercial_solution_project_status_idx").on(table.projectId, table.status), check("commercial_solution_costing_status_ck", sql`${table.costingStatus} in ('pending_costing','costing_confirmed')`), check("commercial_solution_status_ck", sql`${table.status} in ('effective','superseded')`)]);

export const customerRequirementVersions = sqliteTable("customer_requirement_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), clarificationPackageId: text("clarification_package_id").references(() => requirementClarificationPackages.id), originalText: text("original_text").notNull(), sourceRef: text("source_ref").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("customer_requirement_versions_uq").on(table.projectId, table.version), index("customer_requirement_versions_project_idx").on(table.projectId, table.status)]);

export const requirementClarificationPackages = sqliteTable("requirement_clarification_packages", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), originalText: text("original_text").notNull(), sourceRef: text("source_ref").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("requirement_clarification_packages_uq").on(table.projectId, table.version), index("requirement_clarification_packages_project_idx").on(table.projectId, table.status), check("requirement_clarification_packages_status_ck", sql`${table.status} in ('effective','superseded')`)]);

export const technicalSolutionVersions = sqliteTable("technical_solution_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), requirementVersionId: text("requirement_version_id").notNull().references(() => customerRequirementVersions.id), standardizedRequirement: text("standardized_requirement").notNull(), designAdoptedValue: text("design_adopted_value").notNull(), criticalParameterStatus: text("critical_parameter_status").notNull(), initialTechnicalSolution: text("initial_technical_solution").notNull(), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), approvedBy: text("approved_by").references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("technical_solution_versions_uq").on(table.projectId, table.version), index("technical_solution_versions_project_idx").on(table.projectId, table.status), check("technical_solution_versions_critical_ck", sql`${table.criticalParameterStatus} in ('完整','存在缺失')`)]);

export const technicalClarificationItems = sqliteTable("technical_clarification_items", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), requirementVersionId: text("requirement_version_id").notNull().references(() => customerRequirementVersions.id), solutionVersionId: text("solution_version_id").notNull().references(() => technicalSolutionVersions.id), question: text("question").notNull(), response: text("response").notNull(), status: text("status").notNull(), ownerRole: text("owner_role"), closureEvidenceRef: text("closure_evidence_ref"), closedBy: text("closed_by").references(() => users.id), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [index("technical_clarification_items_project_idx").on(table.projectId, table.status), check("technical_clarification_items_status_ck", sql`${table.status} in ('open','resolved')`)]);

export const technicalDeviationRecords = sqliteTable("technical_deviation_records", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), solutionVersionId: text("solution_version_id").notNull().references(() => technicalSolutionVersions.id), description: text("description").notNull(), status: text("status").notNull(), evidenceRef: text("evidence_ref").notNull(), ownerRole: text("owner_role"), disposition: text("disposition"), closureEvidenceRef: text("closure_evidence_ref"), closedBy: text("closed_by").references(() => users.id), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [index("technical_deviation_records_project_idx").on(table.projectId, table.status), check("technical_deviation_records_status_ck", sql`${table.status} in ('none','recorded')`)]);

export const quotationDesignBomVersions = sqliteTable("quotation_design_bom_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), technicalSolutionVersionId: text("technical_solution_version_id").notNull().references(() => technicalSolutionVersions.id), configurationSummary: text("configuration_summary").notNull(), confirmationStatus: text("confirmation_status").notNull(), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), approvedBy: text("approved_by").references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("quotation_design_bom_versions_uq").on(table.projectId, table.version), index("quotation_design_bom_versions_project_idx").on(table.projectId, table.status), check("quotation_design_bom_confirmation_ck", sql`${table.confirmationStatus} in ('confirmed','unconfirmed')`)]);

/** 版本间可逐项比对的业务事实；摘要字段不得代替本表形成一致性结论。 */
export const artifactBaselineItems = sqliteTable("artifact_baseline_items", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), fieldCode: text("field_code").notNull(), fieldLabel: text("field_label").notNull(), artifactKind: text("artifact_kind").notNull(), artifactVersionId: text("artifact_version_id").notNull(), valueText: text("value_text").notNull(), unit: text("unit"), applicability: text("applicability").notNull().default("applicable"), sourceSystem: text("source_system").notNull(), evidenceRef: text("evidence_ref").notNull(), simulated: integer("simulated", { mode: "boolean" }).notNull().default(false), status: text("status").notNull().default("effective"), ...timestamps,
}, (table) => [uniqueIndex("artifact_baseline_items_version_field_uq").on(table.artifactKind, table.artifactVersionId, table.fieldCode), index("artifact_baseline_items_project_idx").on(table.projectId, table.status, table.fieldCode), check("artifact_baseline_items_kind_ck", sql`${table.artifactKind} in ('requirement','solution_bom','costing_pricing','bid_submission')`), check("artifact_baseline_items_applicability_ck", sql`${table.applicability} in ('applicable','not_applicable','unknown')`), check("artifact_baseline_items_status_ck", sql`${table.status} in ('effective','superseded')`)]);

export const pricingSnapshotVersions = sqliteTable("pricing_snapshot_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), source: text("source").notNull(), sourceVersion: text("source_version"), snapshotDate: text("snapshot_date").notNull(), validUntil: text("valid_until").notNull(), currency: text("currency").notNull().default("CNY"), taxBasis: text("tax_basis"), tradeTerms: text("trade_terms"), exchangeRateBasis: text("exchange_rate_basis"), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("pricing_snapshot_versions_uq").on(table.projectId, table.version), index("pricing_snapshot_versions_project_idx").on(table.projectId, table.status)]);

export const costingSolutionVersions = sqliteTable("costing_solution_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), technicalSolutionVersionId: text("technical_solution_version_id").notNull().references(() => technicalSolutionVersions.id), designBomVersionId: text("design_bom_version_id").notNull().references(() => quotationDesignBomVersions.id), pricingSnapshotId: text("pricing_snapshot_id").notNull().references(() => pricingSnapshotVersions.id), materialCostCents: integer("material_cost_cents").notNull(), laborCostCents: integer("labor_cost_cents").notNull(), manufacturingCostCents: integer("manufacturing_cost_cents").notNull(), transportCostCents: integer("transport_cost_cents").notNull(), taxCostCents: integer("tax_cost_cents").notNull(), riskReserveCents: integer("risk_reserve_cents").notNull(), costingSalesPriceCents: integer("costing_sales_price_cents").notNull(), targetProfitRateBp: integer("target_profit_rate_bp").notNull(), grossMarginBp: integer("gross_margin_bp").notNull(), calculationBasis: text("calculation_basis").notNull(), deliveryAssessment: text("delivery_assessment").notNull(), deliveryRiskConclusion: text("delivery_risk_conclusion").notNull(), status: text("status").notNull().default("effective"), createdBy: text("created_by").notNull().references(() => users.id), approvedBy: text("approved_by").references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("costing_solution_versions_uq").on(table.projectId, table.version), index("costing_solution_versions_project_idx").on(table.projectId, table.status), check("costing_solution_nonnegative_ck", sql`${table.materialCostCents} >= 0 and ${table.laborCostCents} >= 0 and ${table.manufacturingCostCents} >= 0 and ${table.transportCostCents} >= 0 and ${table.taxCostCents} >= 0 and ${table.riskReserveCents} >= 0 and ${table.costingSalesPriceCents} > 0`)]);

export const pricingAuthorizations = sqliteTable("pricing_authorizations", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), costingSolutionVersionId: text("costing_solution_version_id").notNull().references(() => costingSolutionVersions.id), pricingSnapshotId: text("pricing_snapshot_id").references(() => pricingSnapshotVersions.id), floorPriceCents: integer("floor_price_cents").notNull(), authorizedQuotePriceCents: integer("authorized_quote_price_cents").notNull(), currency: text("currency"), taxBasis: text("tax_basis"), tradeTerms: text("trade_terms"), routeScope: text("route_scope").notNull(), exceptionConditions: text("exception_conditions"), scopeAlignmentConclusion: text("scope_alignment_conclusion"), amountVarianceExplanation: text("amount_variance_explanation"), validUntil: text("valid_until").notNull(), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("effective"), authorizedBy: text("authorized_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("pricing_authorizations_uq").on(table.projectId, table.version), index("pricing_authorizations_project_idx").on(table.projectId, table.status), check("pricing_authorizations_amount_ck", sql`${table.floorPriceCents} > 0 and ${table.authorizedQuotePriceCents} >= ${table.floorPriceCents}`)]);

export const priceAuthorizationRequests = sqliteTable("price_authorization_requests", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), gateVersion: integer("gate_version").notNull(), costingSolutionVersionId: text("costing_solution_version_id").notNull().references(() => costingSolutionVersions.id), pricingSnapshotId: text("pricing_snapshot_id").notNull().references(() => pricingSnapshotVersions.id), proposedQuotePriceCents: integer("proposed_quote_price_cents").notNull(), currency: text("currency").notNull(), taxBasis: text("tax_basis").notNull(), tradeTerms: text("trade_terms").notNull(), proposedRouteScope: text("proposed_route_scope").notNull(), status: text("status").notNull().default("pending"), requestedBy: text("requested_by").notNull().references(() => users.id), decidedAuthorizationId: text("decided_authorization_id").references(() => pricingAuthorizations.id), ...timestamps,
}, (table) => [uniqueIndex("price_authorization_requests_gate_version_uq").on(table.gateInstanceId, table.gateVersion), index("price_authorization_requests_project_status_idx").on(table.projectId, table.status)]);

/** EPC询价场景下同一SalesProject的对客报价通路；项目金额不随通路相加。 */
export const quotationRoutes = sqliteTable("quotation_routes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  epcCustomer: text("epc_customer").notNull(),
  inquiryRef: text("inquiry_ref").notNull(),
  inquiryDate: text("inquiry_date").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  uniqueIndex("quotation_routes_project_customer_uq").on(table.projectId, table.epcCustomer),
  index("quotation_routes_project_status_idx").on(table.projectId, table.status),
  check("quotation_routes_status_ck", sql`${table.status} in ('active','withdrawn','closed')`),
]);

/** EPC通路偏离项目统一报价时的受控价格例外；批准人必须是价格授权人。 */
export const epcPriceExceptions = sqliteTable("epc_price_exceptions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  routeId: text("route_id").notNull().references(() => quotationRoutes.id),
  pricingAuthorizationId: text("pricing_authorization_id").notNull().references(() => pricingAuthorizations.id),
  requestedPriceCents: integer("requested_price_cents").notNull(),
  reason: text("reason").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  validUntil: text("valid_until").notNull(),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  decidedBy: text("decided_by").references(() => users.id),
  decisionComment: text("decision_comment"),
  decidedAt: text("decided_at"),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [
  index("epc_price_exceptions_route_status_idx").on(table.routeId, table.status),
  uniqueIndex("epc_price_exceptions_route_open_uq").on(table.routeId).where(sql`${table.status} in ('pending','approved')`),
  check("epc_price_exceptions_status_ck", sql`${table.status} in ('pending','approved','returned','rejected','superseded')`),
  check("epc_price_exceptions_price_ck", sql`${table.requestedPriceCents} > 0`),
]);

/** G5快照冻结后的受控解冻申请；只允许在尚无正式对客回执时撤销当前批次授权。 */
export const g5ReopenRequests = sqliteTable("g5_reopen_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id),
  gateVersion: integer("gate_version").notNull(),
  changeType: text("change_type").notNull(),
  routeId: text("route_id"),
  reason: text("reason").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  decidedBy: text("decided_by").references(() => users.id),
  decisionComment: text("decision_comment"),
  decidedAt: text("decided_at"),
  ...timestamps,
}, (table) => [
  index("g5_reopen_requests_project_status_idx").on(table.projectId, table.status),
  uniqueIndex("g5_reopen_requests_project_open_uq").on(table.projectId).where(sql`${table.status} = 'pending'`),
  check("g5_reopen_requests_change_type_ck", sql`${table.changeType} in ('add_route','withdraw_route','route_material_change','route_price_change')`),
  check("g5_reopen_requests_status_ck", sql`${table.status} in ('pending','approved','returned','rejected')`),
]);

export const g5ReopenDecisions = sqliteTable("g5_reopen_decisions", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => g5ReopenRequests.id),
  decision: text("decision").notNull(),
  comment: text("comment").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("g5_reopen_decisions_request_uq").on(table.requestId),
  check("g5_reopen_decisions_decision_ck", sql`${table.decision} in ('approve','return','reject')`),
]);

export const bidPackageVersions = sqliteTable("bid_package_versions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), version: integer("version").notNull(), costingSolutionVersionId: text("costing_solution_version_id").notNull().references(() => costingSolutionVersions.id), pricingAuthorizationId: text("pricing_authorization_id").notNull().references(() => pricingAuthorizations.id), submissionType: text("submission_type").notNull(), routeId: text("route_id").notNull(), quotedPriceCents: integer("quoted_price_cents").notNull(), packageHash: text("package_hash").notNull(), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("prepared"), createdBy: text("created_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("bid_package_versions_uq").on(table.projectId, table.version), uniqueIndex("bid_package_versions_hash_uq").on(table.packageHash), index("bid_package_versions_project_idx").on(table.projectId, table.status), check("bid_package_versions_price_ck", sql`${table.quotedPriceCents} > 0`)]);

export const professionalReviews = sqliteTable("professional_reviews", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), bidPackageVersionId: text("bid_package_version_id").notNull().references(() => bidPackageVersions.id), reviewType: text("review_type").notNull(), version: integer("version").notNull().default(1), status: text("status").notNull().default("effective"), remediationId: text("remediation_id"), conclusion: text("conclusion").notNull(), openRiskCount: integer("open_risk_count").notNull(), deviationConclusion: text("deviation_conclusion").notNull(), reviewSummary: text("review_summary").notNull(), evidenceRef: text("evidence_ref").notNull(), reviewedBy: text("reviewed_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("professional_reviews_effective_package_type_uq").on(table.bidPackageVersionId, table.reviewType).where(sql`${table.status} = 'effective'`), check("professional_reviews_risk_ck", sql`${table.openRiskCount} >= 0`), check("professional_reviews_deviation_ck", sql`${table.deviationConclusion} in ('none','authorized')`)]);

export const professionalReviewRemediations = sqliteTable("professional_review_remediations", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), professionalReviewId: text("professional_review_id").notNull().references(() => professionalReviews.id), bidPackageVersionId: text("bid_package_version_id").notNull().references(() => bidPackageVersions.id), reviewType: text("review_type").notNull(), issueResponse: text("issue_response").notNull(), evidenceRef: text("evidence_ref").notNull(), status: text("status").notNull().default("submitted"), submittedBy: text("submitted_by").notNull().references(() => users.id), verifiedBy: text("verified_by").references(() => users.id), verificationComment: text("verification_comment"), ...timestamps,
}, (table) => [uniqueIndex("professional_review_remediations_review_uq").on(table.professionalReviewId), index("professional_review_remediations_project_idx").on(table.projectId, table.status)]);

export const g5DeviationAuthorizations = sqliteTable("g5_deviation_authorizations", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), gateVersion: integer("gate_version").notNull(), deviationRef: text("deviation_ref").notNull(), deviationSourceType: text("deviation_source_type").notNull(), scope: text("scope").notNull(), risk: text("risk").notNull(), applicableVersionId: text("applicable_version_id").notNull(), validUntil: text("valid_until").notNull(), evidenceRef: text("evidence_ref").notNull(), authorizedBy: text("authorized_by").notNull().references(() => users.id), ...timestamps,
}, (table) => [uniqueIndex("g5_deviation_authorizations_gate_version_ref_uq").on(table.gateInstanceId, table.gateVersion, table.deviationRef), index("g5_deviation_authorizations_project_version_idx").on(table.projectId, table.gateVersion)]);

export const contractHandoverReturns = sqliteTable("contract_handover_returns", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), gateVersion: integer("gate_version").notNull(), awardBaselineId: text("award_baseline_id").notNull(), differenceSummary: text("difference_summary").notNull(), remediationRequirement: text("remediation_requirement").notNull(), returnEvidenceRef: text("return_evidence_ref").notNull(), status: text("status").notNull().default("pending"), resolutionSummary: text("resolution_summary"), resolutionEvidenceRef: text("resolution_evidence_ref"), resolvedBy: text("resolved_by").references(() => users.id), resolvedAt: text("resolved_at"), ...timestamps,
}, (table) => [uniqueIndex("contract_handover_returns_gate_version_uq").on(table.gateInstanceId, table.gateVersion), index("contract_handover_returns_project_status_idx").on(table.projectId, table.status)]);

export const commercialSubmissions = sqliteTable("commercial_submissions", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), gateInstanceId: text("gate_instance_id").notNull().references(() => stageGateInstances.id), gateVersion: integer("gate_version").notNull(), bidPackageVersionId: text("bid_package_version_id").notNull().references(() => bidPackageVersions.id), submissionType: text("submission_type").notNull(), routeId: text("route_id").notNull(), quotedPriceCents: integer("quoted_price_cents").notNull(), packageHash: text("package_hash").notNull(), submittedBy: text("submitted_by").notNull().references(() => users.id), submittedAt: text("submitted_at").notNull(), receiptRef: text("receipt_ref").notNull(), receiptHash: text("receipt_hash").notNull(), status: text("status").notNull().default("accepted"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("commercial_submissions_gate_version_route_uq").on(table.gateInstanceId, table.gateVersion, table.routeId), uniqueIndex("commercial_submissions_receipt_uq").on(table.receiptRef), index("commercial_submissions_project_idx").on(table.projectId, table.createdAt)]);

/** 每条已提交报价通路的外部结果事实；项目级won/lost由系统汇总后写入commercial_result_notices。 */
export const quotationRouteResults = sqliteTable("quotation_route_results", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => salesProjects.id),
  routeId: text("route_id").notNull(),
  commercialSubmissionId: text("commercial_submission_id").notNull().references(() => commercialSubmissions.id),
  resultType: text("result_type").notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceRef: text("source_ref").notNull(),
  noticeDate: text("notice_date").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  awardScope: text("award_scope"),
  competitorName: text("competitor_name"),
  supersedesResultId: text("supersedes_result_id"),
  correctionReason: text("correction_reason"),
  status: text("status").notNull().default("effective"),
  recordedBy: text("recorded_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  uniqueIndex("quotation_route_results_source_uq").on(table.sourceSystem, table.sourceRef),
  uniqueIndex("quotation_route_results_project_route_effective_uq").on(table.projectId, table.routeId).where(sql`${table.status}='effective'`),
  index("quotation_route_results_project_status_idx").on(table.projectId, table.status),
  index("quotation_route_results_route_status_idx").on(table.routeId, table.status),
  index("quotation_route_results_supersedes_idx").on(table.supersedesResultId),
  check("quotation_route_results_result_type_ck", sql`${table.resultType} in ('won','lost')`),
  check("quotation_route_results_status_ck", sql`${table.status} in ('effective','superseded')`),
]);

/** @deprecated 仅用于0009之前的历史审计；运行态统一使用 stageGateInstances。 */
export const stageExitReviews = sqliteTable("stage_exit_reviews", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), sourceStage: text("source_stage").notNull(), targetStage: text("target_stage").notNull(), status: text("status").notNull().default("pending"), snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(), requestedBy: text("requested_by").notNull().references(() => users.id), requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`), reviewedBy: text("reviewed_by").references(() => users.id), reviewComment: text("review_comment"), reviewedAt: text("reviewed_at"), version: integer("version").notNull().default(1), ...timestamps,
}, (table) => [uniqueIndex("stage_exit_reviews_project_stage_uq").on(table.projectId, table.sourceStage), index("stage_exit_reviews_status_idx").on(table.status, table.sourceStage), check("stage_exit_reviews_status_ck", sql`${table.status} in ('pending','returned','approved')`)]);

/** @deprecated 仅用于0009之前的历史审计；运行态统一使用 gateDecisions。 */
export const stageExitReviewDecisions = sqliteTable("stage_exit_review_decisions", {
  id: text("id").primaryKey(), reviewId: text("review_id").notNull().references(() => stageExitReviews.id), reviewVersion: integer("review_version").notNull(), decision: text("decision").notNull(), comment: text("comment").notNull(), actorUserId: text("actor_user_id").notNull().references(() => users.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("stage_exit_review_decisions_review_idx").on(table.reviewId), uniqueIndex("stage_exit_review_decisions_version_uq").on(table.reviewId, table.reviewVersion)]);

export const externalTasks = sqliteTable("external_tasks", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), taskType: text("task_type").notNull(), targetSystem: text("target_system").notNull(), externalTaskId: text("external_task_id").notNull(), assigneeExternalId: text("assignee_external_id").notNull(), assigneeName: text("assignee_name").notNull(), status: text("status").notNull().default("pending"), environment: text("environment").notNull().default("demo"), simulated: integer("simulated", { mode: "boolean" }).notNull().default(true), requestPayload: text("request_payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(), resultPayload: text("result_payload", { mode: "json" }).$type<Record<string, unknown> | null>(), acceptedAt: text("accepted_at"), completedAt: text("completed_at"), ...timestamps,
}, (table) => [uniqueIndex("external_tasks_external_id_uq").on(table.externalTaskId), index("external_tasks_project_status_idx").on(table.projectId, table.status), check("external_tasks_status_ck", sql`${table.status} in ('pending','accepted','completed','returned','rejected','cancelled')`)]);

export const integrationOutbox = sqliteTable("integration_outbox", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => salesProjects.id), eventId: text("event_id").notNull(), eventType: text("event_type").notNull(), targetSystem: text("target_system").notNull(), externalTaskId: text("external_task_id").notNull(), payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(), status: text("status").notNull().default("pending"), attempts: integer("attempts").notNull().default(0), deliveredAt: text("delivered_at"), lastError: text("last_error"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("integration_outbox_event_id_uq").on(table.eventId), index("integration_outbox_status_idx").on(table.status, table.createdAt), check("integration_outbox_status_ck", sql`${table.status} in ('pending','delivered','failed')`)]);

export const integrationInbox = sqliteTable("integration_inbox", {
  id: text("id").primaryKey(), eventId: text("event_id").notNull(), sourceSystem: text("source_system").notNull(), eventType: text("event_type").notNull(), projectCode: text("project_code").notNull(), externalTaskId: text("external_task_id").notNull(), environment: text("environment").notNull(), simulated: integer("simulated", { mode: "boolean" }).notNull(), actorId: text("actor_id").notNull(), occurredAt: text("occurred_at").notNull(), payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(), processingStatus: text("processing_status").notNull().default("received"), processingError: text("processing_error"), receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`), processedAt: text("processed_at"),
}, (table) => [uniqueIndex("integration_inbox_event_id_uq").on(table.eventId), index("integration_inbox_project_idx").on(table.projectCode, table.receivedAt), check("integration_inbox_status_ck", sql`${table.processingStatus} in ('received','processed','rejected','duplicate')`)]);

export const integrationEventLogs = sqliteTable("integration_event_logs", {
  id: text("id").primaryKey(), inboxId: text("inbox_id").notNull().references(() => integrationInbox.id), action: text("action").notNull(), status: text("status").notNull(), detail: text("detail").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("integration_event_logs_inbox_idx").on(table.inboxId, table.createdAt)]);
