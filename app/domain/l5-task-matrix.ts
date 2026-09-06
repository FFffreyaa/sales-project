import type { ScenarioType } from "./sales-project-contract";

export const L5_WORK_MODE_LEGEND = {
  H: "Human｜人工判断与操作",
  A: "AI｜识别、检查与建议，不替代审批",
  C: "Computer｜流转、校验、冻结与存储",
} as const;

export type L5WorkMode = keyof typeof L5_WORK_MODE_LEGEND;
export type L5ExecutionMode = "full" | "streamlined" | "conditional";
export type L5TaskCoverage = "implemented" | "partial" | "missing" | "incorrect" | "to_verify";

export const L5_EXECUTION_MODE_LABELS: Record<L5ExecutionMode, string> = {
  full: "完整执行",
  streamlined: "轻量执行",
  conditional: "条件触发",
};

type ScenarioRule = {
  mode: L5ExecutionMode;
  label: string;
  required: boolean;
  condition?: string;
};

type L5Activity = {
  code: string;
  sourceRows: string;
  name: string;
  definitionCodes: readonly string[];
  owner: string;
  authoritySystem: string;
  workModes: readonly L5WorkMode[];
  output: string;
  scenarios: Record<ScenarioType, ScenarioRule>;
};

export type L5Task = {
  code: string;
  sourceRow: number;
  activityCode: string;
  name: string;
  description: string;
  workModes: readonly L5WorkMode[];
  coverage: L5TaskCoverage;
  implementationEvidence: string;
  gap: string;
};

const rule = (label: string, mode: L5ExecutionMode = "full", required = true, condition?: string): ScenarioRule => ({ label, mode, required, condition });

export const L5_ACTIVITY_MATRIX: readonly L5Activity[] = [
  { code: "L5-01", sourceRows: "3-4", name: "创建销售项目", definitionCodes: ["ACT-BID-01"], owner: "销售代表", authoritySystem: "SALES_PROJECT_APP", workModes: ["H", "C"], output: "销售项目草稿", scenarios: {
    "SCN-01-DIRECT-BID": rule("创建正式招投标销售项目"), "SCN-02-EPC-INQUIRY": rule("按最终业主采购机会创建项目"), "SCN-03-DIRECT-RFQ": rule("创建客户询价销售项目"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("创建海外伙伴/EPC销售项目"),
  } },
  { code: "L5-02", sourceRows: "5-6", name: "发起销售项目立项", definitionCodes: ["ACT-BID-01"], owner: "销售代表", authoritySystem: "SALES_PROJECT_APP", workModes: ["H", "C"], output: "立项申请与冻结快照", scenarios: {
    "SCN-01-DIRECT-BID": rule("提交正式招投标立项"), "SCN-02-EPC-INQUIRY": rule("提交EPC通路与最终业主立项"), "SCN-03-DIRECT-RFQ": rule("提交询价/报价立项"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("提交伙伴、国家与EPC通路立项"),
  } },
  { code: "L5-03", sourceRows: "7-8", name: "销售项目立项审批", definitionCodes: ["ACT-BID-01"], owner: "销售主管", authoritySystem: "SALES_PROJECT_APP", workModes: ["H", "C"], output: "G1立项结论", scenarios: {
    "SCN-01-DIRECT-BID": rule("G1立项审批"), "SCN-02-EPC-INQUIRY": rule("G1立项审批"), "SCN-03-DIRECT-RFQ": rule("G1立项审批"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("G1立项审批"),
  } },
  { code: "L5-04", sourceRows: "10-11", name: "投标准备", definitionCodes: ["ACT-BID-02"], owner: "投标专员", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "A", "C"], output: "作业策略与工作计划", scenarios: {
    "SCN-01-DIRECT-BID": rule("标书分析、投标策略与工作计划"), "SCN-02-EPC-INQUIRY": rule("EPC询价与多通路报价计划", "streamlined"), "SCN-03-DIRECT-RFQ": rule("RFQ/报价准备", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("海外询价、伙伴分工与报价计划"),
  } },
  { code: "L5-05", sourceRows: "12-14", name: "编制商务方案", definitionCodes: ["ACT-BID-03"], owner: "销售/商务", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "A", "C"], output: "商务方案与商务偏差", scenarios: {
    "SCN-01-DIRECT-BID": rule("完整商务响应方案"), "SCN-02-EPC-INQUIRY": rule("EPC通路商务与报价方案"), "SCN-03-DIRECT-RFQ": rule("付款、交期、有效期等轻量商务方案", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("币种、贸易条款、伙伴分工与海外商务方案"),
  } },
  { code: "L5-06", sourceRows: "15-18", name: "编制技术方案", definitionCodes: ["ACT-BID-04", "ACT-BID-04A", "ACT-BID-04B"], owner: "技术负责人", authoritySystem: "TECHNICAL_SOLUTION_SYSTEM", workModes: ["H", "A", "C"], output: "需求基线、技术方案与报价设计BOM", scenarios: {
    "SCN-01-DIRECT-BID": rule("完整技术响应、偏差与设计BOM"), "SCN-02-EPC-INQUIRY": rule("统一技术基线与多通路响应"), "SCN-03-DIRECT-RFQ": rule("配置确认或技术方案", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("海外标准、参数转换与技术方案"),
  } },
  { code: "L5-07", sourceRows: "19-21", name: "核价", definitionCodes: ["ACT-BID-04", "ACT-BID-04C"], owner: "核价责任人/价格授权人", authoritySystem: "COSTING_SYSTEM", workModes: ["H", "C"], output: "核价结果与价格授权", scenarios: {
    "SCN-01-DIRECT-BID": rule("正式核价与价格授权"), "SCN-02-EPC-INQUIRY": rule("统一方案核价与通路价格授权"), "SCN-03-DIRECT-RFQ": rule("询价核价与报价授权"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("含汇率、运输、税费与风险储备的核价授权"),
  } },
  { code: "L5-08", sourceRows: "22-24", name: "编制投标/报价文件", definitionCodes: ["ACT-BID-05"], owner: "投标专员", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "C"], output: "不可变提交候选包", scenarios: {
    "SCN-01-DIRECT-BID": rule("编制完整投标文件包"), "SCN-02-EPC-INQUIRY": rule("按EPC通路编制报价响应包"), "SCN-03-DIRECT-RFQ": rule("编制直接报价响应包", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("编制海外伙伴/EPC报价响应包"),
  } },
  { code: "L5-09", sourceRows: "25-26", name: "发起专业评审", definitionCodes: ["ACT-BID-06"], owner: "投标专员", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "C"], output: "专业评审工单", scenarios: {
    "SCN-01-DIRECT-BID": rule("发起完整专业评审"), "SCN-02-EPC-INQUIRY": rule("按金额、非标、偏差或风险发起评审", "conditional", false, "金额、非标、偏差或风险达到阈值"), "SCN-03-DIRECT-RFQ": rule("按金额、非标、偏差或风险发起评审", "conditional", false, "金额、非标、偏差或风险达到阈值"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("发起海外专业评审"),
  } },
  { code: "L5-10", sourceRows: "27-31", name: "执行专业评审", definitionCodes: ["ACT-BID-06"], owner: "专业评审组", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "A", "C"], output: "分专业结论、整改项与复核记录", scenarios: {
    "SCN-01-DIRECT-BID": rule("商务、技术、资质及条件触发专业评审"), "SCN-02-EPC-INQUIRY": rule("执行已触发的专业评审", "conditional", false, "评审工单已触发"), "SCN-03-DIRECT-RFQ": rule("执行已触发的报价评审", "conditional", false, "评审工单已触发"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("商务、技术、资质及海外合规评审"),
  } },
  { code: "L5-11", sourceRows: "32-33", name: "发起投标/报价决策", definitionCodes: ["ACT-BID-07"], owner: "投标专员", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "C"], output: "决策申请与冻结快照", scenarios: {
    "SCN-01-DIRECT-BID": rule("发起投/不投决策"), "SCN-02-EPC-INQUIRY": rule("发起EPC通路报/不报决策"), "SCN-03-DIRECT-RFQ": rule("发起报价提交决策", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("发起海外报价与通路决策"),
  } },
  { code: "L5-12", sourceRows: "34-35", name: "执行投标/报价决策", definitionCodes: ["ACT-BID-07"], owner: "销售管理层/授权决策人", authoritySystem: "SALES_PROJECT_APP+BID_MANAGEMENT_APP", workModes: ["H", "A", "C"], output: "投/不投或报/不报授权结论", scenarios: {
    "SCN-01-DIRECT-BID": rule("执行投/不投决策"), "SCN-02-EPC-INQUIRY": rule("执行EPC报价通路决策"), "SCN-03-DIRECT-RFQ": rule("执行报价授权决策", "streamlined"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("执行海外报价与伙伴通路决策"),
  } },
  { code: "L5-13", sourceRows: "36-38", name: "正式提交", definitionCodes: ["ACT-BID-08"], owner: "投标专员/销售员", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "C"], output: "正式提交记录与回执", scenarios: {
    "SCN-01-DIRECT-BID": rule("递交标书并取得回执"), "SCN-02-EPC-INQUIRY": rule("逐EPC通路提交报价并取得回执"), "SCN-03-DIRECT-RFQ": rule("提交报价并取得客户回执"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("按伙伴/EPC通路提交并留痕"),
  } },
  { code: "L5-14", sourceRows: "39-41", name: "获取商业结果", definitionCodes: ["ACT-BID-09"], owner: "销售Owner", authoritySystem: "BID_MANAGEMENT_APP", workModes: ["H", "A", "C"], output: "BidResult、成交基线或结构化复盘", scenarios: {
    "SCN-01-DIRECT-BID": rule("获取中标、未中标、废标或终止结果"), "SCN-02-EPC-INQUIRY": rule("汇总各EPC通路结果和项目最终结果"), "SCN-03-DIRECT-RFQ": rule("确认报价接受、拒绝、失效或取消"), "SCN-04-OVERSEAS-PARTNER-EPC": rule("确认伙伴/EPC通路结果及钱江最终成交结果"),
  } },
];

const task = (code: string, sourceRow: number, activityCode: string, name: string, description: string, workModes: readonly L5WorkMode[], coverage: L5TaskCoverage, implementationEvidence: string, gap: string): L5Task => ({ code, sourceRow, activityCode, name, description, workModes, coverage, implementationEvidence, gap });

/**
 * 《销售项目投标L5活动描述_V3》任务级实施基线。
 * coverage是2026-09-01代码审计快照；代码变化后必须更新证据和结论，不能把ACT编号或页面文案当作完成。
 */
export const L5_TASK_MATRIX: readonly L5Task[] = [
  task("L5-T01", 3, "L5-01", "录入客户基本信息", "录入客户名称、联系人、联系方式、地址等基本信息", ["H", "C"], "implemented", "LeadConversionEventEnvelope；createIntentProjectAndG1", "当前按已确认边界从线索APP继承客户事实，不在销售项目APP重复录入"),
  task("L5-T02", 4, "L5-01", "填写项目概况", "填写项目背景、预期规模、项目类型、预期金额等信息，保存为草稿状态", ["H", "C"], "implemented", "createIntentProjectAndG1(submitG1=false)", "S0草稿已持久化；草稿字段修改与版本审计仍待后续设计"),
  task("L5-T03", 5, "L5-02", "填写立项申请单", "填写项目背景、预期金额、竞争情况、项目等级等立项信息", ["H", "C"], "implemented", "线索转化三步表单；submitG1Draft前置校验", "竞争、关键角色和伙伴仅作为来源候选，不自动变为项目责任"),
  task("L5-T04", 6, "L5-02", "提交立项审批流程", "确认信息后提交立项审批并通知审批人", ["C"], "implemented", "submitG1Draft；G1 submission route；gate snapshot", "草稿与提交已分离，只有Owner可提交"),
  task("L5-T05", 7, "L5-03", "审阅立项申请材料", "审阅立项信息并评估可行性、战略匹配度和资源需求", ["H", "C"], "implemented", "G1快速审查抽屉；冻结来源快照；项目等级与重要性依据", "企业金额阈值与升级审批规则尚未提供"),
  task("L5-T06", 8, "L5-03", "审批决策并填写审批意见", "作出通过、驳回或暂停决策并填写结构化意见", ["H", "C"], "implemented", "decideG1 approve/return；gate_decisions；audit_records", "当前实现批准/退回；源表“暂停”尚未形成已确认企业规则"),
  task("L5-T07", 10, "L5-04", "分析招标文件", "提取技术要求、商务条款、评标标准、资质要求等关键信息", ["H", "A"], "implemented", "BID_PREPARATION；BidPreparationVersion", "按四场景绑定TenderRequest/EPCInquiry/DirectRFQ来源版本和哈希；销售项目APP只读引用"),
  task("L5-T08", 11, "L5-04", "制定投标策略和工作计划", "制定投标总体策略、工作分工、时间节点和责任分配", ["H", "A"], "implemented", "BidPreparationVersion.bid_strategy/work_plan；ACT-BID-02", "投标策略与销售Owner维护的赢单策略分离；工作计划显式记录任务、责任角色和日期"),
  task("L5-T09", 12, "L5-05", "分析招标文件商务条款", "提取付款条款、交货期、保证金、违约责任等商务要求", ["H", "A"], "implemented", "COMMERCIAL_SOLUTION；CommercialSolutionVersion", "商务经理基于当前有效投标准备版本逐条形成付款、交付、保证金和违约责任响应"),
  task("L5-T10", 13, "L5-05", "编制商务方案和报价", "编制商务方案、报价清单并标注商务偏差", ["H", "A", "C"], "implemented", "CommercialSolutionVersion；quotation_list_ref；PricingAuthorization", "商务方案保存报价清单权威引用，最终价格仍由后续核价结果与价格授权控制"),
  task("L5-T11", 14, "L5-05", "商务风险评估", "评估商务条款风险并形成商务偏差和应对措施", ["H", "A"], "implemented", "commercial_deviations；risk_assessment；mitigation_plan", "商务偏差逐条记录条款、响应、风险等级和应对措施并绑定商务方案版本"),
  task("L5-T12", 15, "L5-06", "分析招标文件技术要求", "提取技术规范、功能要求、性能指标、资质要求等", ["H", "A"], "partial", "RequirementBaseline；RequirementBaselinePrepared", "技术协同已分步回传需求基线，但尚未形成逐条招标要求解析对象"),
  task("L5-T13", 16, "L5-06", "设计技术方案", "设计技术架构、编写技术响应并填写技术偏差", ["H", "A"], "partial", "TechnicalSolutionVersion；TechnicalDeviationRecord", "与技术文档、BOM合并在一个技术协同任务，缺少独立任务状态"),
  task("L5-T14", 17, "L5-06", "编制技术方案文档", "整合技术内容生成完整技术方案并响应全部技术要求", ["H", "A"], "partial", "TechnicalSolutionVersion", "存在版本对象，但没有独立文档编制作业状态和完整性结论"),
  task("L5-T15", 18, "L5-06", "配置BOM清单", "按技术方案配置产品BOM并保持方案一致", ["H", "C"], "implemented", "QuotationDesignBOMVersion；G3一致性校验", "当前为外部权威版本只读引用"),
  task("L5-T16", 19, "L5-07", "收集核价数据", "收集产品成本、历史报价、竞品价格等核价数据", ["H", "C"], "partial", "CostingSolution成本分解与evidence_ref", "能引用结果证据，但未分离记录成本数据集、历史报价与竞品价格来源"),
  task("L5-T17", 20, "L5-07", "执行核价计算", "核算成本和利润率并生成核价报告", ["H", "C"], "implemented", "saveCostingAssessment；CostingSolution", "销售项目APP只读引用外部核价结果，不承担计算"),
  task("L5-T18", 21, "L5-07", "核价审批", "提交核价报告审批并确认最终报价", ["C"], "implemented", "requestG4；decideG4；PricingAuthorization", "C只负责流转，最终授权仍由Human价格授权人作出"),
  task("L5-T19", 22, "L5-08", "整合各部分内容", "按要求整合商务、技术、报价、资质等内容", ["H", "C"], "partial", "BID_PACKAGE_PREPARATION；BidPackageVersion", "当前一个回传事件形成整包，未保留各组成部分装配清单"),
  task("L5-T20", 23, "L5-08", "格式校对和排版", "按模板完成格式、排版和错别字检查", ["H", "C"], "missing", "当前无ProofreadingResult或校对清单", "包哈希不能证明格式与文字校对已完成"),
  task("L5-T21", 24, "L5-08", "生成最终投标文件包", "生成完整投标文件包并完成最终完整性检查", ["H", "C"], "implemented", "saveBidPackage；BidPackageVersion；package_hash", "提交前由G5冻结不可变包版本"),
  task("L5-T22", 25, "L5-09", "选择评审专家", "按项目类型和专业领域选择符合要求的评审专家", ["H", "C"], "partial", "saveBidPackage按商务/技术/资质分配三个独立评审身份", "已消除单人通用评审；真实企业的专家库、资格条件和人工选人规则尚未接入"),
  task("L5-T23", 26, "L5-09", "发起评审流程", "创建评审工单、分配任务并发送通知", ["C"], "implemented", "正式投标包生成三张BID_PACKAGE_REVIEW工单并分别冻结reviewType和assignee", "国内EPC/RFQ是否触发评审仍等待企业阈值规则"),
  task("L5-T24", 27, "L5-10", "商务评审", "评审商务合规、报价合理性和条款响应完整性", ["H", "A"], "implemented", "ProfessionalReview(review_type=business)；独立商务评审任务", "评审结论按投标包版本留痕"),
  task("L5-T25", 28, "L5-10", "技术评审", "评审技术方案可行性、响应完整性和BOM合理性", ["H", "A"], "implemented", "ProfessionalReview(review_type=technical)；独立技术评审任务", "与G3技术基线评审保持两个不同控制点"),
  task("L5-T26", 29, "L5-10", "资质评审", "检查资质文件完整性、有效性和符合性", ["H", "C"], "implemented", "ProfessionalReview(review_type=qualification)；独立资质评审任务", "正式招投标和海外场景作为G5硬条件"),
  task("L5-T27", 30, "L5-10", "汇总评审意见", "整合各专业意见形成综合结论和整改建议", ["H", "A"], "partial", "ProfessionalReview单结论；G5 readiness", "尚无多专业结论聚合规则，当前不存在可汇总的独立输入"),
  task("L5-T28", 31, "L5-10", "跟踪整改落实", "跟踪重大评审问题整改并确认完成", ["H", "C"], "missing", "当前无ReviewFinding状态机", "缺少问题、责任人、期限、整改证据、复核和关闭状态"),
  task("L5-T29", 32, "L5-11", "准备决策材料", "整理投标文件、核价报告和评审意见等决策材料", ["H", "C"], "partial", "buildG5Readiness；gate_submission_snapshots", "系统能自动汇总并冻结，但缺投标专员确认决策包完整性的独立事件"),
  task("L5-T30", 33, "L5-11", "发起决策审批流程", "发起投标决策审批并通知审批人", ["C"], "to_verify", "requestG5当前由销售项目Owner提交", "源表责任人为投标专员；现行方案把G5作为销售项目Gate由Owner发起，需确认双轨交接责任后再改"),
  task("L5-T31", 34, "L5-12", "审阅投标方案", "审阅投标文件、核价报告、评审意见并评估风险收益", ["H", "A"], "implemented", "G5自动汇总来源；主管决策工作台；风险快照", "AI只提供分析，不替代决策"),
  task("L5-T32", 35, "L5-12", "做出投标决策并审批", "作出投标、不投标或有条件投标决策", ["H", "C"], "implemented", "decideG5 approve_submit/return/decline；gate_decisions", "当前不提供企业尚未确认规则的泛化附条件批准"),
  task("L5-T33", 36, "L5-13", "准备递交材料", "按要求密封、标识文件并准备递交清单", ["H"], "partial", "G5_SUBMISSION_EXECUTION请求负载", "存在受控提交任务，但缺独立递交清单和线下密封检查证据"),
  task("L5-T34", 37, "L5-13", "递交标书", "在截止时间前向指定地点或平台递交", ["H"], "implemented", "G5_SUBMISSION_EXECUTION；completeG5Submission", "按场景替换为标书、EPC报价或直客报价提交"),
  task("L5-T35", 38, "L5-13", "获取递交确认", "保存递交回执或签收凭证并录入系统", ["H", "C"], "implemented", "CommercialSubmissionAccepted；receipt_ref；receipt_hash", "有效回执回传后才从S4进入S5"),
  task("L5-T36", 39, "L5-14", "跟踪投标进度", "跟踪开标或客户决策进度并获取结果通知", ["H", "C"], "implemented", "COMMERCIAL_RESULT_TRACKING external task", "EPC场景按报价通路分别跟踪"),
  task("L5-T37", 40, "L5-14", "获取并记录投标结果", "记录中标、未中标或对应场景结果并更新项目", ["H", "C"], "implemented", "CommercialResultReported；BidResult汇总；G6确认", "投标APP形成权威结果，销售主管在G6确认项目分支"),
  task("L5-T38", 41, "L5-14", "投标复盘", "复盘投标过程并记录经验教训", ["H", "A"], "partial", "LossTerminationReview；G6未成交关闭", "已覆盖未成交/终止复盘，尚未形成赢单项目复盘及AI辅助输出"),
];

export function summarizeL5TaskCoverage() {
  return L5_TASK_MATRIX.reduce<Record<L5TaskCoverage, number>>((summary, item) => {
    summary[item.coverage] += 1;
    return summary;
  }, { implemented: 0, partial: 0, missing: 0, incorrect: 0, to_verify: 0 });
}

const SCENARIO_CODE_BY_NAME: Record<string, ScenarioType> = {
  "国内正式招投标": "SCN-01-DIRECT-BID",
  "国内EPC询价": "SCN-02-EPC-INQUIRY",
  "国内客户询价/报价": "SCN-03-DIRECT-RFQ",
  "海外伙伴/EPC询价": "SCN-04-OVERSEAS-PARTNER-EPC",
};

export function scenarioCodeFromName(name?: string): ScenarioType {
  return (name && SCENARIO_CODE_BY_NAME[name]) || "SCN-03-DIRECT-RFQ";
}

export function l5PoliciesForDefinition(definitionCode: string, scenarioName?: string) {
  const scenarioCode = scenarioCodeFromName(scenarioName);
  return L5_ACTIVITY_MATRIX.filter(item => item.definitionCodes.includes(definitionCode)).map(item => ({ ...item, scenario: item.scenarios[scenarioCode] }));
}

export function l5TasksForDefinition(definitionCode: string, scenarioName?: string) {
  const policies = l5PoliciesForDefinition(definitionCode, scenarioName);
  const activityCodes = new Set(policies.map(item => item.code));
  return L5_TASK_MATRIX.filter(item => activityCodes.has(item.activityCode)).map(item => ({
    ...item,
    activity: policies.find(policy => policy.code === item.activityCode),
  }));
}
