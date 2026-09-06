export const INTEGRATION_EVENT_TYPES = [
  "ExternalTaskAccepted",
  "BidPreparationCompleted",
  "CommercialSolutionCompleted",
  "SolutionPreparationCompleted",
  "RequirementBaselinePrepared",
  "TechnicalSolutionPrepared",
  "BomAndClosureCompleted",
  "G3DecisionSubmitted",
  "CostingAssessmentCompleted",
  "G4DecisionSubmitted",
  "EpcPriceExceptionDecisionSubmitted",
  "BidPackagePrepared",
  "BidPackageReviewSubmitted",
  "BidReviewRemediationSubmitted",
  "CommercialSubmissionAccepted",
  "CommercialResultReported",
  "ContractHandoverAccepted",
  "ContractHandoverReturned",
  "DownstreamBusinessStatusReported",
] as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number];

export type IntegrationEventEnvelope = {
  eventId: string;
  eventType: IntegrationEventType;
  sourceSystem: "TECHNICAL_COLLABORATION_SIMULATOR" | "COSTING_COLLABORATION_SIMULATOR" | "BID_COLLABORATION_SIMULATOR" | "CONTRACT_COLLABORATION_SIMULATOR";
  environment: "demo";
  simulated: true;
  projectCode: string;
  externalTaskId: string;
  actorId: "technical-zhao" | "requirement-owner-demo" | "solution-designer-demo" | "technical-reviewer-wang" | "costing-liu" | "authorizer-luo" | "bid-specialist-sun" | "commercial-manager-tang" | "professional-reviewer-wu" | "bid-technical-reviewer-qian" | "qualification-reviewer-he" | "contract-admin-liu";
  occurredAt: string;
  data: Record<string, unknown>;
  evidenceRefs: string[];
};

export type LeadConversionEventEnvelope = {
  eventId: string;
  eventType: "LeadQualifiedForConversion";
  sourceSystem: "LEAD_MANAGEMENT_SIMULATOR";
  environment: "demo";
  simulated: true;
  occurredAt: string;
  lead: {
    id: string;
    code: string;
    type: "tender" | "demand";
    category?: "客户线索" | "项目线索" | "伙伴线索";
    grade?: "S" | "A" | "B" | "C";
    score?: number;
    authenticityStatus: "verified" | "manual_confirmed";
    sourceChannel: string;
    assignedOwnerExternalId?: "sales-chen";
    assignedOwnerName?: string;
    submitterExternalId?: string;
    submitterName?: string;
    submittedAt?: string;
    authenticityBasis?: string;
    authenticityAssessment?: {
      dimensions: Array<{ name: string; score: number; maxScore: number; conclusion: string }>;
      totalScore: number;
      maxScore: number;
      conclusion: string;
      assessedAt?: string;
      assessor?: string;
    };
    gradeAssessment?: {
      dimensions: Partial<Record<"projectScale" | "industryValue" | "customerValue" | "regionValue" | "productValue", "S" | "A" | "B" | "C">>;
      basis?: string;
      ruleVersion?: string;
      manuallyAdjusted?: boolean;
    };
    majorProject?: { flagged: boolean; basis?: string; source: "rule" | "manual" | "both" };
  };
  opportunity: {
    projectName: string;
    customerName: string;
    finalCustomerName?: string;
    projectCountry?: string;
    deliveryCountry?: string;
    region?: string;
    industry?: string;
    productScope: string;
    quantity?: string;
    amount: { type: "exact" | "range" | "unknown"; minYuan?: number; maxYuan?: number; currency: "CNY" };
    procurementProgress?: string;
    procurementMethod?: "tender" | "epc_inquiry" | "direct_rfq" | "unknown";
    requestingPartyName?: string;
    requestingPartyRole?: "end_customer" | "epc" | "tender_agent" | "unknown";
    submissionRecipientName?: string;
    suggestedScenarioCode?: "SCN-01-DIRECT-BID" | "SCN-02-EPC-INQUIRY" | "SCN-03-DIRECT-RFQ" | "SCN-04-OVERSEAS-PARTNER-EPC";
    requestRef?: string;
    requestDate?: string;
    tenderNo?: string;
    lotNo?: string;
    deliveryLocation?: string;
    submissionDeadline?: string;
    competitorContext?: string;
    fundingSource?: string;
    projectPriority?: string;
    sourcePlatform?: string;
    sourceUrl?: string;
    customerMaster?: { code?: string; matchStatus: "matched" | "temporary" | "unmatched" };
  };
  /**
   * 线索培育阶段形成的客户初始需求事实。它在转化时冻结为只读快照，
   * 不是技术评审通过后的 CustomerRequirementBaseline。
   */
  initialRequirement: {
    originalText: string;
    productRequirement: string;
    quantity?: string;
    qualificationRequirements?: string;
    knownConstraints: string[];
    unknowns: string[];
    sourceRefs: string[];
  };
  /** 兼容旧版本地模拟器。正式V0.2不要求线索系统制定销售项目计划。 */
  salesRouting?: {
    organization: string;
    projectGradeSuggestion: "S" | "A" | "B" | "C";
    requirementDate: string;
    technicalDate: string;
    costingDate: string;
    firstAction: string;
  };
  evidenceRefs: string[];
  competitors: Array<{ name: string; source?: string; confidence?: "high" | "medium" | "low"; verification?: string }>;
  keyRoles: Array<{ name: string; position?: string; role?: string; attitude?: string; concern?: string; contact?: string; evidence?: string }>;
  partners: Array<{ name: string; type?: string; status?: string; role?: string; evidence?: string }>;
  contacts: Array<Record<string, unknown>>;
  followups: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  /** 线索培育团队或建议协同人，仅作项目资源候选，不能直接视为已指派或已到位。 */
  teamCandidates?: Array<{ name: string; department?: string; position?: string; suggestedRole?: string; status?: string; sourceRef?: string }>;
  parties?: Array<{
    externalPartyId?: string;
    masterCode?: string;
    name: string;
    role: "requesting_customer" | "end_customer" | "tendering_entity" | "tender_agent" | "design_institute" | "installation_contractor" | "epc" | "partner";
    country?: string;
    parentExternalPartyId?: string;
    masterStatus?: "matched" | "temporary" | "unmatched";
    evidence?: string;
  }>;
  duplicateCheck?: { status: "clear" | "suspected" | "confirmed_distinct"; checkedAt?: string; basis?: string; matchedLeadIds?: string[] };
  fieldProvenance: Record<string, unknown>;
};

export const BID_ROUND_EVENT_TYPES = ["BidRoundRegistered", "BidRoundStatusChanged"] as const;

export type BidRoundEventEnvelope = {
  eventId: string;
  eventType: (typeof BID_ROUND_EVENT_TYPES)[number];
  sourceSystem: "BID_MANAGEMENT_SIMULATOR";
  environment: "demo";
  simulated: true;
  projectCode: string;
  actorId: "bid-specialist-sun";
  occurredAt: string;
  data: {
    externalBidId: string;
    roundType?: "initial" | "rebid" | "supplement";
    status?: "active" | "on_hold" | "submitted" | "resulted" | "cancelled";
    tenderDocumentRef?: string;
    tenderDocumentVersion?: string;
    tenderDocumentHash?: string;
    bidDeadline?: string;
    evidenceRef?: string;
  };
  evidenceRefs: string[];
};

export type ExternalTaskView = {
  id: string;
  project_code: string;
  project_name: string;
  stage: string;
  stage_name: string;
  task_type: "BID_PREPARATION" | "COMMERCIAL_SOLUTION" | "TECHNICAL_COLLABORATION" | "REQUIREMENT_BASELINE_PREPARATION" | "TECHNICAL_SOLUTION_PREPARATION" | "BOM_AND_CLOSURE_PREPARATION" | "G3_GATE_REVIEW" | "COSTING_COLLABORATION" | "G4_GATE_REVIEW" | "EPC_PRICE_EXCEPTION_APPROVAL" | "BID_PACKAGE_PREPARATION" | "BID_PACKAGE_REVIEW" | "BID_REVIEW_REMEDIATION" | "G5_SUBMISSION_EXECUTION" | "COMMERCIAL_RESULT_TRACKING" | "CONTRACT_HANDOVER_EXECUTION" | "DOWNSTREAM_STATUS_TRACKING";
  external_task_id: string;
  assignee_external_id: string;
  assignee_name: string;
  status: "pending" | "accepted" | "completed" | "returned" | "rejected" | "cancelled";
  environment: "demo";
  simulated: number;
  request_payload: string | Record<string, unknown>;
  review_id?: string | null;
  review_status?: string | null;
  review_snapshot?: string | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
