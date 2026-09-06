/**
 * DP-02 V1.2 主业务流与《销售项目生命周期对齐 Gate 补充基线》的工程事实源。
 *
 * 这里是阶段、门禁、生命周期和首条审批流的唯一代码事实源。UI 不得自行定义
 * 另一套阶段或越过门禁直接修改阶段。
 */
export const PROJECT_STAGES = [
  { code: "S0", name: "待立项", output: "项目基本信息、采购意向证据、Owner" },
  { code: "S1", name: "立项与策略", output: "客户地图、赢单策略、资源计划" },
  { code: "S2", name: "需求与方案", output: "需求基线、技术方案、偏差清单" },
  { code: "S3", name: "核价评审", output: "核价方案、成本、毛利、交期评估" },
  { code: "S4", name: "定价与投标", output: "定价授权、投标版本、提交回执" },
  { code: "S5", name: "结果与移交", output: "中标基线或结构化丢标复盘" },
  { code: "S6", name: "赢单后跟踪", output: "合同、订单、交付、开票、回款只读状态" },
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number]["code"];

export const SCENARIO_TYPES = [
  { code: "SCN-01-DIRECT-BID", name: "国内正式招投标", requestType: "TenderRequest", submissionType: "DirectBidSubmission" },
  { code: "SCN-02-EPC-INQUIRY", name: "国内EPC询价", requestType: "EPCInquiry", submissionType: "CustomerRouteQuotation" },
  { code: "SCN-03-DIRECT-RFQ", name: "国内客户询价/报价", requestType: "DirectRFQ", submissionType: "DirectQuotation" },
  { code: "SCN-04-OVERSEAS-PARTNER-EPC", name: "海外伙伴/EPC询价", requestType: "EPCInquiry", submissionType: "CustomerRouteQuotation" },
] as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[number]["code"];

export function isEpcScenarioCode(code: string): boolean {
  return code === "SCN-02-EPC-INQUIRY" || code === "SCN-04-OVERSEAS-PARTNER-EPC";
}

export const STAGE_GATES = [
  { code: "G1", name: "立项门", stage: "S0", targetStage: "S1", ltcRange: "L2.1", salesInputs: "项目价值、等级、竞争初判、Owner", bidFeedback: "采购请求真实性、项目查重、交标日期", decisionOutput: "是否立项；形成统一SalesProjectID", stageExitEvent: "SalesProjectEstablished", decisionRole: "销售主管", interaction: "项目价值与Owner ↔ 采购请求、查重与交标日期 → 形成统一SalesProjectID" },
  { code: "G2", name: "投入启动门", stage: "S1", targetStage: "S2", ltcRange: "L2.2→L2.4", salesInputs: "首版赢单策略、客户决策链与关系覆盖、资源投入计划", bidFeedback: "采购/投报作业启动计划、需求与方案启动评估", decisionOutput: "批准详细专业作业的范围、优先级、责任资源与期限", stageExitEvent: "WorkInitiationApproved", decisionRole: "销售主管/授权人", interaction: "赢单策略、客户经营与资源投入 ↔ 采购/投报计划和专业启动评估 → 批准详细专业作业" },
  { code: "G3", name: "需求与技术基线门", stage: "S2", targetStage: "S3", ltcRange: "L2.4", salesInputs: "线索初始需求、需求澄清问题与客户答复", bidFeedback: "正式需求基线、技术方案、报价设计BOM、澄清与偏差闭环", decisionOutput: "独立评审并冻结可用于核价的需求与技术基线", stageExitEvent: "TechnicalBaselineApproved", decisionRole: "独立技术评审人", interaction: "初始需求与澄清 ↔ 正式需求基线、方案、BOM和偏差闭环 → 独立技术评审并冻结基线" },
  { code: "G4", name: "核价授权门", stage: "S3", targetStage: "S4", ltcRange: "L2.4→L2.6", salesInputs: "客户预算、竞争策略、报价通路、付款条件与商务假设", bidFeedback: "方案、报价BOM、成本、利润、底价、交期与风险结论", decisionOutput: "批准受控核价基线，作为商务决策输入", stageExitEvent: "CostingSolutionApproved", decisionRole: "财务/价格授权人", interaction: "预算、策略、通路与付款条件 ↔ BOM、成本、利润、底价与交期风险 → 批准核价基线" },
  { code: "G5", name: "商务决策与提交门", stage: "S4", targetStage: "S5", ltcRange: "L2.6→L2.8", salesInputs: "胜率、客户关系、竞争态势、最终商务策略、客户窗口与通路选择", bidFeedback: "专业评审、未关闭风险、偏差授权、最终价格、批准提交包、签审一致性与回执", decisionOutput: "决定投/不投或报/不报，并按批准版本完成正式提交", stageExitEvent: "CommercialSubmissionAccepted/BidDeclined", decisionRole: "销售主管/投标授权决策人", interaction: "经营判断与最终策略 ↔ 专业评审、价格授权和提交包 → 商务决策并完成受控提交" },
  { code: "G6", name: "结果与移交门", stage: "S5", targetStage: "S6", ltcRange: "L2.9", salesInputs: "客户反馈、竞争信息、关系变化与复盘材料", bidFeedback: "中标/未中标事实、中标承诺基线与合同接收结果", decisionOutput: "赢单移交或失标/终止复盘", stageExitEvent: "Won/Lost/Terminated", decisionRole: "销售主管", interaction: "客户反馈与复盘 ↔ 商业结果、承诺基线与接收结果 → 移交或关闭" },
  { code: "G7", name: "经营关闭门", stage: "S6", targetStage: null, ltcRange: "L2.9之后", salesInputs: "客户经营动作、催收责任与未完成行动", bidFeedback: "合同、订单、履约、验收、开票、回款与关闭只读事件", decisionOutput: "确认成交后责任完成并关闭经营跟踪", stageExitEvent: "CommercialProjectClosed", decisionRole: "系统汇总＋销售项目Owner", interaction: "客户经营动作与责任 ↔ 下游权威状态 → 完成经营关闭" },
] as const;

export type GateCode = (typeof STAGE_GATES)[number]["code"];

export const GATE_DEFINITION_VERSION = "LIFECYCLE_GATE_V4_DEMO_IMPLEMENTATION";

export type GateActivityReadinessPolicy = "in_progress_or_completed" | "completed" | "context";

export type GateActivityRequirement = {
  definitionCode: string;
  trackType: "SALES_PROJECT_MANAGEMENT" | "BID_OPERATION";
  purpose: string;
  readinessPolicy: GateActivityReadinessPolicy;
  hard: boolean;
};

/**
 * Gate只以活动实例作为过程一致性控制，业务对象及其版本仍是最终判定事实。
 * G2的经营活动持续贯穿后续阶段，因此只作为决策上下文；G3—G6的专业
 * 作业活动则必须完成，防止“对象已填但作业责任并未闭环”。
 */
export const GATE_ACTIVITY_REQUIREMENTS: Record<GateCode, readonly GateActivityRequirement[]> = {
  G1: [
    { definitionCode: "ACT-SPM-01", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "项目价值、等级和Owner确认", readinessPolicy: "in_progress_or_completed", hard: true },
  ],
  G2: [
    { definitionCode: "ACT-SPM-02", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "策略版本与经营假设", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-SPM-03", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "客户关系与决策链覆盖", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-SPM-04", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "关键资源到位", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-BID-02", trackType: "BID_OPERATION", purpose: "采购请求拆解、投标策略与工作计划", readinessPolicy: "completed", hard: true },
    { definitionCode: "ACT-BID-03", trackType: "BID_OPERATION", purpose: "商务条款响应、偏差与风险方案", readinessPolicy: "context", hard: false },
  ],
  G3: [
    { definitionCode: "ACT-SPM-05", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "需求澄清协调与客户经营动作", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-BID-04A", trackType: "BID_OPERATION", purpose: "需求解读与需求基线", readinessPolicy: "completed", hard: true },
    { definitionCode: "ACT-BID-04B", trackType: "BID_OPERATION", purpose: "技术方案与报价设计BOM", readinessPolicy: "completed", hard: true },
  ],
  G4: [
    { definitionCode: "ACT-SPM-06", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "核价阶段风险与例外跟踪", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-BID-04C", trackType: "BID_OPERATION", purpose: "方案核价与价格授权", readinessPolicy: "completed", hard: true },
  ],
  G5: [
    { definitionCode: "ACT-SPM-03", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "客户决策链与关系变化", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-SPM-05", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "项目运作与伙伴协同", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-SPM-06", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "风险处置与决策输入", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-BID-05", trackType: "BID_OPERATION", purpose: "投标/报价文件形成", readinessPolicy: "completed", hard: true },
    { definitionCode: "ACT-BID-06", trackType: "BID_OPERATION", purpose: "专业评审闭环", readinessPolicy: "completed", hard: true },
  ],
  G6: [
    { definitionCode: "ACT-SPM-07", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "结果衔接与结构化复盘", readinessPolicy: "context", hard: false },
    { definitionCode: "ACT-BID-09", trackType: "BID_OPERATION", purpose: "L2.9正式结果回传", readinessPolicy: "completed", hard: true },
  ],
  G7: [
    { definitionCode: "ACT-SPM-08", trackType: "SALES_PROJECT_MANAGEMENT", purpose: "成交后经营责任跟踪", readinessPolicy: "in_progress_or_completed", hard: true },
  ],
};

export type GateActivitySnapshotItem = GateActivityRequirement & {
  sourceKind: "owned" | "external" | "not_reported";
  sourceId?: string;
  definitionVersion?: number;
  instanceVersion?: number;
  status: ActivityExecutionStatus | "not_reported";
  ready: boolean;
  authoritySystem?: string;
  ownerName?: string;
  evidenceRefs: string[];
  businessObjectRefs: Array<Record<string, string>>;
  sourceSystem?: string;
  environment?: string;
  simulated?: boolean;
};

export type GateActivitySnapshot = {
  gateCode: GateCode;
  definitionVersion: typeof GATE_DEFINITION_VERSION;
  items: GateActivitySnapshotItem[];
  hasHardBlocker: boolean;
  capturedAt: string;
};

export const UNIFIED_LIFECYCLE_STATES = [
  "待立项",
  "已立项",
  "方案中",
  "核价定价中",
  "待商务决策",
  "已对外提交",
  "成交/未成交",
] as const;

export type UnifiedLifecycleState = (typeof UNIFIED_LIFECYCLE_STATES)[number];
export type CommercialResult = "pending" | "won" | "lost" | "terminated";

export function deriveUnifiedLifecycle(
  stage: ProjectStage,
  result: CommercialResult,
  externalSubmissionStatus?: string,
): UnifiedLifecycleState {
  if (result !== "pending") return "成交/未成交";
  if (stage === "S0") return "待立项";
  if (stage === "S1") return "已立项";
  if (stage === "S2") return "方案中";
  if (stage === "S3") return "核价定价中";
  if (stage === "S4" && !["已提交", "等待结果"].includes(externalSubmissionStatus ?? "")) return "待商务决策";
  return "已对外提交";
}

export const MACRO_PHASES = [
  { code: "P1", name: "立项", stages: ["S0", "S1"] },
  { code: "P2", name: "技术方案", stages: ["S2"] },
  { code: "P3", name: "核价、投标与报价", stages: ["S3", "S4", "S5"] },
] as const;

export const ROLE_PERMISSIONS = {
  sales: ["procurement_intent.create", "g1.request", "g1.resubmit", "g2.request", "g2.resubmit", "s2.requirement.write", "g3.request", "g3.resubmit", "g4.request", "g4.resubmit", "g5.request", "g5.resubmit", "g6.review.write", "g6.request", "g6.resubmit", "project.fact.write", "spm_activity.write"],
  manager: ["g1.approve", "g1.return", "g2.approve", "g2.return", "g5.approve_submit", "g5.decline", "g5.return", "g6.approve", "g6.return", "project.supervise"],
  technical: ["s2.technical.write", "g3.approve", "g3.return", "requirement.confirm"],
  costing: ["s3.costing.write", "s3.bom.confirm", "s3.pricing_snapshot.write"],
  authorizer: ["g4.approve", "g4.return"],
  bid: ["s4.bid_package.write", "g5.submit"],
  contract: ["g6.handover.accept"],
} as const;

export const ACTIVITY_TRACKS = ["SALES_PROJECT_MANAGEMENT", "BID_OPERATION"] as const;
export type ActivityTrackType = (typeof ACTIVITY_TRACKS)[number];
export type ActivityExecutionStatus = "planned" | "in_progress" | "blocked" | "completed" | "cancelled";
export type ActivityTimelinessStatus = "on_track" | "due_soon" | "overdue" | "completed_late";
export const ACTIVITY_COMMANDS = ["start", "block", "resume", "complete", "cancel", "add_evidence"] as const;
export type ActivityCommand = (typeof ACTIVITY_COMMANDS)[number];

export function nextActivityStatus(current: ActivityExecutionStatus, command: ActivityCommand): ActivityExecutionStatus {
  if (command === "add_evidence") return current;
  if (current === "planned" && command === "start") return "in_progress";
  if ((current === "planned" || current === "in_progress") && command === "block") return "blocked";
  if (current === "blocked" && command === "resume") return "in_progress";
  if (current === "in_progress" && command === "complete") return "completed";
  if ((current === "planned" || current === "in_progress" || current === "blocked") && command === "cancel") return "cancelled";
  throw new Error(`非法活动流转：${current} → ${command}`);
}

export type PersistedActivityRecord = {
  id: string;
  version: number;
  definitionCode: string;
  definitionVersion: number;
  trackType: ActivityTrackType;
  ltcNodeCode?: string;
  title: string;
  purpose: string;
  ownerName: string;
  status: ActivityExecutionStatus;
  timelinessStatus: ActivityTimelinessStatus;
  plannedStart?: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  result?: string;
  exceptionReason?: string;
  businessObjectRefs: Array<Record<string, string>>;
  evidenceRefs: string[];
  gateInstanceId?: string;
  completionEvent: string;
  authoritySystem: string;
  readOnly: boolean;
  sourceSystem?: string;
  externalActivityInstanceId?: string;
  environment?: string;
  simulated?: boolean;
  syncedAt?: string;
};

export type G1Status = "pending" | "returned" | "approved";
export type G1Action = "approve" | "return" | "resubmit";

export function nextG1Status(current: G1Status, action: G1Action): G1Status {
  if (current === "pending" && action === "approve") return "approved";
  if (current === "pending" && action === "return") return "returned";
  if (current === "returned" && action === "resubmit") return "pending";
  throw new Error(`非法G1流转：${current} → ${action}`);
}

export type G2PreparationInput = {
  winStrategy: string;
  relationshipCoverage: string;
  customerEngagement: string;
  resourceInvestment: string;
  bidWorkInitiationPlan: string;
  initiationAssessment: string;
  commercialContext: string;
};

export type G2SourceTab = "relations" | "strategy" | "resources" | "actions";
export type G2ReadinessItem = {
  key: keyof G2PreparationInput;
  track: "销售项目管理轨" | "投标作业轨";
  label: string;
  summary: string;
  ready: boolean;
  hard: boolean;
  sourceType: "ProjectStrategyVersion" | "CustomerRelationshipRecord" | "RoleAssignment" | "SolutionPreparationRecord" | "BidPreparationVersion" | "CommercialSolutionVersion";
  sourceRefs: string[];
  sourceTab: G2SourceTab;
  owner: string;
};
export type G2ReadinessSnapshot = {
  input: G2PreparationInput;
  items: G2ReadinessItem[];
  generatedAt: string;
  activitySnapshot?: GateActivitySnapshot;
};

export type SolutionPreparationInput = {
  requirementGaps: string;
  technicalDifficulty: string;
  solutionResourceNeeds: string;
  evidenceRef: string;
};

export type BidPreparationInput = {
  sourceType: "TenderRequest" | "EPCInquiry" | "DirectRFQ";
  sourceRef: string;
  sourceVersion: string;
  sourceHash: string;
  technicalRequirements: string;
  commercialRequirements: string;
  evaluationCriteria: string;
  qualificationRequirements: string;
  identifiedRisks: string;
  bidStrategy: string;
  workPlan: Array<{ task: string; ownerRole: string; dueDate: string }>;
  evidenceRef: string;
};

export type CommercialSolutionInput = {
  bidPreparationVersionId: string;
  paymentTerms: string;
  deliveryTerms: string;
  guaranteeTerms: string;
  breachLiability: string;
  pricingStrategy: string;
  quotationListRef: string;
  commercialDeviations: Array<{ clause: string; response: string; riskLevel: "low" | "medium" | "high"; mitigation: string }>;
  riskAssessment: string;
  mitigationPlan: string;
  evidenceRef: string;
};

export type RequirementSourceInput = {
  originalText: string;
  sourceRef: string;
};

export type TechnicalAssessmentInput = {
  standardizedRequirement: string;
  designAdoptedValue: string;
  criticalParameterStatus: "完整" | "存在缺失";
  initialTechnicalSolution: string;
  solutionEvidenceRef: string;
  clarificationQuestion: string;
  clarificationResponse: string;
  clarificationStatus: "open" | "resolved";
  clarificationOwnerRole: string;
  clarificationClosureEvidenceRef: string;
  deviationDescription: string;
  deviationStatus: "none" | "recorded";
  deviationEvidenceRef: string;
  deviationOwnerRole: string;
  deviationDisposition: string;
  deviationClosureEvidenceRef: string;
  configurationSummary: string;
  bomConfirmationStatus: "confirmed" | "unconfirmed";
  bomEvidenceRef: string;
};

export type S2SourceTab = "versions";
export type S2ReadinessItem = {
  key: "requirementClarification" | "requirementSource" | "normalizedRequirement" | "criticalParameters" | "technicalSolution" | "quotationDesignBom" | "clarifications" | "deviations";
  label: string;
  summary: string;
  ready: boolean;
  hard: boolean;
  sourceType: "RequirementClarificationPackage" | "CustomerRequirementVersion" | "TechnicalSolutionVersion" | "QuotationDesignBOM" | "TechnicalClarificationItem" | "TechnicalDeviationRecord";
  sourceRefs: string[];
  sourceTab: S2SourceTab;
  owner: string;
};
export type S2ReadinessSnapshot = {
  items: S2ReadinessItem[];
  requirementClarificationPackage?: Record<string, unknown>;
  requirementVersion?: Record<string, unknown>;
  technicalSolutionVersion?: Record<string, unknown>;
  quotationDesignBom?: Record<string, unknown>;
  clarificationItems: Record<string, unknown>[];
  deviationRecords: Record<string, unknown>[];
  generatedAt: string;
  activitySnapshot?: GateActivitySnapshot;
};

export type StageExitReviewStatus = "pending" | "returned" | "approved";

export type CostingAssessmentInput = {
  priceSource: string;
  priceSourceVersion: string;
  snapshotDate: string;
  validUntil: string;
  currency: string;
  taxBasis: string;
  tradeTerms: string;
  exchangeRateBasis?: string;
  priceEvidenceRef: string;
  materialCostYuan: number;
  laborCostYuan: number;
  manufacturingCostYuan: number;
  transportCostYuan: number;
  taxCostYuan: number;
  riskReserveYuan: number;
  costingSalesPriceYuan: number;
  targetProfitRate: number;
  calculationBasis: string;
  deliveryAssessment: string;
  deliveryRiskConclusion: string;
};

export type S3ReadinessItem = {
  key: "technicalBaseline" | "quotationDesignBom" | "pricingSnapshot" | "completeCost" | "profitAndMargin" | "deliveryRisk";
  label: string;
  summary: string;
  ready: boolean;
  hard: true;
  sourceType: "TechnicalSolutionVersion" | "QuotationDesignBOM" | "PricingSnapshot" | "CostingSolutionVersion";
  sourceRefs: string[];
  owner: "技术负责人" | "技术/采购" | "采购/财务" | "财务/核价人员";
};

export type S3ReadinessSnapshot = {
  items: S3ReadinessItem[];
  technicalSolutionVersion?: Record<string, unknown>;
  quotationDesignBom?: Record<string, unknown>;
  pricingSnapshot?: Record<string, unknown>;
  costingSolutionVersion?: Record<string, unknown>;
  pricingAuthorizationRequest?: Record<string, unknown>;
  generatedAt: string;
  activitySnapshot?: GateActivitySnapshot;
};

export type PricingAuthorizationInput = {
  floorPriceYuan: number;
  authorizedQuotePriceYuan: number;
  currency: string;
  taxBasis: string;
  tradeTerms: string;
  routeScope: string;
  exceptionConditions: string;
  scopeAlignmentConclusion: string;
  amountVarianceExplanation: string;
  validUntil: string;
  evidenceRef: string;
};

export type BidPackageInput = {
  submissionType: "DirectBidSubmission" | "CustomerRouteQuotation" | "DirectQuotation";
  routeId: string;
  quotedPriceYuan: number;
  packageHash: string;
  evidenceRef: string;
};

export type ProfessionalReviewInput = {
  bidPackageVersionId: string;
  reviewType: "business" | "technical" | "qualification";
  reviewConclusion: "approved" | "rejected";
  openRiskCount: number;
  deviationConclusion: "none" | "authorized";
  reviewSummary: string;
  evidenceRef: string;
  remediationId?: string;
};

export type ProfessionalReviewRemediationInput = {
  professionalReviewId: string;
  issueResponse: string;
  evidenceRef: string;
};

export type EpcQuotationRouteInput = {
  epcCustomer: string;
  inquiryRef: string;
  inquiryDate: string;
  evidenceRef: string;
};

export type EpcPriceExceptionInput = {
  routeId: string;
  requestedPriceYuan: number;
  reason: string;
  evidenceRef: string;
  validUntil: string;
};

export type G5ReopenChangeType = "add_route" | "withdraw_route" | "route_material_change" | "route_price_change";

export type G5ReopenRequestInput = {
  changeType: G5ReopenChangeType;
  routeId: string;
  reason: string;
  evidenceRef: string;
};

export type EpcRouteReadiness = {
  route: Record<string, unknown>;
  bidPackage?: Record<string, unknown>;
  professionalReview?: Record<string, unknown>;
  professionalReviews?: Record<string, unknown>[];
  priceException?: Record<string, unknown>;
  expectedPriceCents: number;
  ready: boolean;
  blockers: string[];
};

export type G5ReadinessItem = {
  key: "g4Baseline" | "priceAuthorization" | "bidPackage" | "professionalReview" | "businessDecisionContext" | "deviationAuthorization" | "projectRisk" | "priceFloor" | "signatureConsistency" | "epcRoutes";
  label: string;
  summary: string;
  ready: boolean;
  hard: boolean;
  sourceType: "StageGateInteraction" | "PricingAuthorization" | "BidPackageVersion" | "ProfessionalReview" | "ProjectStrategyVersion" | "ProjectRisk" | "QuotationRoute";
  sourceRefs: string[];
  owner: "财务/价格授权人" | "投标专员" | "专业评审组" | "商务/技术/资质评审人" | "销售项目Owner/销售主管" | "系统一致性校验";
};

export type G5DeviationItem = {
  ref: string;
  sourceType: "ProfessionalReview";
  reviewType: ProfessionalReviewInput["reviewType"];
  description: string;
  applicableVersionIds: string[];
};

export type G5DeviationAuthorizationInput = {
  deviationRef: string;
  scope: string;
  risk: string;
  applicableVersionId: string;
  validUntil: string;
  evidenceRef: string;
};

export type G5ReadinessSnapshot = {
  items: G5ReadinessItem[];
  pricingAuthorization?: Record<string, unknown>;
  bidPackageVersion?: Record<string, unknown>;
  bidPackageVersions?: Record<string, unknown>[];
  professionalReview?: Record<string, unknown>;
  professionalReviews?: Record<string, unknown>[];
  quotationRoutes?: Record<string, unknown>[];
  routeReadiness?: EpcRouteReadiness[];
  priceExceptions?: Record<string, unknown>[];
  projectRisks?: Record<string, unknown>[];
  residualHighRisks?: Record<string, unknown>[];
  riskAcceptances?: Record<string, unknown>[];
  businessDecisionContext?: Record<string, unknown>;
  deviationItems?: G5DeviationItem[];
  deviationAuthorizations?: Record<string, unknown>[];
  generatedAt: string;
  activitySnapshot?: GateActivitySnapshot;
};

export type ResultType = "won" | "lost" | "terminated";

export type LossTerminationReviewInput = {
  reasonCategory: string;
  reasonDetail: string;
  competitorName: string;
  keyGap: string;
  evidenceRef: string;
  improvementAction: string;
  actionOwner: string;
  dueDate: string;
};

export type G6ReadinessItem = {
  key: "routeResults" | "resultFact" | "submissionTrace" | "awardBaselineCompleteness" | "lossReview";
  label: string;
  summary: string;
  ready: boolean;
  hard: true;
  sourceType: "QuotationRouteResult" | "BidResult" | "CommercialSubmission" | "CommercialAwardBaseline" | "LossTerminationReview";
  sourceRefs: string[];
  owner: "投标作业责任人" | "系统一致性校验" | "销售项目Owner";
};

export type G6ReadinessSnapshot = {
  resultType?: ResultType;
  items: G6ReadinessItem[];
  routeResults?: Record<string, unknown>[];
  submittedRoutes?: Record<string, unknown>[];
  pendingRouteIds?: string[];
  winningRouteIds?: string[];
  resultAggregationStatus?: "pending" | "ready" | "conflict" | "not_applicable";
  resultNotice?: Record<string, unknown>;
  lossTerminationReview?: Record<string, unknown>;
  awardBaselineManifest?: Record<string, unknown>;
  generatedAt: string;
  activitySnapshot?: GateActivitySnapshot;
};

export const G2_INPUTS = [
  { key: "winStrategy", track: "销售项目管理轨", label: "首版赢单策略" },
  { key: "relationshipCoverage", track: "销售项目管理轨", label: "客户决策链与关系覆盖" },
  { key: "customerEngagement", track: "销售项目管理轨", label: "最近客户接触与覆盖缺口" },
  { key: "resourceInvestment", track: "销售项目管理轨", label: "本阶段资源投入与接受" },
  { key: "bidWorkInitiationPlan", track: "投标作业轨", label: "采购/投报作业启动计划" },
  { key: "initiationAssessment", track: "投标作业轨", label: "需求与方案启动评估" },
  { key: "commercialContext", track: "投标作业轨", label: "初版商务条款与偏差上下文" },
] as const satisfies ReadonlyArray<{ key: keyof G2PreparationInput; track: string; label: string }>;

export const DOMAIN_EVENTS = {
  procurementIntentQualified: "ProcurementIntentQualified",
  salesProjectCreated: "SalesProjectCreated",
  g1ApprovalRequested: "G1ApprovalRequested",
  g1Returned: "G1Returned",
  g1Resubmitted: "G1Resubmitted",
  salesProjectEstablished: "SalesProjectEstablished",
  g2ApprovalRequested: "G2ApprovalRequested",
  g2Returned: "G2Returned",
  g2Resubmitted: "G2Resubmitted",
  workInitiationApproved: "WorkInitiationApproved",
  s1StrategyRecorded: "S1StrategyRecorded",
  customerRelationshipRecorded: "CustomerRelationshipRecorded",
  roleAssignmentRecorded: "RoleAssignmentRecorded",
  resourceCandidateRecorded: "ResourceCandidateRecorded",
  resourceCandidateSelected: "ResourceCandidateSelected",
  resourceRequested: "ResourceRequested",
  partnerNeedDecided: "PartnerNeedDecided",
  partnerEngagementRegistered: "PartnerEngagementRegistered",
  partnerVerificationDecided: "PartnerVerificationDecided",
  partnerContributionRecorded: "PartnerContributionRecorded",
  projectRiskCreated: "ProjectRiskCreated",
  projectRiskStatusChanged: "ProjectRiskStatusChanged",
  residualProjectRiskAccepted: "ResidualProjectRiskAccepted",
  solutionPreparationRecorded: "SolutionPreparationRecorded",
  bidPreparationCompleted: "BidPreparationCompleted",
  commercialSolutionCompleted: "CommercialSolutionCompleted",
  customerRequirementRecorded: "CustomerRequirementRecorded",
  requirementClarificationRecorded: "RequirementClarificationRecorded",
  technicalSolutionRecorded: "TechnicalSolutionRecorded",
  technicalClarificationRecorded: "TechnicalClarificationRecorded",
  technicalDeviationRecorded: "TechnicalDeviationRecorded",
  g3ApprovalRequested: "G3ApprovalRequested",
  g3Returned: "G3Returned",
  g3Resubmitted: "G3Resubmitted",
  customerRequirementBaselined: "CustomerRequirementBaselined",
  quotationDesignBomConfirmed: "QuotationDesignBomConfirmed",
  pricingSnapshotFrozen: "PricingSnapshotFrozen",
  costingSolutionRecorded: "CostingSolutionRecorded",
  g4ApprovalRequested: "G4ApprovalRequested",
  g4Returned: "G4Returned",
  g4Resubmitted: "G4Resubmitted",
  costingSolutionApproved: "CostingSolutionApproved",
  pricingAuthorizationGranted: "PricingAuthorizationGranted",
  bidPackagePrepared: "BidPackagePrepared",
  bidReviewCompleted: "BidReviewCompleted",
  g5ApprovalRequested: "G5ApprovalRequested",
  g5Returned: "G5Returned",
  g5Resubmitted: "G5Resubmitted",
  bidDecisionMade: "BidDecisionMade",
  commercialSubmissionAccepted: "CommercialSubmissionAccepted",
  commercialSubmissionDeclined: "CommercialSubmissionDeclined",
  commercialResultReported: "CommercialResultReported",
  lossTerminationReviewRecorded: "LossTerminationReviewRecorded",
  g6ApprovalRequested: "G6ApprovalRequested",
  g6Returned: "G6Returned",
  g6Resubmitted: "G6Resubmitted",
  commercialDealWon: "CommercialDealWon",
  commercialDealLost: "CommercialDealLost",
  commercialDealTerminated: "CommercialDealTerminated",
  awardBaselineFrozen: "AwardBaselineFrozen",
  contractHandoverAccepted: "ContractHandoverAccepted",
  downstreamBusinessStatusReported: "DownstreamBusinessStatusReported",
  activityInstanceCreated: "ActivityInstanceCreated",
  activityStatusChanged: "ActivityStatusChanged",
  activityEvidenceAdded: "ActivityEvidenceAdded",
  externalActivityProjected: "ExternalActivityProjected",
  externalActivityProjectionUpdated: "ExternalActivityProjectionUpdated",
} as const;
