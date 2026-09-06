import type {
  ArtifactVersion,
  ConfigurationBaseline,
  CustomerIdentity,
  Milestone,
  Relationship,
  SalesProject,
  ScenarioContext,
  StrategyPlan,
  Competitor,
} from "./demo-data";

type ScenarioProfile = {
  customerIdentity: CustomerIdentity;
  competitors: Competitor[];
  strategyPlan: StrategyPlan;
  milestones: Milestone[];
  configuration: ConfigurationBaseline;
  relationships?: Relationship[];
};

const customer = (
  status: CustomerIdentity["status"],
  sourceName: string,
  sourceSystem: string,
  customerRecordId: string,
  matchCandidates: string[],
  onboardingTask: string,
  creditStatus: string,
): CustomerIdentity => ({ status, sourceName, sourceSystem, customerRecordId, matchCandidates, onboardingTask, creditStatus, lastSyncedAt: "2026-08-17 10:30" });

const competitor = (
  id: string,
  name: string,
  role: Competitor["role"],
  scores: [number, number, number, number],
  evidence: string,
  confidence: Competitor["confidence"] = "中",
): Competitor => ({ id, name, role, relationship: scores[0], technical: scores[1], price: scores[2], delivery: scores[3], evidence, confidence, updatedAt: "2026-08-16" });

const strategy = (
  version: string,
  status: StrategyPlan["status"],
  objective: string,
  owner: string,
  approver: string,
  winThemes: string[],
  mustProve: string[],
  gaps: string[],
  noPromise: string[],
): StrategyPlan => ({ version, status, objective, owner, approver, winThemes, mustProve, gaps, noPromise });

const milestone = (
  id: string,
  title: string,
  plannedAt: string,
  owner: string,
  status: Milestone["status"],
  dependency: string,
  completionCriteria: string,
  evidence: string,
  critical = true,
  actualAt = "—",
): Milestone => ({ id, title, plannedAt, actualAt, owner, status, dependency, completionCriteria, evidence, critical });

const config = (
  id: string,
  version: string,
  status: ConfigurationBaseline["status"],
  approver: string,
  items: ConfigurationBaseline["items"],
): ConfigurationBaseline => ({ id, version, status, createdAt: "2026-08-16 16:20", approver, items });

const item = (
  id: string,
  group: ConfigurationBaseline["items"][number]["group"],
  name: string,
  customerValue: string,
  proposedValue: string,
  status: ConfigurationBaseline["items"][number]["status"],
  source: string,
  impacts: string[],
) => ({ id, group, name, customerValue, proposedValue, status, source, impacts });

const scenarioFor = (project: SalesProject): ScenarioContext => {
  const isEpc = project.id === "QJ-2026-0823" || project.intentType === "渠道机会";
  const isTender = !isEpc && /招标|标书/.test(`${project.intentType}${project.evidence}`);
  if (isEpc) return {
    scenario: "EPC客户询价",
    procurementRequestType: "EPCInquiry",
    endCustomer: "印尼工业园最终业主（待正式识别）",
    procurementFingerprint: "END-IDN-PARK｜IDN-EP｜LOT-01｜主变+开关柜",
    submissionObject: "CustomerRouteQuotation",
    projectAmountRule: "项目预计金额按最终业主采购机会只计一次；不得汇总多家EPC报价",
    relationshipViews: { endCustomer: 32, procurementCustomer: project.health.relationship },
    quotationRoutes: [
      { id: "QR-IDN-01", epcCustomer: "海川国际工程有限公司", inquiryRequests: 2, quoteVersion: "QR-Q-V1.0", quotedAmount: 12400, authorizedFloorPrice: 11680, status: "已报价", pricingConclusion: "同标同价", contractCustomer: "待结果确认", evidence: "EPC询价函IDN-EP-0826及报价回执", updatedAt: "2026-08-17 09:30" },
      { id: "QR-IDN-02", epcCustomer: "东盟能源工程公司", inquiryRequests: 1, quoteVersion: "QR-Q-V0.8", quotedAmount: 12400, authorizedFloorPrice: 11680, status: "待报价", pricingConclusion: "同标同价", contractCustomer: "待结果确认", evidence: "同一终端项目询价邮件ASEAN-RFQ-18", updatedAt: "2026-08-16 16:10" },
      { id: "QR-IDN-03", epcCustomer: "Nusantara EPC Consortium", inquiryRequests: 1, quoteVersion: "QR-Q-V0.6", quotedAmount: 12680, authorizedFloorPrice: 11680, status: "询价澄清", pricingConclusion: "条款差异已授权", contractCustomer: "待结果确认", evidence: "含属地服务条款的差异授权PA-IDN-03", updatedAt: "2026-08-16 11:20" },
    ],
    bidRounds: [],
  };
  return {
    scenario: isTender ? "客户直接投标" : "客户直接询价",
    procurementRequestType: isTender ? "TenderRequest" : "DirectRFQ",
    endCustomer: project.customer,
    procurementFingerprint: `${project.customer}｜${project.sourceLineage?.sourceRecordId ?? project.id}｜LOT-01｜${project.target}`,
    submissionObject: isTender ? "DirectBidSubmission" : "DirectQuotation",
    projectAmountRule: "一个可独立报价、决策和形成结果的采购机会对应一个SalesProject",
    relationshipViews: { endCustomer: project.health.relationship, procurementCustomer: project.health.relationship },
    quotationRoutes: [],
    bidRounds: [],
  };
};

const alignedVersions = (project: SalesProject): ArtifactVersion[] => {
  const existing = project.versions.filter(version => version.kind !== "设计BOM" && version.kind !== "授权底价");
  const latestTechnical = existing.filter(version => version.kind === "技术方案").at(-1);
  const latestCosting = existing.filter(version => version.kind === "核价方案").at(-1);
  const bom: ArtifactVersion | undefined = latestTechnical ? {
    id: `DBOM-${project.id.slice(-4)}-${latestTechnical.version.replace("V", "")}`,
    kind: "设计BOM",
    version: latestTechnical.version,
    status: latestTechnical.status,
    createdAt: latestTechnical.createdAt,
    creator: "技术/设计系统",
    approver: latestTechnical.approver,
    basedOn: latestTechnical.id,
    summary: "报价设计BOM只读引用；生产BOM与图纸仍由专业系统维护",
    immutable: latestTechnical.immutable,
  } : undefined;
  const floor: ArtifactVersion | undefined = latestCosting ? {
    id: `FLOOR-${project.id.slice(-4)}-${latestCosting.version.replace("V", "")}`,
    kind: "授权底价",
    version: latestCosting.version,
    status: latestCosting.status,
    createdAt: latestCosting.createdAt,
    creator: "价格授权系统",
    approver: latestCosting.approver,
    basedOn: latestCosting.id,
    summary: "有效授权底价只读引用；低于底价必须走例外授权",
    immutable: latestCosting.immutable,
  } : undefined;
  const adjusted = existing.map(version => version.kind === "核价方案" && bom ? { ...version, basedOn: bom.id } : version.kind === "投标方案" && floor ? { ...version, basedOn: floor.id } : version);
  const result = [...adjusted, ...(bom ? [bom] : []), ...(floor ? [floor] : [])];
  const order: ArtifactVersion["kind"][] = ["客户需求", "技术方案", "设计BOM", "核价方案", "授权底价", "投标方案"];
  return result.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
};

const profiles: Record<string, ScenarioProfile> = {
  "QJ-2026-0817": {
    customerIdentity: customer("已准入", "华东水务集团", "客户经营APP", "CUS-HD-00128", [], "无需建档", "A级｜额度正常"),
    competitors: [competitor("CMP-17A", "东方变压器", "主要对手", [65, 72, 86, 70], "客户采购主任确认其报价约低3%，未见正式报价", "中"), competitor("CMP-17B", "本地维保联合体", "替代方案", [78, 50, 74, 82], "客户设备处讨论分包改造方案", "低")],
    strategyPlan: strategy("STR-17-V2", "已批准", "以全寿命周期成本和可验证交期进入技术商务综合第一", "陈晨", "罗总", ["低损耗节省可量化", "关键物料锁产能", "原厂服务责任单一"], ["五年能耗节省覆盖价格差", "两台设备可按客户窗口分批交付"], ["采购端仍在比较初始价格", "铜价保护条款尚未解释"], ["不承诺未经计划确认的120天交付"]),
    milestones: [milestone("MS-17-1", "客户需求冻结", "08-10", "陈晨", "已完成", "RFQ澄清完成", "客户确认需求清单", "澄清纪要02", true, "08-10"), milestone("MS-17-2", "技术方案评审", "08-12", "赵工", "已完成", "需求冻结", "技术评审组批准", "TECH-1.1", true, "08-12"), milestone("MS-17-3", "核价评审", "08-20", "罗总", "进行中", "技术方案批准", "毛利与交期边界批准", "核价敏感性分析V1"), milestone("MS-17-4", "价格授权", "08-22", "罗总", "未开始", "核价评审", "取得价格授权编号", "待形成"), milestone("MS-17-5", "正式交标", "08-28", "林专员", "未开始", "价格授权", "投标APP回执及哈希", "待形成")],
    configuration: config("CFG-17-01", "V1.2", "已冻结", "技术评审组", [item("CI-17-1", "产品范围", "供货范围", "220kV主变×2", "220kV主变×2", "一致", "REQ-1.2", ["技术", "核价", "投标"]), item("CI-17-2", "技术参数", "空载损耗", "≤42kW", "≤40.8kW", "一致", "技术澄清02", ["技术", "核价"]), item("CI-17-3", "交付服务", "交付方式", "一次性交付", "分两批交付", "待确认", "客户电话纪要", ["核价", "交期", "投标"]), item("CI-17-4", "商务条款", "铜价联动", "固定价", "90天后联动", "待确认", "核价策略", ["定价", "合同"])]),
    relationships: [
      { id: "REL-17-1", layer: "客户高层", name: "周明远", title: "集团副总经理", attitude: "支持", influence: "高", owner: "刘总", evidence: "8月12日高层会谈认可节能改造路线", lastTouch: "2026-08-12" },
      { id: "REL-17-2", layer: "商务决策链", name: "许文博", title: "采购部主任", attitude: "中立", influence: "高", owner: "陈晨", evidence: "采购澄清邮件，重点关注初始价格与付款", lastTouch: "2026-08-15" },
      { id: "REL-17-3", layer: "商务决策链", name: "韩蕾", title: "财务预算经理", attitude: "支持", influence: "中", owner: "陈晨", evidence: "认可五年TCO测算口径", lastTouch: "2026-08-14" },
      { id: "REL-17-4", layer: "技术层", name: "王海峰", title: "设备技术主管", attitude: "支持", influence: "高", owner: "赵工", evidence: "参数确认单及技术交流纪要", lastTouch: "2026-08-16" },
    ],
  },
  "QJ-2026-0818": {
    customerIdentity: customer("客户建档中", "西南新能源开发有限公司", "招投标信息平台", "TMP-CUS-0818", ["西南新能源开发集团", "西南新能源工程公司"], "CUS-ONB-026｜待统一社会信用代码", "信用调查未开始"),
    competitors: [competitor("CMP-18A", "蜀能电气", "在位供应商", [92, 68, 76, 88], "当地伙伴提供的近两年供货记录，客户侧尚未确认", "中"), competitor("CMP-18B", "中原变压器", "低价挑战者", [55, 70, 95, 62], "第三方招标交流会报价区间信息", "低")],
    strategyPlan: strategy("STR-18-V1", "需要更新", "先关闭客户身份、技术资源和交期偏差，再争取服务评分抵消关系劣势", "林涛", "周主管", ["西南服务驻点", "成套接口单一责任", "交期风险透明化"], ["165天交付获得客户接受", "当地伙伴能获得客户侧认可"], ["商务决策人未覆盖", "技术负责人缺失", "DEV-017待批准"], ["不以未批准的150天交期参与正式提交"]),
    milestones: [milestone("MS-18-1", "采购主体确认", "08-15", "林涛", "已延期", "客户系统匹配", "取得正式采购主体编号", "CUS-ONB-026"), milestone("MS-18-2", "技术负责人到位", "08-16", "周主管", "受阻", "资源申请接受", "负责人接受项目责任", "RR-0814"), milestone("MS-18-3", "偏差授权", "08-17", "罗总", "进行中", "交期影响分析", "DEV-017形成审批结论", "DEV-017"), milestone("MS-18-4", "正式投标提交", "08-19", "郭专员", "受阻", "技术资源+偏差授权", "提交哈希和客户回执", "当前存在3项阻断")],
    configuration: config("CFG-18-03", "V1.0", "草稿", "待批准", [item("CI-18-1", "产品范围", "成套范围", "主变+开关柜+监控", "主变+开关柜+监控", "一致", "REQ-H1.0", ["技术", "核价", "投标"]), item("CI-18-2", "交付服务", "交付周期", "150天", "165天", "存在偏差", "DEV-017", ["投标", "客户验收", "合同"]), item("CI-18-3", "认证合规", "当地服务响应", "4小时", "伙伴承诺4小时", "待确认", "伙伴自述", ["伙伴", "投标"]), item("CI-18-4", "商务条款", "质保金", "10%/24个月", "10%/24个月", "一致", "招标文件", ["核价", "合同"])]),
  },
  "QJ-2026-0819": {
    customerIdentity: customer("已匹配正式客户", "江城投资建设集团", "客户经营APP", "CUS-JC-00417", [], "无需建档", "B级｜增购额度待刷新"),
    competitors: [competitor("CMP-19A", "原监测系统供应商", "在位供应商", [86, 82, 70, 74], "原合同和最近一次运维会议记录", "高"), competitor("CMP-19B", "云控能源", "低价挑战者", [48, 76, 90, 68], "客户技术人员透露的替代方案", "中")],
    strategyPlan: strategy("STR-19-V3", "需要更新", "利用存量设备兼容性与运维数据优势锁定增购，同时重新证明新能耗指标", "孙倩", "周主管", ["不停机兼容升级", "历史运维数据完整", "接口改造责任清晰"], ["V2需求下仍能达到能耗指标", "新增监测点不影响交付窗口"], ["原策略基于V1需求", "核价与投标版本需要重评"], ["不沿用旧核价直接报价"]),
    milestones: [milestone("MS-19-1", "原需求核价批准", "08-12", "罗总", "已完成", "V1需求冻结", "核价方案批准", "COST-C1.0", true, "08-12"), milestone("MS-19-2", "客户需求变更", "08-16", "孙倩", "已完成", "客户变更函", "形成V2需求版本", "REQ-C2.0", true, "08-16"), milestone("MS-19-3", "技术影响复评", "08-20", "赵工", "进行中", "V2需求生效", "技术方案重新批准", "IA-01"), milestone("MS-19-4", "核价重新评审", "08-22", "罗总", "受阻", "技术复评", "新核价批准", "等待TECH-C2.0"), milestone("MS-19-5", "更新投标版本", "08-24", "郭专员", "受阻", "核价重评", "形成可提交投标版本", "等待COST-C2.0")],
    configuration: config("CFG-19-02", "V2.0", "需要重新评审", "客户项目经理", [item("CI-19-1", "技术参数", "空载损耗", "≤36kW", "旧方案38kW", "需要重新评审", "REQ-C2.0", ["技术", "核价", "投标"]), item("CI-19-2", "技术参数", "数字监测点", "24点", "旧方案16点", "需要重新评审", "CT-CHG-01", ["技术", "集成伙伴", "核价"]), item("CI-19-3", "产品范围", "主变数量", "2台", "2台", "一致", "REQ-C2.0", ["技术", "核价"]), item("CI-19-4", "交付服务", "停机窗口", "连续8小时", "连续8小时", "一致", "原合同附件", ["实施", "合同"])]),
    relationships: [
      { id: "REL-19-1", layer: "客户高层", name: "郑宏达", title: "集团信息化副总", attitude: "支持", influence: "高", owner: "孙倩", evidence: "扩容立项会明确要求兼容原平台", lastTouch: "2026-08-11" },
      { id: "REL-19-2", layer: "商务决策链", name: "周静", title: "采购经理", attitude: "中立", influence: "高", owner: "孙倩", evidence: "要求需求变更后重新比价", lastTouch: "2026-08-16" },
      { id: "REL-19-3", layer: "技术层", name: "顾磊", title: "数据中心运维负责人", attitude: "支持", influence: "高", owner: "赵工", evidence: "确认兼容性优先于最低初始价格", lastTouch: "2026-08-16" },
      { id: "REL-19-4", layer: "技术层", name: "沈工", title: "能耗评审专家", attitude: "反对", influence: "中", owner: "赵工", evidence: "指出旧方案未达到新空载损耗指标", lastTouch: "2026-08-16" },
    ],
  },
  "QJ-2026-0820": {
    customerIdentity: customer("已准入", "北方轨道交通集团", "客户经营APP", "CUS-BJRT-00031", [], "无需建档", "A级｜重大项目白名单"),
    competitors: [competitor("CMP-20A", "北电装备", "主要对手", [72, 84, 88, 74], "客户回执及投标前评分模拟", "高"), competitor("CMP-20B", "轨交电气联合体", "替代方案", [82, 72, 68, 90], "本地维保资源调查", "中")],
    strategyPlan: strategy("STR-20-V4", "已批准", "以轨交业绩、能效和本地维保取得综合评分领先", "陈晨", "周主管", ["同线路在运业绩", "能效保证可验证", "两小时维保响应"], ["客户认可全周期服务评分", "维保伙伴进入正式服务清单"], ["最终价格得分未知"], ["不追加未经授权的免费备件"]),
    milestones: [milestone("MS-20-1", "投标版本冻结", "08-11", "周主管", "已完成", "定价授权", "正式投标版本锁定", "BID-R1.0", true, "08-11"), milestone("MS-20-2", "正式提交", "08-12", "郭专员", "已完成", "版本冻结", "客户回执及哈希", "BJRT-RCPT-0812", true, "08-12"), milestone("MS-20-3", "评标澄清", "08-15", "赵工", "已完成", "客户通知", "澄清回复已接收", "澄清回执03", false, "08-15"), milestone("MS-20-4", "结果确认", "08-18", "陈晨", "进行中", "评标结束", "取得正式结果通知", "等待客户发布"), milestone("MS-20-5", "赢单移交/丢标复盘", "08-19", "周主管", "未开始", "结果确认", "完成对应结果分支", "待形成")],
    configuration: config("CFG-20-05", "V1.0", "已冻结", "周主管", [item("CI-20-1", "产品范围", "牵引变压器", "8台", "8台", "一致", "REQ-R1.1", ["技术", "核价", "投标"]), item("CI-20-2", "交付服务", "本地维保响应", "2小时", "2小时", "一致", "伙伴承诺函", ["投标", "合同"]), item("CI-20-3", "商务条款", "付款节点", "到货30天付60%", "到货45天付60%", "存在偏差", "DEV-R01已批准", ["资金成本", "合同"]), item("CI-20-4", "认证合规", "轨交业绩", "同类线路3项", "提供5项", "一致", "业绩证明包", ["投标评分"])]),
    relationships: [
      { id: "REL-20-1", layer: "客户高层", name: "马成业", title: "建设事业部总经理", attitude: "支持", influence: "高", owner: "刘总", evidence: "高层交流确认重视全生命周期可靠性", lastTouch: "2026-08-05" },
      { id: "REL-20-2", layer: "商务决策链", name: "叶宁", title: "招采中心副主任", attitude: "中立", influence: "高", owner: "陈晨", evidence: "投标澄清仅确认程序与回执，不透露评标结果", lastTouch: "2026-08-15" },
      { id: "REL-20-3", layer: "技术层", name: "赵启山", title: "供电专业总工", attitude: "支持", influence: "高", owner: "赵工", evidence: "技术澄清回复认可我方能效计算", lastTouch: "2026-08-15" },
    ],
  },
  "QJ-2026-0821": {
    customerIdentity: customer("待选择匹配客户", "国网浙江省电力有限公司", "市场线索APP", "TMP-CUS-0821", ["国网浙江省电力有限公司", "国网浙江物资有限公司"], "CUS-MATCH-041｜确认采购主体", "待主体确认后查询"),
    competitors: [competitor("CMP-21A", "华中配变", "在位供应商", [88, 75, 82, 90], "历史集采公示份额", "高"), competitor("CMP-21B", "海岳电气", "低价挑战者", [62, 66, 94, 70], "行业报价区间，尚无本项目证据", "低")],
    strategyPlan: strategy("STR-21-D0", "草稿", "先确认包件、份额和产能边界，再决定是否投入集采资源", "周凯", "周主管", ["高效节能系列", "区域备货能力"], ["目标包件适配现有产线", "交付峰值不挤占重点订单"], ["采购主体未匹配", "包件尚未发布", "产能边界待评估"], ["不在包件未知时承诺最低价"]),
    milestones: [milestone("MS-21-1", "客户主体匹配", "08-19", "周凯", "进行中", "线索转入", "选择正式客户主数据", "CUS-MATCH-041"), milestone("MS-21-2", "重复项目检查", "08-19", "周凯", "进行中", "客户主体匹配", "确认无Owner冲突", "CRM检索待上传"), milestone("MS-21-3", "包件范围确认", "08-22", "周凯", "未开始", "招标公告发布", "数量与区域明确", "等待公告"), milestone("MS-21-4", "立项决策", "08-23", "周主管", "受阻", "重复检查+包件范围", "批准/退回/终止结论", "等待输入")],
    configuration: config("CFG-21-00", "V0.1", "未形成", "—", [item("CI-21-1", "产品范围", "集采数量", "预估420台", "待公告", "待确认", "采购预公告", ["立项", "产能", "核价"]), item("CI-21-2", "技术参数", "能效等级", "一级能效", "现有平台可覆盖", "待确认", "预公告", ["技术", "成本"]), item("CI-21-3", "交付服务", "区域分仓", "待公告", "浙江区域仓", "待确认", "市场判断", ["物流", "伙伴"])]),
  },
  "QJ-2026-0822": {
    customerIdentity: customer("已匹配正式客户", "南方电网广东公司", "客户经营APP", "CUS-CSG-GD-0008", [], "无需建档", "A级｜框架采购准入有效"),
    competitors: [competitor("CMP-22A", "粤能设备", "在位供应商", [93, 72, 80, 91], "近三年框架份额公示与客户拜访", "高"), competitor("CMP-22B", "珠江电气", "主要对手", [84, 80, 78, 86], "伙伴提供的区域履约记录", "中")],
    strategyPlan: strategy("STR-22-V1", "待主管评审", "以区域交付网络与全生命周期运维争取框架前二和30%份额", "吴磊", "周主管", ["区域仓储覆盖", "统一运维平台", "批次柔性交付"], ["本地服务伙伴获得客户认可", "批次峰值产能可兑现"], ["商务决策责任人未确认", "价格差距尚未量化"], ["不承诺超过已评估产能的月度批次"]),
    milestones: [milestone("MS-22-1", "框架需求边界", "08-20", "吴磊", "进行中", "年度计划确认", "区域、批次和数量形成需求草案", "REQ-GD0.6"), milestone("MS-22-2", "商务决策链验证", "08-21", "吴磊", "进行中", "客户拜访", "识别最终评审与份额建议人", "拜访计划"), milestone("MS-22-3", "伙伴关系验证", "08-24", "渠道经理", "未开始", "客户侧确认", "伙伴匹配转为已验证", "伙伴验证清单"), milestone("MS-22-4", "策略批准", "08-25", "周主管", "受阻", "决策链+伙伴验证", "STR-22-V1批准", "等待输入")],
    configuration: config("CFG-22-01", "V0.6", "草稿", "—", [item("CI-22-1", "产品范围", "箱变数量", "年度约180台", "按4区域分批", "待确认", "GD-BOX-2026", ["产能", "物流", "核价"]), item("CI-22-2", "技术参数", "典型容量", "630/800kVA", "两平台组合", "一致", "年度技术规范", ["技术", "成本"]), item("CI-22-3", "交付服务", "区域仓", "广东四区", "粤电服务仓网", "待确认", "伙伴方案", ["伙伴", "物流", "投标"])]),
  },
  "QJ-2026-0823": {
    customerIdentity: customer("临时项目客户", "海川国际工程有限公司 / 最终业主待确认", "伙伴协同APP", "TMP-CUS-IDN-23", ["海川国际工程有限公司"], "CUS-ONB-IDN-03｜识别最终业主", "EPC信用正常｜最终业主未知"),
    competitors: [competitor("CMP-23A", "Global Grid Systems", "主要对手", [70, 92, 62, 82], "EPC采购经理口头反馈其认证完整", "中"), competitor("CMP-23B", "印尼本地成套商", "低价挑战者", [88, 58, 96, 90], "渠道伙伴市场判断，未获客户验证", "低")],
    strategyPlan: strategy("STR-23-D2", "待主管评审", "先锁定EPC与最终业主边界，以认证伙伴和总成本优势形成可交付方案", "赵颖", "周主管", ["成本优势", "EPC接口单一", "伙伴属地认证"], ["最终业主接受中国业绩", "Tawal认证与服务能力真实有效"], ["最终技术决策人未知", "技术负责人缺失", "当地认证范围未冻结"], ["不承担未明确的当地土建和清关责任"]),
    milestones: [milestone("MS-23-1", "最终业主识别", "08-19", "赵颖", "进行中", "渠道引荐", "取得业主法定名称和技术接口", "CUS-ONB-IDN-03"), milestone("MS-23-2", "技术负责人到位", "08-17", "周主管", "已延期", "资源申请", "负责人接受责任", "RR-ID07"), milestone("MS-23-3", "认证差异澄清", "08-20", "待指派", "受阻", "技术负责人到位", "形成认证适用清单", "印尼认证清单初稿"), milestone("MS-23-4", "技术方案评审", "08-23", "技术评审组", "受阻", "业主+认证澄清", "TECH-ID1.0批准", "等待输入")],
    configuration: config("CFG-23-01", "V0.3", "草稿", "—", [item("CI-23-1", "认证合规", "印尼SNI认证", "是否适用待澄清", "伙伴建议适用", "待确认", "渠道询价附件", ["技术", "伙伴", "投标"]), item("CI-23-2", "交付服务", "清关责任", "未明确", "建议EPC承担", "待确认", "询价函", ["核价", "合同", "风险"]), item("CI-23-3", "产品范围", "成套边界", "主变+开关柜", "不含土建", "存在偏差", "TECH-ID0.3", ["技术", "核价", "投标"]), item("CI-23-4", "技术参数", "适用标准", "IEC+当地规范", "IEC方案", "需要重新评审", "REQ-ID0.8", ["技术", "认证"])]),
  },
  "QJ-2026-0824": {
    customerIdentity: customer("已准入", "华能沿海能源有限公司", "客户经营APP", "CUS-HN-00219", [], "无需建档", "A级｜存量改造客户"),
    competitors: [competitor("CMP-24A", "沿海检修服务公司", "替代方案", [88, 55, 84, 92], "客户设备处曾考虑局部检修替代整体改造", "高"), competitor("CMP-24B", "东海电气", "主要对手", [68, 78, 89, 65], "客户采购交流与公开业绩", "中")],
    strategyPlan: strategy("STR-24-V2", "已批准", "以原厂兼容性和不停电窗口设计降低停机损失，接受受控毛利例外", "李敏", "罗总", ["原厂图纸完整", "短窗口施工经验", "改造责任单一"], ["夜间施工成本边界可控", "客户认可停机损失高于价差"], ["毛利低于目标1.5个百分点"], ["不接受未踏勘设备的总价包干"]),
    milestones: [milestone("MS-24-1", "现场踏勘", "08-14", "李敏", "已完成", "客户许可", "完成设备状态与窗口记录", "HN-SV01", true, "08-14"), milestone("MS-24-2", "改造方案冻结", "08-16", "赵工", "已完成", "现场踏勘", "技术评审批准", "TECH-HN1.0", true, "08-16"), milestone("MS-24-3", "毛利例外审批", "08-18", "罗总", "进行中", "夜间施工成本", "DEV-HN01批准/拒绝", "HN-COST"), milestone("MS-24-4", "核价基线", "08-19", "核价组", "受阻", "毛利例外审批", "COST-HN1.0批准", "等待审批"), milestone("MS-24-5", "报价提交", "08-22", "林专员", "未开始", "核价基线", "客户报价回执", "待形成")],
    configuration: config("CFG-24-04", "V1.0", "已冻结", "技术评审组", [item("CI-24-1", "产品范围", "改造范围", "主变本体+附件", "原厂改造包", "一致", "REQ-HN1.0", ["技术", "核价"]), item("CI-24-2", "交付服务", "停电窗口", "夜间8小时×3次", "可满足", "一致", "HN-SV01", ["施工", "核价", "交期"]), item("CI-24-3", "商务条款", "目标毛利", "≥18%", "16.5%", "存在偏差", "DEV-HN01", ["核价", "授权"]), item("CI-24-4", "技术参数", "原设备兼容", "保持保护接口", "原厂图纸验证", "一致", "TECH-HN1.0", ["技术", "实施"])]),
    relationships: [
      { id: "REL-24-1", layer: "客户高层", name: "杜勇", title: "生产副总经理", attitude: "支持", influence: "高", owner: "刘总", evidence: "确认停机损失是项目首要约束", lastTouch: "2026-08-13" },
      { id: "REL-24-2", layer: "商务决策链", name: "何静", title: "采购经理", attitude: "中立", influence: "高", owner: "李敏", evidence: "要求解释毛利例外后的报价合理性", lastTouch: "2026-08-16" },
      { id: "REL-24-3", layer: "技术层", name: "宋建军", title: "设备部长", attitude: "支持", influence: "高", owner: "赵工", evidence: "现场踏勘确认原厂图纸与接口优势", lastTouch: "2026-08-14" },
    ],
  },
  "QJ-2026-0825": {
    customerIdentity: customer("已准入", "中石化华东炼化分公司", "客户经营APP", "CUS-SH-00076", [], "无需建档", "A级｜合同额度已锁定"),
    competitors: [competitor("CMP-25A", "项目已中标｜历史对手：华东电气", "主要对手", [70, 78, 86, 72], "中标结果与客户复盘摘要", "高")],
    strategyPlan: strategy("STR-25-W1", "已批准", "按中标基线守住合同、排产和现场窗口，所有新增承诺走变更", "吴磊", "周主管", ["中标承诺完整移交", "原厂改造责任", "现场许可提前准备"], ["合同引用中标配置基线", "订单排产不遗漏停电窗口"], ["首批排产晚于计划1天"], ["不口头接受中标基线外新增范围"]),
    milestones: [milestone("MS-25-1", "中标基线生成", "08-02", "周主管", "已完成", "中标通知", "基线包锁定", "WIN-SH-2026-01", true, "08-02"), milestone("MS-25-2", "合同APP接收", "08-11", "合同管理员", "已完成", "中标基线", "合同APP确认接收", "CTR-APP-SH-260811", true, "08-11"), milestone("MS-25-3", "合同签署", "08-19", "合同管理员", "进行中", "合同评审", "正式合同生效", "合同APP只读状态"), milestone("MS-25-4", "订单与首批排产", "08-20", "订单管理员", "已延期", "合同生效", "订单创建并锁定排产", "订单系统待创建"), milestone("MS-25-5", "现场窗口确认", "08-25", "吴磊", "未开始", "订单计划", "客户现场许可确认", "待形成")],
    configuration: config("WIN-SH-2026-01", "V1.0", "中标基线", "周主管", [item("CI-25-1", "产品范围", "改造设备", "110kV主变+在线监测", "110kV主变+在线监测", "一致", "REQ-SH1.1", ["合同", "订单", "交付"]), item("CI-25-2", "交付服务", "现场窗口", "2026年10月检修期", "合同待固化", "待确认", "中标澄清", ["合同", "排产", "现场"]), item("CI-25-3", "商务条款", "中标金额", "7,600万元", "7,600万元", "一致", "中标通知书", ["合同", "订单"]), item("CI-25-4", "认证合规", "炼化安全许可", "入场前完成", "服务中心办理", "一致", "中标基线", ["现场交付"])]),
    relationships: [
      { id: "REL-25-1", layer: "客户高层", name: "彭庆华", title: "分公司副总经理", attitude: "支持", influence: "高", owner: "刘总", evidence: "中标后启动会明确要求承诺完整移交", lastTouch: "2026-08-04" },
      { id: "REL-25-2", layer: "商务决策链", name: "姜楠", title: "合同采购经理", attitude: "中立", influence: "高", owner: "吴磊", evidence: "合同谈判纪要，重点关注变更和付款节点", lastTouch: "2026-08-15" },
      { id: "REL-25-3", layer: "技术层", name: "郭海", title: "炼化设备主任", attitude: "支持", influence: "高", owner: "赵工", evidence: "中标技术协议和现场窗口确认邮件", lastTouch: "2026-08-12" },
      { id: "REL-25-4", layer: "技术层", name: "石伟", title: "安全管理工程师", attitude: "中立", influence: "中", owner: "吴磊", evidence: "入场许可清单待完整提交", lastTouch: "2026-08-13" },
    ],
  },
};

export function enrichProjects(projects: SalesProject[]): SalesProject[] {
  return projects.map((project) => {
    const profile = profiles[project.id];
    const merged = profile ? { ...project, ...profile, relationships: profile.relationships ?? project.relationships } : project;
    const roleCapability: Record<string, string[]> = {
      "销售Owner": ["复杂项目经营", "客户关系推动", "商业闭环"],
      "技术负责人": ["变压器方案", project.target.includes("海外") || project.id === "QJ-2026-0823" ? "IEC与海外认证" : "技术评审", "需求澄清"],
      "高层伙伴": ["高层关系协同", "重大项目决策"],
      "价格授权人": ["核价与定价", "毛利边界审批"],
      "海外商务": ["海外商务条款", "属地伙伴协同"],
      "技术预研": ["产品平台匹配", "产能边界预研"],
    };
    const resources = merged.resources.map((resource, index) => {
      const missing = resource.status === "缺失" || resource.person === "待指派";
      const load = missing ? 0 : Math.min(96, 54 + ((project.id.charCodeAt(project.id.length - 1) + index * 13) % 40));
      return {
        ...resource,
        capabilities: roleCapability[resource.role] ?? ["项目协同", "专业评审"],
        certifications: resource.role.includes("技术") ? [project.id === "QJ-2026-0823" ? "IEC项目经验" : "技术评审资格"] : resource.role === "价格授权人" ? ["价格授权L2"] : [],
        load,
        activeProjects: missing ? 0 : Math.max(1, Math.round(load / 22)),
        availableFrom: missing ? "待主管配置" : load >= 85 ? "2026-08-22" : "可立即投入",
        dataSource: "资源能力中心｜只读模拟",
      };
    });
    const gradeByProject: Record<string, "S" | "A" | "B"> = {
      "QJ-2026-0817": "A", "QJ-2026-0818": "S", "QJ-2026-0819": "B",
      "QJ-2026-0820": "A", "QJ-2026-0821": "S", "QJ-2026-0822": "A",
      "QJ-2026-0823": "S", "QJ-2026-0824": "A", "QJ-2026-0825": "A",
    };
    const importanceByProject: Record<string, "普通" | "重点" | "重大"> = {
      "QJ-2026-0817": "重点", "QJ-2026-0818": "重大", "QJ-2026-0819": "普通",
      "QJ-2026-0820": "重点", "QJ-2026-0821": "重大", "QJ-2026-0822": "重点",
      "QJ-2026-0823": "重大", "QJ-2026-0824": "重点", "QJ-2026-0825": "重点",
    };
    const organizationByOwner: Record<string, string> = {
      "陈晨": "华东销售大区", "林涛": "西南销售大区", "孙倩": "行业客户部",
      "周凯": "电网行业部", "吴磊": "南方销售大区", "赵颖": "国际业务部", "李敏": "能源行业部",
    };
    const planDates = ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17"];
    const actions = merged.actions.map((action, index) => ({
      ...action,
      plannedStart: action.plannedStart ?? planDates[index % planDates.length],
      plannedEnd: action.plannedEnd ?? action.due,
      actualStart: action.actualStart ?? (action.status === "待开始" ? "—" : planDates[Math.min(index + 1, planDates.length - 1)]),
      actualEnd: action.actualEnd ?? (action.status === "已完成" ? action.due : "—"),
      progress: action.progress ?? (action.status === "已完成" ? 100 : action.status === "进行中" ? 55 : action.status === "已延期" ? 70 : 0),
    }));
    const hasTech = resources.some(resource => resource.role.includes("技术") && resource.status === "已到位");
    const partnerReady = !merged.partner.needed || merged.partner.match === "已验证";
    const competitivePosition = {
      relationship: merged.health.relationship,
      technical: hasTech ? Math.min(94, 70 + Math.round(merged.health.resource / 5)) : Math.max(35, merged.health.resource - 5),
      price: Math.max(48, Math.min(90, 68 + Math.round((merged.probability - 50) / 4))),
      delivery: Math.max(45, Math.min(94, Math.round((merged.health.resource + merged.health.operation) / 2))),
      service: partnerReady ? 86 : 58,
      confidence: merged.stage === "S0" || merged.stage === "S1" ? "低" as const : merged.stage === "S2" ? "中" as const : "高" as const,
      evidence: merged.stage === "S0" ? "立项前项目团队初判，待形成客户证据" : "基于客户关系、方案评审、资源和伙伴事实的项目团队判断",
    };
    const milestones = (merged.milestones ?? []).map(item => {
      if (merged.stage !== "S6") return { ...item, scope: "销售项目" as const };
      const external = /合同签署|订单|排产|交付|现场窗口/.test(item.title);
      return { ...item, scope: external ? "外部只读" as const : "销售项目" as const, sourceSystem: external ? /合同/.test(item.title) ? "合同APP" : /订单|排产/.test(item.title) ? "订单系统" : "项目交付系统" : "销售项目APP" };
    });
    const triangleDimensions = [
      ["客户关系", merged.health.relationship],
      ["关键资源", merged.health.resource],
      ["项目运作", merged.health.operation],
    ] as const;
    const lowDimensions = triangleDimensions.filter(([, score]) => score < 60);
    const triangleRiskId = `RSK-TRI-${project.id.slice(-4)}`;
    const risks = lowDimensions.length && !merged.risks.some(risk => risk.id === triangleRiskId)
      ? [...merged.risks, { id: triangleRiskId, level: "重大" as const, category: "经营三角", title: `${lowDimensions.map(([name, score]) => `${name}${score}分`).join("、")}低于60分`, owner: merged.owner, due: "2026-08-20", status: "开放" as const, evidence: "BR-009｜任一经营三角维度低于60分自动进入总裁显微镜" }]
      : merged.risks;
    const administrativeStatus = merged.result === "terminated" ? "Terminated" as const
      : merged.result === "lost" && merged.lostReview ? "Closed" as const
      : merged.result === "won" || merged.stage === "S6" ? "PendingClose" as const
      : "Active" as const;
    const scenarioContext = scenarioFor(merged);
    return {
      ...merged,
      projectGrade: merged.projectGrade ?? gradeByProject[project.id] ?? "B",
      leadGrade: merged.leadGrade ?? merged.projectGrade ?? gradeByProject[project.id] ?? "B",
      projectImportance: merged.projectImportance ?? importanceByProject[project.id],
      organization: merged.organization ?? organizationByOwner[merged.owner] ?? "销售中心",
      resources,
      actions,
      milestones,
      competitivePosition,
      versions: alignedVersions(merged),
      scenarioContext,
      intentType: scenarioContext.scenario === "EPC客户询价" ? "EPC客户询价" : merged.intentType,
      riskLevel: lowDimensions.length ? "重大" : merged.riskLevel,
      risks,
      administrativeStatus,
    };
  });
}

export const platformRuleSets = [
  { id: "DP-02-ONTOLOGY-V1.2", category: "领域本体基线", version: "V1.2双轨版", status: "生效", owner: "销售运营委员会", effectiveAt: "2026-08-19", summary: "SalesProject聚合根、四场景、多EPC通路、双轨活动与对象血缘统一基线" },
  { id: "RULE-ACTIVITY-V1.2", category: "双轨活动语义", version: "V1.2", status: "生效", owner: "销售运营委员会", effectiveAt: "2026-08-19", summary: "ACT-BID-01..09与ACT-SPM-01..08，共享ActivityDefinition/Instance/Event模型" },
  { id: "RULE-STAGE-2026.08", category: "阶段与阶段门", version: "V3.2", status: "生效", owner: "销售运营委员会", effectiveAt: "2026-08-01", summary: "S0-S6进入条件、输出、阻断和审批责任" },
  { id: "RULE-SCORE-2026.06", category: "健康度评分", version: "V2.1", status: "生效", owner: "销售运营部", effectiveAt: "2026-06-15", summary: "客户关系60/20/20、资源到位和主动运作评分" },
  { id: "RULE-PERM-2026.08", category: "角色与权限", version: "V1.8", status: "生效", owner: "流程与内控部", effectiveAt: "2026-08-01", summary: "销售维护事实；主管批准阶段、偏差和结果" },
  { id: "RULE-NO-2026", category: "编号规则", version: "V1.0", status: "生效", owner: "主数据团队", effectiveAt: "2026-01-01", summary: "项目、版本、偏差、基线和外部引用编号" },
  { id: "RULE-RISK-BR-009", category: "风险阈值", version: "V1.2", status: "生效", owner: "风险管理部", effectiveAt: "2026-08-19", summary: "经营三角任一维度低于60分，自动标记重大风险并进入总裁显微镜" },
] as const;
