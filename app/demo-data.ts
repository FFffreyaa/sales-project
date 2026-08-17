export type Role = "sales" | "manager";
export type View = "dashboard" | "projects" | "new" | "detail";
export type DetailTab =
  | "overview"
  | "relations"
  | "resources"
  | "actions"
  | "versions"
  | "gate"
  | "result";

export type ProjectStage = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export type RiskLevel = "低" | "中" | "高" | "重大";
export type VersionStatus = "生效" | "已批准" | "已提交" | "需要重新评审" | "历史" | "草稿";

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
}

export interface Partner {
  needed: boolean;
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
  status: "待开始" | "进行中" | "已完成" | "已延期";
  evidence: string;
  result: string;
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
}

export interface ArtifactVersion {
  id: string;
  kind: "客户需求" | "技术方案" | "核价方案" | "投标方案";
  version: string;
  status: VersionStatus;
  createdAt: string;
  creator: string;
  approver: string;
  basedOn: string;
  summary: string;
  immutable?: boolean;
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
  costingId: string;
  bidId: string;
  transferStatus: "待接收" | "已接收";
  contractRef: string;
}

export interface LostReview {
  reason: string;
  competitor: string;
  gap: string;
  evidence: string;
  improvement: string;
}

export interface SalesProject {
  id: string;
  name: string;
  customer: string;
  target: string;
  intentType: string;
  evidence: string;
  amount: number;
  stage: ProjectStage;
  stageName: string;
  owner: string;
  approver: string;
  bidDate: string;
  countdown: number;
  probability: number;
  riskLevel: RiskLevel;
  health: { relationship: number; resource: number; operation: number };
  strategy: string;
  competition: string;
  nextStep: string;
  relationships: Relationship[];
  resources: Resource[];
  partner: Partner;
  actions: ProjectAction[];
  risks: Risk[];
  versions: ArtifactVersion[];
  deviations: Deviation[];
  externalBid: ExternalBidReference;
  result: "pending" | "won" | "lost";
  baseline?: WinningBaseline;
  lostReview?: LostReview;
  changeCount: number;
}

export const stageDefinitions = [
  { code: "S0", name: "待立项", output: "项目基本信息、采购意向证据、Owner" },
  { code: "S1", name: "立项与策略", output: "客户地图、赢单策略、资源计划" },
  { code: "S2", name: "需求与方案", output: "需求基线、技术方案、偏差清单" },
  { code: "S3", name: "核价评审", output: "核价方案、成本、毛利、交期评估" },
  { code: "S4", name: "定价与投标", output: "定价授权、投标版本、提交回执" },
  { code: "S5", name: "结果与移交", output: "中标基线或结构化丢标复盘" },
  { code: "S6", name: "赢单后跟踪", output: "合同、订单、交付、开票、回款只读状态" },
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

const initial: SalesProject[] = [
  {
    id: "QJ-2026-0817", name: "华东水务220kV主变采购项目", customer: "华东水务集团", target: "220kV低损耗电力变压器 × 2", intentType: "RFQ", evidence: "客户RFQ-2026-0718及技术澄清函", amount: 2860, stage: "S3", stageName: "核价评审", owner: "陈晨", approver: "罗总", bidDate: "2026-08-28", countdown: 11, probability: 72, riskLevel: "中", health: { relationship: 82, resource: 100, operation: 78 }, strategy: "以低损耗全寿命周期成本与可验证交期建立差异化优势。", competition: "A厂价格偏低；我方能效与交付证据更完整。", nextStep: "完成核价评审并提交价格授权", relationships: relationshipSet, resources: commonResources, partner: { needed: false, type: "不需要", name: "—", match: "不需要", certification: "不适用", evidence: "直销项目，客户采购主体明确", contribution: "不适用" }, actions: commonActions, risks: [{ id: "RSK-01", level: "中", category: "盈利", title: "铜价波动可能压缩毛利1.2个百分点", owner: "罗总", due: "2026-08-20", status: "处理中", evidence: "核价敏感性分析V1" }], versions: baseVersions, deviations: [], externalBid: { id: "BIDAPP-4108", status: "编制中", owner: "林专员", updatedAt: "2026-08-16 17:20", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 0,
  },
  {
    id: "QJ-2026-0818", name: "西南新能源升压站设备投标项目", customer: "西南新能源开发有限公司", target: "主变及成套设备 × 1批", intentType: "公开招标", evidence: "招标文件XN-2026-330及购买凭证", amount: 4250, stage: "S4", stageName: "定价与投标", owner: "林涛", approver: "周主管", bidDate: "2026-08-19", countdown: 2, probability: 38, riskLevel: "重大", health: { relationship: 42, resource: 50, operation: 55 }, strategy: "先补齐技术与决策关系缺口，再以本地服务能力降低客户风险感知。", competition: "B厂拥有当地合作伙伴优势；C厂以低价策略抢占。", nextStep: "今日补齐技术负责人并完成偏差授权", relationships: [{ id: "REL-H1", layer: "客户高层", name: "李建国", title: "副总经理", attitude: "中立", influence: "高", owner: "刘总", evidence: "一次介绍性会面，无明确承诺", lastTouch: "2026-07-29" }, { id: "REL-H2", layer: "技术层", name: "彭志强", title: "项目技术经理", attitude: "中立", influence: "中", owner: "林涛", evidence: "线上澄清会纪要", lastTouch: "2026-08-14" }], resources: [{ id: "RES-H1", role: "销售Owner", person: "林涛", status: "已到位", required: true, due: "2026-08-10" }, { id: "RES-H2", role: "技术负责人", person: "待指派", status: "缺失", required: true, due: "2026-08-15" }, { id: "RES-H3", role: "高层伙伴", person: "刘总", status: "待接受", required: true, due: "2026-08-16" }, { id: "RES-H4", role: "价格授权人", person: "罗总", status: "已到位", required: true, due: "2026-08-17" }], partner: { needed: true, type: "当地服务伙伴", name: "川能协作公司", match: "候选", certification: "待认证", evidence: "伙伴自述曾服务该客户，尚无客户侧验证", contribution: "提供一次当地项目背景信息" }, actions: [{ id: "ACT-H1", type: "资源协调", title: "确认技术负责人接受项目责任", purpose: "满足投标阶段资源门要求", owner: "周主管", due: "2026-08-17", status: "已延期", evidence: "资源申请单RR-0814", result: "尚未接受" }, { id: "ACT-H2", type: "关系推动", title: "覆盖客户采购决策负责人", purpose: "验证评标偏好和商务决策链", owner: "林涛", due: "2026-08-18", status: "进行中", evidence: "待补充", result: "未完成" }], risks: [{ id: "RSK-H1", level: "重大", category: "交标", title: "距交标仅2天，技术负责人仍未到位", owner: "周主管", due: "2026-08-17", status: "开放", evidence: "资源请求RR-0814未接受" }, { id: "RSK-H2", level: "高", category: "关系", title: "客户关键商务决策人未覆盖", owner: "林涛", due: "2026-08-18", status: "开放", evidence: "客户关系地图缺口检查" }, { id: "RSK-H3", level: "高", category: "方案", title: "交期承诺与核价边界存在待批准偏差", owner: "罗总", due: "2026-08-17", status: "处理中", evidence: "DEV-017" }], versions: [{ ...baseVersions[0], id: "REQ-H1.0", version: "V1.0", summary: "主变、开关柜、交付范围已冻结" }, { ...baseVersions[1], id: "TECH-H0.9", version: "V0.9", basedOn: "REQ-H1.0", approver: "技术评审组" }, { ...baseVersions[2], id: "COST-H1.0", version: "V1.0", basedOn: "TECH-H0.9" }, { ...baseVersions[3], id: "BID-H1.0", version: "V1.0", status: "已批准", basedOn: "COST-H1.0", approver: "周主管", summary: "正式提交候选版，存在1项待授权偏差" }], deviations: [{ id: "DEV-017", field: "交付周期", requirement: "合同生效后150天", proposal: "合同生效后165天", reason: "关键套管采购周期延长", impact: "客户验收计划顺延15天；不影响设备性能，存在商务扣分风险", owner: "林涛", status: "待审批", approver: "罗总" }], externalBid: { id: "BIDAPP-4112", status: "待提交", owner: "郭专员", updatedAt: "2026-08-17 09:10", submissionHash: "待正式提交生成", receipt: "—" }, result: "pending", changeCount: 0,
  },
  {
    id: "QJ-2026-0819", name: "城投数据中心配电扩容项目", customer: "江城投资建设集团", target: "110kV变压器及数字化监测系统", intentType: "增购", evidence: "客户扩容确认函CT-0810与原合同引用", amount: 1980, stage: "S4", stageName: "定价与投标", owner: "孙倩", approver: "周主管", bidDate: "2026-08-25", countdown: 8, probability: 61, riskLevel: "高", health: { relationship: 76, resource: 100, operation: 62 }, strategy: "利用存量设备兼容性与运维数据优势锁定增购。", competition: "原供应优势明显，但客户新增能耗指标带来重评风险。", nextStep: "对变更后的能耗指标重新核价与评审", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-C${i + 1}`, owner: "孙倩" })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-C${i + 1}` })), partner: { needed: true, type: "数字化集成伙伴", name: "江城数科", match: "已验证", certification: "已认证", evidence: "客户确认其为监控平台接口方", contribution: "完成接口协议澄清并提供历史联调记录" }, actions: [{ id: "ACT-C1", type: "客户澄清", title: "确认新能耗指标测量边界", purpose: "形成可重新核价的需求基线", owner: "孙倩", due: "2026-08-18", status: "进行中", evidence: "客户变更函CT-CHG-01", result: "待客户确认测量点" }], risks: [{ id: "RSK-C1", level: "高", category: "方案", title: "已批准核价基于旧需求，须重新评审", owner: "赵工", due: "2026-08-20", status: "处理中", evidence: "需求变更影响分析IA-01" }], versions: [{ ...baseVersions[0], id: "REQ-C1.0", version: "V1.0", status: "历史", summary: "原批准需求：能耗指标按原合同" }, { ...baseVersions[0], id: "REQ-C2.0", version: "V2.0", status: "生效", createdAt: "2026-08-16 10:25", basedOn: "客户变更函CT-CHG-01", summary: "新增更严格空载损耗指标与数字监测点" }, { ...baseVersions[1], id: "TECH-C1.0", version: "V1.0", status: "需要重新评审", basedOn: "REQ-C1.0" }, { ...baseVersions[2], id: "COST-C1.0", version: "V1.0", status: "需要重新评审", basedOn: "TECH-C1.0" }, { ...baseVersions[3], id: "BID-C0.9", version: "V0.9", status: "需要重新评审", basedOn: "COST-C1.0" }], deviations: [], externalBid: { id: "BIDAPP-4118", status: "编制中", owner: "郭专员", updatedAt: "2026-08-16 15:40", submissionHash: "—", receipt: "—" }, result: "pending", changeCount: 1,
  },
  {
    id: "QJ-2026-0820", name: "北方轨交牵引供电设备项目", customer: "北方轨道交通集团", target: "牵引变压器及辅助设备 × 8", intentType: "公开招标", evidence: "正式招标文件BJRT-2026-88", amount: 6730, stage: "S5", stageName: "结果与移交", owner: "陈晨", approver: "周主管", bidDate: "2026-08-12", countdown: -5, probability: 68, riskLevel: "中", health: { relationship: 88, resource: 100, operation: 92 }, strategy: "以轨交业绩、全周期服务和已验证能效形成综合评分优势。", competition: "A厂价格略低，我方技术与服务评分领先。", nextStep: "确认客户评标结果并完成结果处理", relationships: relationshipSet.map((r, i) => ({ ...r, id: `REL-R${i + 1}` })), resources: commonResources.map((r, i) => ({ ...r, id: `RES-R${i + 1}` })), partner: { needed: true, type: "本地服务伙伴", name: "北轨维保科技", match: "已验证", certification: "已认证", evidence: "客户书面确认服务接口", contribution: "组织2次现场踏勘并提供维保方案" }, actions: [{ id: "ACT-R1", type: "结果跟踪", title: "获取正式中标/未中标通知", purpose: "触发移交或复盘", owner: "陈晨", due: "2026-08-18", status: "进行中", evidence: "客户回执BJRT-RCPT-0812", result: "等待正式通知" }], risks: [{ id: "RSK-R1", level: "中", category: "结果", title: "评标结果尚未正式发布", owner: "陈晨", due: "2026-08-18", status: "开放", evidence: "客户回执" }], versions: [{ ...baseVersions[0], id: "REQ-R1.1", status: "生效" }, { ...baseVersions[1], id: "TECH-R1.0", status: "已批准", basedOn: "REQ-R1.1" }, { ...baseVersions[2], id: "COST-R1.0", status: "已批准", basedOn: "TECH-R1.0" }, { ...baseVersions[3], id: "BID-R1.0", version: "V1.0", status: "已提交", basedOn: "COST-R1.0", approver: "周主管", immutable: true, summary: "正式提交版本；已固化，不可覆盖" }], deviations: [{ id: "DEV-R01", field: "付款节点", requirement: "到货验收后30天支付60%", proposal: "到货验收后45天支付60%", reason: "客户统一合同模板", impact: "增加约15天应收占用，财务已计入资金成本", owner: "陈晨", status: "已批准", approver: "罗总" }], externalBid: { id: "BIDAPP-4099", status: "等待结果", owner: "郭专员", updatedAt: "2026-08-12 15:01", submissionHash: "SHA256 9F4A…72C1", receipt: "客户回执BJRT-RCPT-0812" }, result: "pending", changeCount: 0,
  },
];

export const initialProjects = (): SalesProject[] => JSON.parse(JSON.stringify(initial));

export const glossary = [
  ["核价", "依据技术方案计算采购、制造、物流、风险储备和利润边界的内部评审过程。"],
  ["定价", "在核价基础上，结合客户、竞争与授权规则形成对客价格决策。"],
  ["报价", "经授权后向客户表达价格与商务条件；具体文件作业在投标管理APP完成。"],
  ["阶段门", "项目进入下一管理阶段前必须检查的条件、输出、风险和批准责任。"],
  ["基线", "一组经批准并在某时点生效的版本组合，后续变更必须保留历史并重新评审。"],
  ["偏差", "需求、核价或投标承诺之间的可识别差异，必须说明原因、影响并获得授权。"],
] as const;
