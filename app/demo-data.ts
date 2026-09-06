import { enrichProjects } from "./scenario-data";
import { PROJECT_STAGES, STAGE_GATES, type G2PreparationInput, type G2ReadinessSnapshot, type G5ReadinessSnapshot, type G6ReadinessSnapshot, type PersistedActivityRecord, type ProjectStage, type S2ReadinessSnapshot, type S3ReadinessSnapshot } from "./domain/sales-project-contract";

export type Role = "sales" | "manager";
export type View = "dashboard" | "projects" | "new" | "detail" | "rules" | "decisions" | "resource-center" | "risk-center" | "configuration-center" | "review-center" | "action-center";
export type DetailTab =
  | "overview"
  | "relations"
  | "strategy"
  | "resources"
  | "actions"
  | "versions"
  | "gate"
  | "result";

export type { ProjectStage } from "./domain/sales-project-contract";
export type LeadGrade = "S" | "A" | "B" | "C";
/** @deprecated 兼容历史样例；新页面使用 leadGrade。 */
export type ProjectGrade = LeadGrade;
export type ProjectImportance = "普通" | "重点" | "重大";
export type RiskLevel = "待评估" | "低" | "中" | "高" | "重大";
export type VersionStatus = "生效" | "已批准" | "已提交" | "需要重新评审" | "历史" | "草稿";
export type SalesScenario = "客户直接投标" | "EPC客户询价" | "客户直接询价" | "国内正式招投标" | "国内客户询价/报价" | "国内EPC询价" | "海外伙伴/EPC询价";
export type SubmissionObject = "DirectBidSubmission" | "CustomerRouteQuotation" | "DirectQuotation";

export interface QuotationRoute {
  id: string;
  epcCustomer: string;
  inquiryRequests: number;
  quoteVersion: string;
  quotedAmount: number;
  authorizedFloorPrice: number;
  status: "询价澄清" | "待报价" | "已报价" | "等待结果" | "中标" | "未中标";
  pricingConclusion: "同标同价" | "条款差异已授权" | "待授权";
  contractCustomer: string;
  evidence: string;
  updatedAt: string;
}

export interface ScenarioContext {
  scenario: SalesScenario;
  procurementRequestType: "TenderRequest" | "EPCInquiry" | "DirectRFQ";
  endCustomer: string;
  projectCountry?: string;
  deliveryCountry?: string;
  procurementFingerprint: string;
  submissionObject: SubmissionObject;
  projectAmountRule: string;
  relationshipViews: { endCustomer: number; procurementCustomer: number };
  quotationRoutes: QuotationRoute[];
  bidRound?: { id: string; roundNo: number; roundType: string; status: string; authoritySystem: string; tenderDocumentRef: string; bidDeadline: string; externalBidId?: string };
  bidRounds: Array<{ id: string; roundNo: number; roundType: string; status: string; authoritySystem: string; tenderDocumentRef: string; bidDeadline: string; externalBidId?: string }>;
}

export interface Relationship {
  id: string;
  layer: "客户高层" | "商务决策链" | "技术层";
  name: string;
  title: string;
  attitude: "支持" | "中立" | "反对";
  influence: "高" | "中" | "低";
  owner: string;
  evidence: string;
  lastTouch: string;
}

export interface Resource {
  id: string;
  role: string;
  person: string;
  status: "已到位" | "待接受" | "缺失";
  required: boolean;
  due: string;
  capabilities?: string[];
  certifications?: string[];
  load?: number;
  activeProjects?: number;
  availableFrom?: string;
  dataSource?: string;
}

export interface Partner {
  needed: boolean;
  decisionStatus?: "未判断" | "需要" | "不需要";
  engagementId?: string;
  verificationStatus?: "candidate" | "verification_pending" | "verified" | "rejected";
  type: string;
  name: string;
  match: "不需要" | "候选" | "已匹配" | "已验证";
  certification: "不适用" | "待认证" | "已认证";
  evidence: string;
  contribution: string;
}

export interface ProjectAction {
  id: string;
  type: string;
  title: string;
  purpose: string;
  owner: string;
  due: string;
  status: "待开始" | "进行中" | "已完成" | "已延期" | "已阻塞" | "已取消";
  evidence: string;
  result: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress?: number;
  context?: "project_operation" | "post_award_responsibility";
}

export interface Risk {
  id: string;
  level: RiskLevel;
  category: string;
  title: string;
  owner: string;
  due: string;
  status: "开放" | "处理中" | "已关闭";
  evidence: string;
  description?: string;
  impact?: string;
  resolution?: string;
  version?: number;
}

export interface ResourceRequest {
  id: string;
  role: string;
  requirement: string;
  requiredBy: string;
  evidence: string;
  status: "待指派" | "待接受" | "已到位" | "已取消";
}

export interface ResourceCandidate {
  id: string;
  role: string;
  name: string;
  sourceSystem: string;
  sourceRef: string;
  capabilities: string[];
  load?: number;
  activeProjects?: number;
  availableFrom?: string;
  status: "候选" | "已选定" | "已拒绝" | "已撤回";
  evidence: string;
  simulated: boolean;
}

export interface ArtifactVersion {
  id: string;
  kind: "需求澄清包" | "客户需求" | "技术方案" | "设计BOM" | "核价方案" | "授权底价" | "投标方案";
  version: string;
  status: VersionStatus;
  createdAt: string;
  creator: string;
  approver: string;
  basedOn: string;
  summary: string;
  immutable?: boolean;
  /** 销售项目管理口径，统一使用万元；专业明细仍归权威作业系统。 */
  amount?: number;
  amountLabel?: string;
  costAmount?: number;
  floorAmount?: number;
  riskReserveAmount?: number;
  grossMarginRate?: number;
}

export interface Deviation {
  id: string;
  field: string;
  requirement: string;
  proposal: string;
  reason: string;
  impact: string;
  owner: string;
  status: "待审批" | "已批准" | "已拒绝";
  approver: string;
}

export interface ExternalBidReference {
  id: string;
  status: "未启动" | "编制中" | "待提交" | "已提交" | "等待结果";
  owner: string;
  updatedAt: string;
  submissionHash: string;
  receipt: string;
}

export interface WinningBaseline {
  id: string;
  createdAt: string;
  approver: string;
  requirementId: string;
  technicalId: string;
  designBomId?: string;
  costingId: string;
  floorPriceId?: string;
  bidId: string;
  submissionId?: string;
  resultNoticeId?: string;
  transferStatus: "待接收" | "已接收";
  contractRef: string;
  manifestHash?: string;
  receiptRef?: string;
}

export interface LostReview {
  reason: string;
  competitor: string;
  gap: string;
  evidence: string;
  improvement: string;
}

export interface SourceLineage {
  sourceType: "线索转入" | "标书/RFQ触发" | "客户明确需求" | "渠道机会" | "增购机会" | "直接谈判" | "客户直接投标" | "EPC客户询价" | "客户直接询价" | "国内正式招投标" | "国内客户询价/报价" | "国内EPC询价" | "海外伙伴/EPC询价";
  sourceSystem: string;
  sourceRecordId: string;
  leadId: string;
  commercialProjectId: string;
  contributor: string;
  convertedAt: string;
  inheritedFields: string[];
  inheritedContext: string[];
  evidence: string;
  initialRequirement?: {
    originalText: string;
    productRequirement: string;
    quantity?: string;
    qualificationRequirements?: string;
    knownConstraints: string[];
    unknowns: string[];
    sourceRefs: string[];
    frozenAt: string;
  };
  candidateFacts?: {
    competitors: Array<Record<string, unknown>>;
    keyRoles: Array<Record<string, unknown>>;
    partners: Array<Record<string, unknown>>;
    parties: Array<Record<string, unknown>>;
    contacts: Array<Record<string, unknown>>;
    followups: Array<Record<string, unknown>>;
    attachments: Array<Record<string, unknown>>;
  };
}

export interface CustomerIdentity {
  status: "已匹配正式客户" | "待选择匹配客户" | "疑似重复" | "临时项目客户" | "客户建档中" | "信用调查中" | "已准入";
  sourceName: string;
  sourceSystem: string;
  customerRecordId: string;
  matchCandidates: string[];
  onboardingTask: string;
  creditStatus: string;
  lastSyncedAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  role: "主要对手" | "低价挑战者" | "在位供应商" | "替代方案";
  relationship: number;
  technical: number;
  price: number;
  delivery: number;
  service?: number;
  evidence: string;
  confidence: "高" | "中" | "低";
  updatedAt: string;
}

export interface CompetitivePosition {
  relationship: number;
  technical: number;
  price: number;
  delivery: number;
  service: number;
  confidence: "高" | "中" | "低";
  evidence: string;
}

export interface StrategyPlan {
  version: string;
  status: "草稿" | "待主管评审" | "已批准" | "需要更新";
  objective: string;
  owner: string;
  approver: string;
  winThemes: string[];
  mustProve: string[];
  gaps: string[];
  noPromise: string[];
  valueProposition?: string;
  relationshipPlan?: string;
  resourcePlan?: string;
  winPath?: string;
  requirementScope?: string;
  keyRisks?: string;
  nonBidConsequence?: string;
}

export interface Milestone {
  id: string;
  title: string;
  plannedAt: string;
  actualAt: string;
  owner: string;
  status: "未开始" | "进行中" | "已完成" | "已延期" | "受阻";
  dependency: string;
  completionCriteria: string;
  evidence: string;
  critical: boolean;
  scope?: "销售项目" | "外部只读";
  sourceSystem?: string;
  milestoneType?: "项目管理" | "客户节点" | "外部作业" | "Gate锚点";
  evidenceRequirement?: string;
  sourceType?: "management" | "gate" | "external_event";
  version?: number;
}

export interface ConfigurationItem {
  id: string;
  group: "产品范围" | "技术参数" | "交付服务" | "商务条款" | "认证合规";
  name: string;
  customerValue: string;
  proposedValue: string;
  status: "一致" | "待确认" | "存在偏差" | "需要重新评审";
  source: string;
  impacts: string[];
  lifecycleValues?: Partial<Record<ArtifactVersion["kind"], {
    value: string;
    source: string;
    versionId: string;
    applicability: "applicable" | "not_applicable" | "unknown";
  }>>;
}

export interface ConfigurationBaseline {
  id: string;
  version: string;
  status: "未形成" | "草稿" | "已冻结" | "需要重新评审" | "中标基线";
  createdAt: string;
  approver: string;
  items: ConfigurationItem[];
}

export interface ExternalTaskReference {
  id: string;
  taskType: "BID_PREPARATION" | "COMMERCIAL_SOLUTION" | "TECHNICAL_COLLABORATION" | "REQUIREMENT_BASELINE_PREPARATION" | "TECHNICAL_SOLUTION_PREPARATION" | "BOM_AND_CLOSURE_PREPARATION" | "G3_GATE_REVIEW" | "COSTING_COLLABORATION" | "G4_GATE_REVIEW" | "EPC_PRICE_EXCEPTION_APPROVAL" | "BID_PACKAGE_PREPARATION" | "BID_PACKAGE_REVIEW" | "G5_SUBMISSION_EXECUTION" | "COMMERCIAL_RESULT_TRACKING" | "CONTRACT_HANDOVER_EXECUTION" | "DOWNSTREAM_STATUS_TRACKING";
  targetSystem: string;
  externalTaskId: string;
  assigneeName: string;
  status: "pending" | "accepted" | "completed" | "returned" | "rejected" | "cancelled";
  environment: "demo";
  simulated: boolean;
  updatedAt: string;
}

export interface G5ReopenRequestReference {
  id: string;
  changeType: "add_route" | "withdraw_route" | "route_material_change" | "route_price_change";
  routeId?: string;
  reason: string;
  evidenceRef: string;
  status: "pending" | "approved" | "returned" | "rejected";
  decisionComment?: string;
}

export interface DownstreamBusinessEvent {
  id: string;
  sourceSystem: string;
  sourceEventId: string;
  externalTaskId?: string;
  objectType: "Contract" | "Order" | "Delivery" | "Acceptance" | "Invoice" | "Payment";
  objectRef: string;
  eventType: "status_reported" | "created" | "updated" | "cancelled";
  businessStatus: string;
  amount?: number;
  currency?: string;
  evidenceRef: string;
  occurredAt: string;
  environment: "demo";
  simulated: boolean;
}

export interface SalesProject {
  persisted?: boolean;
  id: string;
  name: string;
  customer: string;
  target: string;
  intentType: string;
  evidence: string;
  amount: number;
  projectGrade?: ProjectGrade;
  leadGrade?: LeadGrade;
  projectGradeReason?: string;
  leadAssessment?: { score?: number; gradeAssessment?: Record<string, unknown>; authenticityStatus?: string; authenticityBasis?: string; majorProject?: boolean; majorProjectBasis?: string; procurementProgress?: string; amountType?: string; fieldProvenance?: Record<string, unknown>; occurredAt?: string };
  projectImportance?: ProjectImportance;
  projectImportanceReason?: string;
  organization?: string;
  stage: ProjectStage;
  stageName: string;
  owner: string;
  approver: string;
  bidDate: string;
  countdown: number;
  probability: number;
  /** false 表示尚无经确认的项目团队概率评估；不得把阶段默认值冒充测算结果。 */
  probabilityAssessed?: boolean;
  riskLevel: RiskLevel;
  health: { relationship: number; resource: number; operation: number };
  strategy: string;
  competition: string;
  nextStep: string;
  relationships: Relationship[];
  resources: Resource[];
  resourceRequests?: ResourceRequest[];
  resourceCandidates?: ResourceCandidate[];
  partner: Partner;
  actions: ProjectAction[];
  activityRecords?: PersistedActivityRecord[];
  risks: Risk[];
  versions: ArtifactVersion[];
  deviations: Deviation[];
  externalBid: ExternalBidReference;
  result: "pending" | "won" | "lost" | "terminated";
  administrativeStatus?: "Active" | "PendingClose" | "Closed" | "Terminated";
  baseline?: WinningBaseline;
  lostReview?: LostReview;
  changeCount: number;
  participants?: string[];
  sourceLineage?: SourceLineage;
  customerIdentity?: CustomerIdentity;
  competitors?: Competitor[];
  competitivePosition?: CompetitivePosition;
  strategyPlan?: StrategyPlan;
  milestones?: Milestone[];
  configuration?: ConfigurationBaseline;
  scenarioContext?: ScenarioContext;
  g2Preparation?: G2PreparationInput;
  g2Readiness?: G2ReadinessSnapshot;
  s2Readiness?: S2ReadinessSnapshot;
  s3Readiness?: S3ReadinessSnapshot;
  g5Readiness?: G5ReadinessSnapshot;
  g5ReopenRequest?: G5ReopenRequestReference;
  g6Readiness?: G6ReadinessSnapshot;
  externalTasks?: ExternalTaskReference[];
  downstreamEvents?: DownstreamBusinessEvent[];
}

export function submissionTimingLabel(project: SalesProject) {
  if (project.result === "won") return project.stage === "S6" ? "已中标·已移交" : "已中标·待合同接收";
  if (project.result === "lost") return "未中标";
  if (project.result === "terminated") return "已终止";
  if (["S5", "S6"].includes(project.stage)) return "已提交·等待结果";
  if (["已提交", "等待结果"].includes(project.externalBid.status)) return "状态冲突·需核对";
  if (project.countdown < 0) return "已逾期未提交";
  return `${project.countdown}天`;
}

export function probabilityLabel(project: SalesProject) {
  if (project.result === "won") return "100%";
  if (project.result === "lost" || project.result === "terminated") return "0%";
  return project.probabilityAssessed === false ? "待评估" : `${project.probability}%`;
}

export const stageDefinitions = PROJECT_STAGES;
export const gateDefinitions = STAGE_GATES;

export const gateAuthorityMatrix = [
  { gate: "G1", source: "线索评级与真实性、采购请求、查重结果、Owner", sourceOwner: "线索APP / 销售Owner", authoritySystem: "线索APP + 销售项目APP", trigger: "销售Owner提交立项", decision: "销售主管", control: "人工审批；项目等级调整和重要性必须留痕" },
  { gate: "G2", source: "初始策略、客户关系、资源计划、需求缺口与方案准备反馈", sourceOwner: "销售Owner / 项目团队", authoritySystem: "销售项目APP + 投标作业APP", trigger: "销售Owner冻结来源", decision: "销售主管", control: "人工审批；不在Gate重复填写来源事实" },
  { gate: "G3", source: "需求澄清包、正式需求基线、技术方案、报价设计BOM、问题澄清与偏差", sourceOwner: "销售Owner（客户澄清协调）/ 专业对象责任人（编制）", authoritySystem: "销售项目APP + 技术/投标作业APP", trigger: "销售Owner提交冻结来源快照", decision: "独立技术评审人确认", control: "编制人与评审人隔离；不允许销售或技术编制人自审" },
  { gate: "G4", source: "批准技术基线、价格快照、成本利润、交期风险与价格授权", sourceOwner: "核价专业人员 / 财务价格授权人", authoritySystem: "核价/投标专业系统（待企业确认）", trigger: "销售Owner冻结来源", decision: "财务/价格授权人", control: "当前能力冻结；不得模拟人员、成本或底价" },
  { gate: "G5", source: "价格授权、投标包、专业评审、风险、偏差与签审一致性", sourceOwner: "投标专员 / 专业评审组 / 销售Owner", authoritySystem: "投标作业APP + 销售项目APP", trigger: "销售Owner提交商务决策", decision: "销售主管/授权决策人", control: "一次投/不投决策；提交执行不是第二次审批" },
  { gate: "G6", source: "正式提交回执、通路结果、赢单基线或未成交复盘", sourceOwner: "投标作业责任人 / 销售Owner", authoritySystem: "投标作业APP + 销售项目APP", trigger: "系统汇总结果后开放", decision: "销售主管", control: "结果确认与合同接收分开" },
  { gate: "G7", source: "合同、订单、履约、验收、开票和回款状态", sourceOwner: "各下游业务系统", authoritySystem: "合同/订单/履约/财务系统", trigger: "下游事件", decision: "无第二次审批；经营关闭规则待确认", control: "销售项目APP只读引用，不改写下游事实" },
] as const;

const relationshipSet: Relationship[] = [
  { id: "REL-01", layer: "客户高层", name: "周明远", title: "集团副总经理", attitude: "支持", influence: "高", owner: "陈晨", evidence: "8月12日高层拜访纪要，认可整体交付路线", lastTouch: "2026-08-12" },
  { id: "REL-02", layer: "商务决策链", name: "许文博", title: "采购部主任", attitude: "中立", influence: "高", owner: "陈晨", evidence: "RFQ澄清邮件及电话纪要", lastTouch: "2026-08-15" },
  { id: "REL-03", layer: "技术层", name: "王海峰", title: "设备技术主管", attitude: "支持", influence: "中", owner: "赵工", evidence: "技术交流会签到及参数确认单", lastTouch: "2026-08-16" },
];

const baseVersions: ArtifactVersion[] = [
  { id: "REQ-1.2", kind: "客户需求", version: "V1.2", status: "生效", createdAt: "2026-08-10 14:30", creator: "陈晨", approver: "王海峰（客户）", basedOn: "RFQ-2026-0718 + 澄清纪要02", summary: "2台220kV主变，交付地点及验收条款已确认" },
  { id: "TECH-1.1", kind: "技术方案", version: "V1.1", status: "已批准", createdAt: "2026-08-12 11:20", creator: "赵工", approver: "技术评审组", basedOn: "REQ-1.2", summary: "型号、容量、损耗参数逐项覆盖需求" },
  { id: "COST-1.0", kind: "核价方案", version: "V1.0", status: "已批准", createdAt: "2026-08-15 17:40", creator: "财务核价组", approver: "罗总", basedOn: "TECH-1.1", summary: "成本、风险储备、交期与毛利边界已评审" },
  { id: "BID-0.8", kind: "投标方案", version: "V0.8", status: "草稿", createdAt: "2026-08-16 16:10", creator: "投标APP", approver: "—", basedOn: "COST-1.0", summary: "等待价格授权后形成正式提交版" },
];

const commonActions: ProjectAction[] = [
  { id: "ACT-001", type: "高层拜访", title: "确认客户董事会决策节奏", purpose: "锁定最终决策路径与内部推荐人", owner: "陈晨", due: "2026-08-19", status: "进行中", evidence: "拜访预约邮件", result: "待拜访" },
  { id: "ACT-002", type: "技术交流", title: "损耗参数与交期联合澄清", purpose: "关闭可核价需求缺口", owner: "赵工", due: "2026-08-16", status: "已完成", evidence: "技术交流纪要-0816", result: "参数已确认，客户接受分批交付" },
];

const commonResources: Resource[] = [
  { id: "RES-01", role: "销售Owner", person: "陈晨", status: "已到位", required: true, due: "2026-08-08" },
  { id: "RES-02", role: "技术负责人", person: "赵工", status: "已到位", required: true, due: "2026-08-10" },
  { id: "RES-03", role: "高层伙伴", person: "刘总", status: "已到位", required: true, due: "2026-08-12" },
  { id: "RES-04", role: "价格授权人", person: "罗总", status: "已到位", required: true, due: "2026-08-15" },
];

const sourceLineage = (
  sequence: string,
  sourceType: SourceLineage["sourceType"],
  sourceSystem: string,
  sourceRecordId: string,
  contributor: string,
  evidence: string,
  inheritedContext: string[] = ["历史有效活动 2 条", "未关闭资源任务 1 项"],
): SourceLineage => ({
  sourceType,
  sourceSystem,
  sourceRecordId,
  leadId: `LEAD-2026-${sequence}`,
  commercialProjectId: `CP-2026-${sequence}`,
  contributor,
  convertedAt: `2026-08-${sequence.slice(-2)} 09:20`,
  inheritedFields: ["采购信号证据", "客户候选", "伙伴候选", "来源贡献者", "历史活动", "开放资源任务"],
  inheritedContext,
  evidence,
});

const initial: SalesProject[] = [
  {
    id: "QJ-2026-0817", name: "华东水务220kV主变采购项目", customer: "华东水务集团", target: "220kV低损耗电力变压器 × 2", intentType: "RFQ", evidence: "客户RFQ-2026-0718及技术澄清函", amount: 2860, stage: "S3", stageName: "核价评审", owner: "陈晨", approver: "罗总", bidDate: "2026-08-28", countdown: 11, probability: 72, riskLevel: "中", health: { relationship: 82, resource: 100, operation: 78 }, strategy: "以低损耗全寿命周期成本与可验证交期建立差异化优势。", competition: "A厂价格偏低；我方能效与交付证据更完整。", nextStep: "完成核价评审并提交价格授权", relationships: relationshipSet, resources: commonResources, partner: { needed: false, type: "不需要", name: "—", match: "不需要", certification: "不适用", evidence: "直销项目，客户采购主体明确", contribution: "不适用" }, actions: commonActions, risks: [{ id: "RSK-01", level: "中", category: "盈利", title: "铜价波动可能压缩毛利1.2个百分点", owner: "罗总", due: "2026-08-20", status: "处理中", evidence: "核价敏感性分析V1" }], versions: baseVersions.map(version => version.kind === "核价方案" ? { ...version, status: "草稿" as const, approver: "—", summary: "核价方案已形成，正等待成本与毛利边界评审" } : version), deviations: [], externalBid: { id: "BIDAPP-4108", status: "编制中", owner: "林专员", updatedAt: "2026-08-16 17:20", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0, participants: ["陈晨"], sourceLineage: sourceLineage("0817", "标书/RFQ触发", "线索APP", "RFQ-2026-0718", "区域市场部·吴洁", "客户RFQ及技术澄清函", ["历史有效活动 3 条", "客户候选已确认", "伙伴判断：不需要"]),
  },
  {
    id: "QJ-2026-0818", name: "西南新能源升压站设备投标项目", customer: "西南新能源开发有限公司", target: "主变及成套设备 × 1批", intentType: "公开招标", evidence: "招标文件XN-2026-330及购买凭证", amount: 4250, stage: "S4", stageName: "定价与投标", owner: "林涛", approver: "周主管", bidDate: "2026-08-19", countdown: 2, probability: 38, riskLevel: "重大", health: { relationship: 42, resource: 50, operation: 55 }, strategy: "先补齐技术与决策关系缺口，再以本地服务能力降低客户风险感知。", competition: "B厂拥有当地合作伙伴优势；C厂以低价策略抢占。", nextStep: "今日补齐技术负责人并完成偏差授权", relationships: [{ id: "REL-H1", layer: "客户高层", name: "李建国", title: "副总经理", attitude: "中立", influence: "高", owner: "刘总", evidence: "一次介绍性会面，无明确承诺", lastTouch: "2026-07-29" }, { id: "REL-H2", layer: "技术层", name: "彭志强", title: "项目技术经理", attitude: "中立", influence: "中", owner: "林涛", evidence: "线上澄清会纪要", lastTouch: "2026-08-14" }], resources: [{ id: "RES-H1", role: "销售Owner", person: "林涛", status: "已到位", required: true, due: "2026-08-10" }, { id: "RES-H2", role: "技术负责人", person: "待指派", status: "缺失", required: true, due: "2026-08-15" }, { id: "RES-H3", role: "高层伙伴", person: "刘总", status: "待接受", required: true, due: "2026-08-16" }, { id: "RES-H4", role: "价格授权人", person: "罗总", status: "已到位", required: true, due: "2026-08-17" }], partner: { needed: true, type: "当地服务伙伴", name: "川能协作公司", match: "候选", certification: "待认证", evidence: "伙伴自述曾服务该客户，尚无客户侧验证", contribution: "提供一次当地项目背景信息" }, actions: [{ id: "ACT-H1", type: "资源协调", title: "确认技术负责人接受项目责任", purpose: "满足投标阶段资源门要求", owner: "周主管", due: "2026-08-17", status: "已延期", evidence: "资源申请单RR-0814", result: "尚未接受" }, { id: "ACT-H2", type: "关系推动", title: "覆盖客户采购决策负责人", purpose: "验证评标偏好和商务决策链", owner: "林涛", due: "2026-08-18", status: "进行中", evidence: "待补充", result: "未完成" }], risks: [{ id: "RSK-H1", level: "重大", category: "交标", title: "距交标仅2天，技术负责人仍未到位", owner: "周主管", due: "2026-08-17", status: "开放", evidence: "资源请求RR-0814未接受" }, { id: "RSK-H2", level: "高", category: "关系", title: "客户关键商务决策人未覆盖", owner: "林涛", due: "2026-08-18", status: "开放", evidence: "客户关系地图缺口检查" }, { id: "RSK-H3", level: "高", category: "方案", title: "交期承诺与核价边界存在待批准偏差", owner: "罗总", due: "2026-08-17", status: "处理中", evidence: "DEV-017" }], versions: [{ ...baseVersions[0], id: "REQ-H1.0", version: "V1.0", summary: "主变、开关柜、交付范围已冻结" }, { ...baseVersions[1], id: "TECH-H0.9", version: "V0.9", basedOn: "REQ-H1.0", approver: "技术评审组" }, { ...baseVersions[2], id: "COST-H1.0", version: "V1.0", basedOn: "TECH-H0.9" }, { ...baseVersions[3], id: "BID-H1.0", version: "V1.0", status: "已批准", basedOn: "COST-H1.0", approver: "周主管", summary: "正式提交候选版，存在1项待授权偏差" }], deviations: [{ id: "DEV-017", field: "交付周期", requirement: "合同生效后150天", proposal: "合同生效后165天", reason: "关键套管采购周期延长", impact: "客户验收计划顺延15天；不影响设备性能，存在商务扣分风险", owner: "林涛", status: "待审批", approver: "罗总" }], externalBid: { id: "BIDAPP-4112", status: "待提交", owner: "郭专员", updatedAt: "2026-08-17 09:10", submissionHash: "待正式提交生成", receipt: "—" }, result: "pending", changeCount: 0, participants: ["林涛", "陈晨"], sourceLineage: sourceLineage("0818", "标书/RFQ触发", "线索APP", "TENDER-XN-2026-330", "西南区域市场·高蕾", "招标文件及购买凭证", ["历史有效活动 4 条", "客户候选 2 人", "未关闭资源任务 2 项"]),
  },
  {
    id: "QJ-2026-0819", name: "城投数据中心配电扩容项目", customer: "江城投资建设集团", target: "110kV变压器及数字化监测系统", intentType: "增购", evidence: "客户扩容确认函CT-0810与原合同引用", amount: 1980, stage: "S4", stageName: "定价与投标", owner: "孙倩", approver: "周主管", bidDate: "2026-08-25", countdown: 8, probability: 61, riskLevel: "高", health: { relationship: 76, resource: 100, operation: 62 }, strategy: "利用存量设备兼容性与运维数据优势锁定增购。", competition: "原供应优势明显，但客户新增能耗指标带来重评风险。", nextStep: "对变更后的能耗指标重新核价与评审", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-C${i + 1}`, owner: "孙倩" })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-C${i + 1}` })), partner: { needed: true, type: "数字化集成伙伴", name: "江城数科", match: "已验证", certification: "已认证", evidence: "客户确认其为监控平台接口方", contribution: "完成接口协议澄清并提供历史联调记录" }, actions: [{ id: "ACT-C1", type: "客户澄清", title: "确认新能耗指标测量边界", purpose: "形成可重新核价的需求基线", owner: "孙倩", due: "2026-08-18", status: "进行中", evidence: "客户变更函CT-CHG-01", result: "待客户确认测量点" }], risks: [{ id: "RSK-C1", level: "高", category: "方案", title: "已批准核价基于旧需求，须重新评审", owner: "赵工", due: "2026-08-20", status: "处理中", evidence: "需求变更影响分析IA-01" }], versions: [{ ...baseVersions[0], id: "REQ-C1.0", version: "V1.0", status: "历史", summary: "原批准需求：能耗指标按原合同" }, { ...baseVersions[0], id: "REQ-C2.0", version: "V2.0", status: "生效", createdAt: "2026-08-16 10:25", basedOn: "客户变更函CT-CHG-01", summary: "新增更严格空载损耗指标与数字监测点" }, { ...baseVersions[1], id: "TECH-C1.0", version: "V1.0", status: "需要重新评审", basedOn: "REQ-C1.0" }, { ...baseVersions[2], id: "COST-C1.0", version: "V1.0", status: "需要重新评审", basedOn: "TECH-C1.0" }, { ...baseVersions[3], id: "BID-C0.9", version: "V0.9", status: "需要重新评审", basedOn: "COST-C1.0" }], deviations: [], externalBid: { id: "BIDAPP-4118", status: "编制中", owner: "郭专员", updatedAt: "2026-08-16 15:40", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 1, participants: ["孙倩", "陈晨"], sourceLineage: sourceLineage("0819", "增购机会", "客户经营APP", "EXPAND-CT-0810", "客户经理·孙倩", "客户扩容确认函及原合同引用", ["原合同关系 1 条", "历史有效活动 5 条", "数字化伙伴候选 1 家"]),
  },
  {
    id: "QJ-2026-0820", name: "北方轨交牵引供电设备项目", customer: "北方轨道交通集团", target: "牵引变压器及辅助设备 × 8", intentType: "公开招标", evidence: "正式招标文件BJRT-2026-88", amount: 6730, stage: "S5", stageName: "结果与移交", owner: "陈晨", approver: "周主管", bidDate: "2026-08-12", countdown: -5, probability: 68, riskLevel: "中", health: { relationship: 88, resource: 100, operation: 92 }, strategy: "以轨交业绩、全周期服务和已验证能效形成综合评分优势。", competition: "A厂价格略低，我方技术与服务评分领先。", nextStep: "确认客户评标结果并完成结果处理", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-R${i + 1}` })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-R${i + 1}` })), partner: { needed: true, type: "本地服务伙伴", name: "北轨维保科技", match: "已验证", certification: "已认证", evidence: "客户书面确认服务接口", contribution: "组织2次现场踏勘并提供维保方案" }, actions: [{ id: "ACT-R1", type: "结果跟踪", title: "获取正式中标/未中标通知", purpose: "触发移交或复盘", owner: "陈晨", due: "2026-08-18", status: "进行中", evidence: "客户回执BJRT-RCPT-0812", result: "等待正式通知" }], risks: [{ id: "RSK-R1", level: "中", category: "结果", title: "评标结果尚未正式发布", owner: "陈晨", due: "2026-08-18", status: "开放", evidence: "客户回执" }], versions: [{ ...baseVersions[0], id: "REQ-R1.1", status: "生效" }, { ...baseVersions[1], id: "TECH-R1.0", status: "已批准", basedOn: "REQ-R1.1" }, { ...baseVersions[2], id: "COST-R1.0", status: "已批准", basedOn: "TECH-R1.0" }, { ...baseVersions[3], id: "BID-R1.0", version: "V1.0", status: "已提交", basedOn: "COST-R1.0", approver: "周主管", immutable: true, summary: "正式提交版本；已固化，不可覆盖" }], deviations: [{ id: "DEV-R01", field: "付款节点", requirement: "到货验收后30天支付60%", proposal: "到货验收后45天支付60%", reason: "客户统一合同模板", impact: "增加约15天应收占用，财务已计入资金成本", owner: "陈晨", status: "已批准", approver: "罗总" }], externalBid: { id: "BIDAPP-4099", status: "等待结果", owner: "郭专员", updatedAt: "2026-08-12 15:01", submissionHash: "SHA256 9F4A…72C1", receipt: "客户回执BJRT-RCPT-0812" }, result: "pending", changeCount: 0, participants: ["陈晨"], sourceLineage: sourceLineage("0820", "标书/RFQ触发", "线索APP", "TENDER-BJRT-2026-88", "轨交行业部·周凯", "正式招标文件及客户采购通知", ["历史有效活动 6 条", "本地伙伴候选 1 家", "客户关系候选 3 人"]),
  },
  {
    id: "QJ-2026-0821", name: "国网浙江2026配变集采项目", customer: "国网浙江省电力有限公司", target: "10kV高效节能配电变压器 × 420", intentType: "公开招标", evidence: "招标预公告GWZJ-2026-PB06及客户采购确认邮件", amount: 28600, stage: "S0", stageName: "待立项", owner: "周凯", approver: "周主管", bidDate: "2026-09-16", countdown: 30, probability: 35, riskLevel: "中", health: { relationship: 66, resource: 55, operation: 48 }, strategy: "先完成集采份额、区域履约与产能边界验证，再确定立项策略。", competition: "头部厂商在历史份额与价格上占优，我方需证明能效与交付稳定性。", nextStep: "完成重复项目检查并提交立项审批", relationships: [{ ...relationshipSet[1], id: "REL-GW1", name: "何宇", title: "物资部专责", owner: "周凯", evidence: "采购计划电话确认纪要", lastTouch: "2026-08-15" }], resources: [{ id: "RES-GW1", role: "销售Owner", person: "周凯", status: "已到位", required: true, due: "2026-08-17" }, { id: "RES-GW2", role: "技术预研", person: "待指派", status: "待接受", required: false, due: "2026-08-22" }], partner: { needed: false, type: "待立项确认", name: "—", match: "不需要", certification: "不适用", evidence: "立项阶段暂不要求伙伴", contribution: "不适用" }, actions: [{ id: "ACT-GW1", type: "立项准备", title: "核对省公司集采机会是否已重复登记", purpose: "避免重复项目和Owner冲突", owner: "周凯", due: "2026-08-19", status: "进行中", evidence: "CRM检索截图待上传", result: "待确认" }], risks: [{ id: "RSK-GW1", level: "中", category: "立项", title: "采购份额及包件范围尚未最终发布", owner: "周凯", due: "2026-08-22", status: "开放", evidence: "招标预公告" }], versions: [], deviations: [], externalBid: { id: "BIDAPP-NEW", status: "未启动", owner: "待立项后指派", updatedAt: "—", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0, participants: ["周凯"], sourceLineage: sourceLineage("0821", "线索转入", "市场线索APP", "LEAD-SIGNAL-GWZJ-06", "电网行业部·张驰", "招标预公告及采购确认邮件", ["采购信号 1 条", "客户候选已确认", "开放重复检查任务 1 项"]),
  },
  {
    id: "QJ-2026-0822", name: "南网广东箱变框架采购项目", customer: "南方电网广东公司", target: "预装式箱式变电站 × 180", intentType: "明确需求", evidence: "客户年度框架采购计划GD-BOX-2026", amount: 9200, stage: "S1", stageName: "立项与策略", owner: "吴磊", approver: "周主管", bidDate: "2026-09-05", countdown: 18, probability: 55, riskLevel: "中", health: { relationship: 74, resource: 76, operation: 69 }, strategy: "以广东区域交付网络和全寿命周期运维方案争取框架份额。", competition: "两家本地供应商关系覆盖更深，价格差距尚未确认。", nextStep: "验证商务决策链并确定本地伙伴必要性", relationships: [{ ...relationshipSet[0], id: "REL-GD1", name: "梁志强", title: "设备部副主任", owner: "吴磊" }, { ...relationshipSet[2], id: "REL-GD2", name: "刘工", title: "箱变技术专责", owner: "吴磊" }], resources: [{ id: "RES-GD1", role: "销售Owner", person: "吴磊", status: "已到位", required: true, due: "2026-08-12" }, { id: "RES-GD2", role: "技术负责人", person: "黄工", status: "待接受", required: true, due: "2026-08-20" }, { id: "RES-GD3", role: "高层伙伴", person: "刘总", status: "已到位", required: false, due: "2026-08-22" }], partner: { needed: true, type: "本地服务伙伴", name: "粤电服务公司", match: "候选", certification: "待认证", evidence: "已完成能力初筛，客户关系尚待验证", contribution: "提供区域仓储与服务网点清单" }, actions: [{ id: "ACT-GD1", type: "关系推动", title: "确认采购评审中的商务决策责任人", purpose: "补齐商务决策链", owner: "吴磊", due: "2026-08-21", status: "进行中", evidence: "客户拜访计划", result: "待拜访" }], risks: [{ id: "RSK-GD1", level: "中", category: "伙伴", title: "本地服务伙伴尚未完成客户侧关系验证", owner: "吴磊", due: "2026-08-24", status: "处理中", evidence: "伙伴验证清单" }], versions: [{ ...baseVersions[0], id: "REQ-GD0.6", version: "V0.6", status: "草稿", createdAt: "2026-08-16 09:00", approver: "—", basedOn: "年度采购计划", summary: "框架数量、区域和主要技术范围待客户确认" }], deviations: [], externalBid: { id: "BIDAPP-GD22", status: "未启动", owner: "待指派", updatedAt: "—", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0, participants: ["吴磊"], sourceLineage: sourceLineage("0822", "客户明确需求", "客户经营APP", "DEMAND-GD-BOX-2026", "广东大区·吴磊", "客户年度框架采购计划", ["客户候选 2 人", "伙伴候选 1 家", "历史拜访 2 次"]),
  },
  {
    id: "QJ-2026-0823", name: "印尼工业园电力配套项目", customer: "海川国际工程有限公司", target: "主变、开关柜及海外服务包", intentType: "渠道机会", evidence: "EPC总包商询价函IDN-EP-0826", amount: 12400, stage: "S2", stageName: "需求与方案", owner: "赵颖", approver: "周主管", bidDate: "2026-08-29", countdown: 12, probability: 40, riskLevel: "高", health: { relationship: 48, resource: 52, operation: 58 }, strategy: "先锁定EPC技术边界、海外认证与属地服务责任，再形成可交付方案。", competition: "国际品牌认证优势明显；我方成本有优势但海外履约证据不足。", nextStep: "指定技术负责人并澄清海外认证边界", relationships: [{ ...relationshipSet[1], id: "REL-ID1", name: "Omar", title: "EPC采购经理", attitude: "中立", owner: "赵颖", evidence: "渠道转发询价邮件", lastTouch: "2026-08-13" }], resources: [{ id: "RES-ID1", role: "销售Owner", person: "赵颖", status: "已到位", required: true, due: "2026-08-12" }, { id: "RES-ID2", role: "技术负责人", person: "待指派", status: "缺失", required: true, due: "2026-08-17" }, { id: "RES-ID3", role: "海外商务", person: "王蕾", status: "待接受", required: true, due: "2026-08-19" }], partner: { needed: true, type: "海外认证与服务伙伴", name: "Tawal Engineering", match: "候选", certification: "待认证", evidence: "渠道推荐，尚未完成资质和客户关系验证", contribution: "提供印尼认证清单初稿" }, actions: [{ id: "ACT-ID1", type: "技术澄清", title: "确认IEC标准与印尼本地认证差异", purpose: "关闭方案合规缺口", owner: "待指派", due: "2026-08-20", status: "待开始", evidence: "客户询价附件", result: "未开始" }], risks: [{ id: "RSK-ID1", level: "高", category: "资源", title: "技术负责人未到位，方案澄清无法闭环", owner: "周主管", due: "2026-08-17", status: "开放", evidence: "资源申请RR-ID07" }, { id: "RSK-ID2", level: "高", category: "关系", title: "EPC最终技术决策人尚未覆盖", owner: "赵颖", due: "2026-08-20", status: "开放", evidence: "客户关系地图缺口" }], versions: [{ ...baseVersions[0], id: "REQ-ID0.8", version: "V0.8", status: "生效", approver: "EPC采购经理", basedOn: "IDN-EP-0826", summary: "询价范围已录入，认证与现场边界待澄清" }, { ...baseVersions[1], id: "TECH-ID0.3", version: "V0.3", status: "草稿", approver: "—", basedOn: "REQ-ID0.8", summary: "电气一次方案草稿，未覆盖属地认证" }], deviations: [], externalBid: { id: "BIDAPP-ID23", status: "未启动", owner: "待指派", updatedAt: "—", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0, participants: ["赵颖"], sourceLineage: sourceLineage("0823", "渠道机会", "伙伴协同APP", "CHANNEL-IDN-EP-0826", "海外渠道经理·王蕾", "EPC总包商询价函", ["渠道伙伴候选 1 家", "EPC客户候选 1 人", "开放认证任务 1 项"]),
  },
  {
    id: "QJ-2026-0824", name: "华能沿海升压站改造项目", customer: "华能沿海能源有限公司", target: "220kV主变改造及附件更新", intentType: "RFQ", evidence: "客户技术改造询价HN-2026-081", amount: 15800, stage: "S3", stageName: "核价评审", owner: "李敏", approver: "罗总", bidDate: "2026-08-22", countdown: 5, probability: 65, riskLevel: "中", health: { relationship: 78, resource: 88, operation: 72 }, strategy: "以不停电窗口适配和既有设备改造经验降低客户停机风险。", competition: "客户对价格敏感，但更关注停电窗口和改造责任边界。", nextStep: "审批毛利例外并锁定改造窗口成本", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-HN${i + 1}`, owner: "李敏" })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-HN${i + 1}`, person: i === 0 ? "李敏" : r.person })), partner: { needed: false, type: "不需要", name: "—", match: "不需要", certification: "不适用", evidence: "原厂改造，由内部服务团队承担", contribution: "不适用" }, actions: [{ id: "ACT-HN1", type: "核价协同", title: "确认夜间施工与停电窗口成本", purpose: "完成毛利边界评审", owner: "李敏", due: "2026-08-18", status: "进行中", evidence: "现场踏勘记录HN-SV01", result: "待财务确认" }], risks: [{ id: "RSK-HN1", level: "中", category: "盈利", title: "夜间施工成本可能导致毛利低于目标1.5个百分点", owner: "罗总", due: "2026-08-18", status: "处理中", evidence: "毛利敏感性分析HN-COST" }], versions: [{ ...baseVersions[0], id: "REQ-HN1.0", summary: "改造范围与停电窗口已确认" }, { ...baseVersions[1], id: "TECH-HN1.0", basedOn: "REQ-HN1.0" }, { ...baseVersions[2], id: "COST-HN0.9", version: "V0.9", status: "草稿", approver: "—", basedOn: "TECH-HN1.0", summary: "等待毛利例外审批后固化" }], deviations: [{ id: "DEV-HN01", field: "目标毛利", requirement: "不低于18%", proposal: "16.5%", reason: "夜间施工与短窗口带来额外成本", impact: "预计少1.5个百分点，换取战略客户改造样板", owner: "李敏", status: "待审批", approver: "罗总" }], externalBid: { id: "BIDAPP-HN24", status: "编制中", owner: "林专员", updatedAt: "2026-08-17 14:20", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0, participants: ["李敏"], sourceLineage: sourceLineage("0824", "标书/RFQ触发", "线索APP", "RFQ-HN-2026-081", "能源行业部·李敏", "客户技术改造询价", ["现场踏勘 1 次", "客户关系候选 3 人", "改造窗口风险 1 项"]),
  },
  {
    id: "QJ-2026-0825", name: "中石化炼化变电站改造项目", customer: "中石化华东炼化分公司", target: "110kV主变改造及在线监测系统", intentType: "直接谈判", evidence: "中标通知书SINOPEC-HD-2026-36", amount: 7600, stage: "S6", stageName: "赢单后跟踪", owner: "吴磊", approver: "周主管", bidDate: "2026-07-30", countdown: -18, probability: 100, riskLevel: "低", health: { relationship: 92, resource: 96, operation: 90 }, strategy: "按中标基线守住合同、排产和交付承诺，及时记录下游偏差。", competition: "项目已中标，转入履约协同跟踪。", nextStep: "跟踪合同签署与首批排产状态", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-SH${i + 1}`, owner: "吴磊" })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-SH${i + 1}`, person: i === 0 ? "吴磊" : r.person })), partner: { needed: true, type: "现场服务伙伴", name: "华炼设备服务中心", match: "已验证", certification: "已认证", evidence: "合同附件明确现场服务接口", contribution: "完成现场窗口和安全许可协调" }, actions: [{ id: "ACT-SH1", type: "移交跟踪", title: "确认合同APP与订单系统已接收中标基线", purpose: "保证销售承诺传递到履约端", owner: "吴磊", due: "2026-08-19", status: "进行中", evidence: "移交单TR-SH-0825", result: "合同APP已接收，订单待创建" }], risks: [{ id: "RSK-SH1", level: "低", category: "履约", title: "首批排产确认晚于计划1天", owner: "吴磊", due: "2026-08-20", status: "处理中", evidence: "订单系统只读状态" }], versions: [{ ...baseVersions[0], id: "REQ-SH1.1", status: "生效" }, { ...baseVersions[1], id: "TECH-SH1.0", basedOn: "REQ-SH1.1" }, { ...baseVersions[2], id: "COST-SH1.0", basedOn: "TECH-SH1.0" }, { ...baseVersions[3], id: "BID-SH1.0", version: "V1.0", status: "已提交", basedOn: "COST-SH1.0", approver: "周主管", immutable: true, summary: "中标投标版本，不可覆盖" }], deviations: [], externalBid: { id: "BIDAPP-SH25", status: "已提交", owner: "郭专员", updatedAt: "2026-07-30 16:00", submissionHash: "SHA256 A21C…19F0", receipt: "中标通知书SINOPEC-HD-2026-36" }, result: "won", baseline: { id: "WIN-SH-2026-01", createdAt: "2026-08-02 09:30", approver: "周主管", requirementId: "REQ-SH1.1", technicalId: "TECH-SH1.0", costingId: "COST-SH1.0", bidId: "BID-SH1.0", transferStatus: "已接收", contractRef: "CTR-APP-SH-260811" }, changeCount: 0, participants: ["吴磊"], sourceLineage: sourceLineage("0825", "直接谈判", "客户经营APP", "NEGOTIATION-SH-2026-36", "石化行业部·吴磊", "客户直接谈判纪要及采购确认", ["原客户关系 3 人", "现场服务伙伴 1 家", "历史有效活动 7 条"]),
  },
];

export const initialProjects = (): SalesProject[] => JSON.parse(JSON.stringify(enrichProjects(initial)));

export const glossary = [
  ["核价", "依据技术方案计算采购、制造、物流、风险储备和利润边界的内部评审过程。"],
  ["定价", "在核价基础上，结合客户、竞争与授权规则形成对客价格决策。"],
  ["报价", "经授权后向客户表达价格与商务条件；具体文件作业在投标管理APP完成。"],
  ["阶段门", "项目进入下一管理阶段前必须检查的条件、输出、风险和批准责任。"],
  ["基线", "一组经批准并在某时点生效的版本组合，后续变更必须保留历史并重新评审。"],
  ["偏差", "需求、核价或投标承诺之间的可识别差异，必须说明原因、影响并获得授权。"],
] as const;
