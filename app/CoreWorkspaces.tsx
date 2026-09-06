"use client";

import { ReactNode, useState } from "react";
import { ArtifactVersion, DetailTab, gateDefinitions, probabilityLabel, ProjectAction, Relationship, SalesProject, stageDefinitions, submissionTimingLabel } from "./demo-data";
import { type G2ReadinessSnapshot, type G2SourceTab, type G5ReadinessSnapshot, type G6ReadinessSnapshot, type GateActivitySnapshot, type RequirementSourceInput, type S2ReadinessSnapshot, type S3ReadinessSnapshot } from "./domain/sales-project-contract";
import { L5_EXECUTION_MODE_LABELS, l5PoliciesForDefinition } from "./domain/l5-task-matrix";
import { platformRuleSets } from "./scenario-data";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const externalStatusText: Record<string, string> = { pending: "待外部责任人接受", accepted: "外部处理中", completed: "外部已完成", returned: "外部已退回", rejected: "外部处理失败", cancelled: "已取消" };

function toneOf(value: string): Tone {
  if (/通过|完成|批准|生效|提交|到位|支持|接收|中标|允许|一致/.test(value)) return "success";
  if (/阻断|阻塞|重大|高风险|未覆盖|缺失|延期|拒绝|丢标|不允许/.test(value)) return "danger";
  if (/待|进行|警告|中立|重评|例外|关注/.test(value)) return "warning";
  if (/当前|外部|只读|草稿/.test(value)) return "info";
  return "neutral";
}

function Status({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const value = String(children);
  return <span className={`cw-status ${tone ?? toneOf(value)}`}><i />{children}</span>;
}

function Person({ name }: { name: string }) {
  return <span className="cw-person"><i>{name.slice(-1)}</i>{name}</span>;
}

function currentGate(project: SalesProject) {
  return gateDefinitions.find(gate => gate.stage === project.stage) ?? gateDefinitions[0];
}

function submissionLanguage(project: SalesProject) {
  if (["EPC客户询价", "国内EPC询价", "海外伙伴/EPC询价"].includes(project.scenarioContext?.scenario ?? "")) return { submitted: "已向EPC/伙伴报价", won: "通路中标且钱江被选中", lost: "通路未中标或钱江未被选中" };
  if (["客户直接询价", "国内客户询价/报价"].includes(project.scenarioContext?.scenario ?? "")) return { submitted: "已向直客报价", won: "报价被接受", lost: "报价被拒绝或失效" };
  return { submitted: "已投标", won: "项目中标", lost: "项目未中标" };
}

function Panel({ kicker, title, action, children, className = "" }: { kicker?: string; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`cw-panel ${className}`}><header><div>{kicker && <span>{kicker}</span>}<h2>{title}</h2></div>{action}</header>{children}</section>;
}

function HealthTriangle({ values }: { values: Array<{ label: string; value: number }> }) {
  const center = [110, 108];
  const vertices = [[110, 22], [30, 160], [190, 160]];
  const points = values.map((item, index) => {
    const vertex = vertices[index];
    const ratio = Math.max(0, Math.min(100, item.value)) / 100;
    return `${Math.round(center[0] + (vertex[0] - center[0]) * ratio)},${Math.round(center[1] + (vertex[1] - center[1]) * ratio)}`;
  }).join(" ");
  return <svg className="cw-health-triangle" viewBox="0 0 220 188" role="img" aria-label={`客户关系${values[0].value}分，关键资源${values[1].value}分，项目运作${values[2].value}分`}>
    <polygon className="grid outer" points="110,22 30,160 190,160" />
    <polygon className="grid" points="110,65 70,134 150,134" />
    <line x1="110" y1="108" x2="110" y2="22" /><line x1="110" y1="108" x2="30" y2="160" /><line x1="110" y1="108" x2="190" y2="160" />
    <polygon className="value" points={points} />
    <text x="110" y="13" textAnchor="middle">客户关系 {values[0].value}</text><text x="4" y="179">关键资源 {values[1].value}</text><text x="216" y="179" textAnchor="end">项目运作 {values[2].value}</text>
  </svg>;
}

export function OverviewWorkspace({ project, manager, gateStatus, onTab, onAction, onAddEpcRoute, onWithdrawEpcRoute, onRequestPriceException, onRequestG5Reopen, onDecideG5Reopen }: {
  project: SalesProject;
  manager: boolean;
  gateStatus?: "pending" | "returned" | "approved";
  onTab: (tab: DetailTab) => void;
  onAction: () => void;
  onAddEpcRoute?: () => void;
  onWithdrawEpcRoute?: (route: NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number]) => void;
  onRequestPriceException?: (route: NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number]) => void;
  onRequestG5Reopen?: (changeType: "add_route" | "withdraw_route" | "route_material_change" | "route_price_change", route?: NonNullable<SalesProject["scenarioContext"]>["quotationRoutes"][number]) => void;
  onDecideG5Reopen?: (request: NonNullable<SalesProject["g5ReopenRequest"]>, action: "approve" | "return") => void;
}) {
  const scenario = project.scenarioContext;
  const isEpcScenario = ["EPC客户询价", "国内EPC询价", "海外伙伴/EPC询价"].includes(scenario?.scenario ?? "");
  const isTenderScenario = ["客户直接投标", "国内正式招投标"].includes(scenario?.scenario ?? "");
  const language = submissionLanguage(project);
  const submissionState = ["S5", "S6"].includes(project.stage) || ["已提交", "等待结果"].includes(project.externalBid.status) ? language.submitted : project.externalBid.status === "未启动" ? "尚未进入对客提交" : project.externalBid.status;
  const gate = currentGate(project);
  const health = [
    { label: "客户关系", value: project.health.relationship, proof: project.relationships[0]?.evidence ?? "尚无有效证据", gap: project.relationships.some(item => item.layer === "商务决策链") ? "高层证据需要持续更新" : "商务决策链尚未覆盖" },
    { label: "关键资源", value: project.health.resource, proof: `${project.resources.filter(item => item.status === "已到位").length}个角色已接受责任`, gap: project.resources.find(item => item.status !== "已到位")?.role ?? "资源基本到位" },
    { label: "项目运作", value: project.health.operation, proof: `${project.actions.filter(item => item.status === "已完成").length}项行动已形成结果`, gap: project.risks.find(item => item.status !== "已关闭")?.title ?? "暂无开放缺口" },
  ];
  const microscope = health.filter(item => item.value < 60);
  const resourceGap = project.resources.find(item => item.required && item.status !== "已到位" && (project.stage !== "S0" || /销售Owner/.test(item.role)));
  const gateBlocked = !!resourceGap || project.deviations.some(item => item.status === "待审批");
  const pendingDeviation = project.deviations.find(item => item.status === "待审批");
  const openAction = project.actions.find(item => item.status !== "已完成" && item.status !== "已取消");
  const blockedFacts = [resourceGap && `必需资源“${resourceGap.role}”${resourceGap.status}`, pendingDeviation && `偏差“${pendingDeviation.field}”待审批`, openAction?.status === "已阻塞" && `行动“${openAction.title}”已阻塞`].filter(Boolean) as string[];
  const command = gateStatus === "pending"
    ? manager
      ? { title: `审查并决定 ${gate.code} ${gate.name}`, detail: "申请已进入主管决策队列；先核对自动汇总事实、缺口和来源证据，再批准或退回。", owner: project.approver, tab: "gate" as DetailTab, action: "进入决策" }
      : { title: `等待主管处理 ${gate.code} ${gate.name}`, detail: "阶段申请已经提交，销售员不能重复提交或自行批准；如事实变化，应先补充证据。", owner: project.approver, tab: "gate" as DetailTab, action: "查看申请" }
    : resourceGap
      ? { title: manager ? `配置并确认${resourceGap.role}` : `跟进${resourceGap.role}接受任务`, detail: `该角色当前为“${resourceGap.status}”，属于阶段门硬条件；候选推荐不等于责任已接受。`, owner: resourceGap.person || (manager ? project.approver : project.owner), tab: "resources" as DetailTab, action: manager ? "配置资源" : "查看资源" }
      : pendingDeviation
        ? { title: manager ? `处理偏差审批：${pendingDeviation.field}` : `等待偏差审批：${pendingDeviation.field}`, detail: "未批准偏差不能进入下一阶段；审批结论与专业事实必须留痕。", owner: manager ? pendingDeviation.approver : pendingDeviation.owner, tab: "versions" as DetailTab, action: "查看偏差" }
        : openAction
          ? { title: openAction.title, detail: `${openAction.purpose}；完成后上传结果证据，系统再重算阶段门条件。`, owner: openAction.owner, tab: "actions" as DetailTab, action: openAction.owner === project.owner || manager ? "处理任务" : "查看任务" }
          : { title: manager ? `预审 ${gate.code} ${gate.name}` : `发起 ${gate.code} ${gate.name}`, detail: "当前未发现资源或偏差硬阻断；提交前仍需在阶段门页核对完整自动汇总快照。", owner: manager ? project.approver : project.owner, tab: "gate" as DetailTab, action: manager ? "进入预审" : "发起申请" };
  const openRisks = project.risks.filter(item => item.status !== "已关闭");
  const openActions = project.actions.filter(item => item.status !== "已完成" && item.status !== "已取消");
  const complexIdentity = isEpcScenario || (scenario?.bidRounds.length ?? 0) > 1 || scenario?.scenario === "海外伙伴/EPC询价" || (!!project.customerIdentity && project.customerIdentity.status !== "已匹配正式客户");

  return <div className="cw-page">
    <section className={`cw-command-center ${blockedFacts.length ? "blocked" : "ready"}`}>
      <div className="cw-command-sequence"><span>当前阶段</span><strong>{project.stage} {project.stageName}</strong><i>→</i><span>当前门禁</span><strong>{gate.code} {gate.name}</strong><i>→</i><span>目标阶段</span><strong>{gate.targetStage ?? "经营关闭"}</strong></div>
      <div className="cw-command-primary">
        <div className="cw-command-index">01</div>
        <div><span>NEXT REQUIRED TASK｜唯一首要任务</span><h2>{command.title}</h2><p>{command.detail}</p></div>
        <dl><div><dt>当前责任人</dt><dd>{command.owner}</dd></div><div><dt>门禁状态</dt><dd><Status>{gateStatus === "pending" ? "待主管决策" : gateBlocked ? "存在阻断" : "准备中"}</Status></dd></div></dl>
        <button className="cw-primary" onClick={() => onTab(command.tab)}>{command.action} →</button>
      </div>
      <div className="cw-command-evidence">
        <strong>{blockedFacts.length ? `${blockedFacts.length}项硬阻断` : "当前无已识别硬阻断"}</strong>
        <span>{blockedFacts.join("；") || "仍需以阶段门自动汇总快照为最终判定依据。"}</span>
        <button className="cw-link" onClick={() => onTab("gate")}>查看条件、来源和证据</button>
      </div>
    </section>

    <section className="cw-overview-visual">
      <div className="cw-health-visual">
        <header><div><span>经营健康度</span><h2>关系 · 资源 · 运作</h2></div><Status tone={microscope.length ? "danger" : "success"}>{microscope.length ? `${microscope.length}项低于60` : "总体稳定"}</Status></header>
        <HealthTriangle values={health} />
        <div className="cw-health-legend">{health.map(item => <button key={item.label} onClick={() => onTab(item.label === "客户关系" ? "relations" : item.label === "关键资源" ? "resources" : "actions")}><span>{item.label}</span><strong>{item.value}</strong><small>{item.gap}</small></button>)}</div>
      </div>
      <div className="cw-overview-kpis">
        <article><span>项目金额</span><strong>{project.amount.toLocaleString("zh-CN")}<small>万元</small></strong><em>来源于当前项目事实</em></article>
        <article><span>赢单概率</span><strong>{probabilityLabel(project)}</strong><em>{project.probabilityAssessed === false ? "尚未形成受控评估" : "当前经营判断"}</em></article>
        <article className={project.result === "pending" && project.countdown >= 0 && project.countdown <= 7 ? "danger" : ""}><span>提交状态</span><strong>{submissionTimingLabel(project)}</strong><em>{project.result === "pending" ? project.bidDate : "结果已形成，不再倒计时"}</em></article>
        <article className={openRisks.some(item => item.level === "重大" || item.level === "高") ? "danger" : ""}><span>开放风险</span><strong>{openRisks.length}<small>项</small></strong><em>{openRisks.filter(item => item.level === "重大" || item.level === "高").length}项高及以上</em></article>
      </div>
    </section>

    {(openRisks.length > 0 || openActions.length > 0) && <Panel kicker="CURRENT FOCUS" title="当前需关注" className="cw-focus-panel" action={<div className="cw-inline-actions"><button className="cw-link" onClick={() => onTab("actions")}>查看任务与里程碑</button><button className="cw-primary small" onClick={onAction}>{manager ? "发起主管督办" : "记录客户经营行动"}</button></div>}>
      <div className="cw-focus-list">
        {openRisks.slice(0, 2).map(risk => <button key={risk.id} onClick={() => onTab("actions")}><Status tone={risk.level === "重大" || risk.level === "高" ? "danger" : "warning"}>{risk.level}风险</Status><strong>{risk.title}</strong><span>{risk.owner} · {risk.due}</span><i>查看处置 ›</i></button>)}
        {openActions.slice(0, Math.max(1, 3 - Math.min(openRisks.length, 2))).map(action => <button key={action.id} onClick={() => onTab("actions")}><Status>{action.status}</Status><strong>{action.title}</strong><span>{action.owner} · {action.due}</span><i>处理行动 ›</i></button>)}
      </div>
    </Panel>}

    {scenario && <details className="cw-identity-details" open={complexIdentity || undefined}>
      <summary><span>项目来源与采购关系</span><strong>{scenario.scenario} · {scenario.endCustomer}</strong><small>{complexIdentity ? "当前场景需要持续核对多方关系与通路" : "按需展开来源、采购请求和提交对象"}</small></summary>
      <div className="cw-identity-actions"><Status tone="info">{scenario.scenario}</Status>{isEpcScenario && !manager && project.persisted && ["S1", "S2", "S3", "S4"].includes(project.stage) && <button className="cw-link" onClick={project.stage === "S4" && (gateStatus === "pending" || gateStatus === "approved") ? () => onRequestG5Reopen?.("add_route") : onAddEpcRoute}>{project.stage === "S4" && (gateStatus === "pending" || gateStatus === "approved") ? "申请新增通路解冻" : "新增报价通路"}</button>}</div>
      <div className="cw-scenario-summary">
        <div><span>最终客户 / 业主</span><strong>{scenario.endCustomer}</strong><small>机会与项目聚合根按最终采购事件识别</small></div>
        <div><span>采购请求</span><strong>{scenario.procurementRequestType}</strong><small>{scenario.procurementFingerprint}</small></div>
        <div><span>对客提交对象</span><strong>{scenario.submissionObject}</strong><small>{submissionState} · 对象类型与业务状态分开</small>{scenario.bidRound && <small>{scenario.bidRounds.length}轮 · 当前 #{scenario.bidRound.roundNo} {scenario.bidRound.status} · {scenario.bidRound.authoritySystem}</small>}</div>
        <div><span>项目预计金额</span><strong>{project.amount.toLocaleString("zh-CN")} 万元</strong><small>{scenario.projectAmountRule}</small></div>
        <div><span>当前门禁</span><strong>{gate.code} {gate.name}</strong><small>{gate.interaction}</small></div>
      </div>
      {scenario.scenario === "海外伙伴/EPC询价" && <div className="cw-relationship-split"><span>项目国家 <strong>{scenario.projectCountry || "待确认"}</strong></span><span>交付国家 <strong>{scenario.deliveryCountry || "待确认"}</strong></span><span>伙伴责任 <strong>{project.partner.decisionStatus ?? "待判断"}</strong></span><small>国家事实决定跨境合规与属地服务要求；伙伴候选不等于责任已验证。</small></div>}
      {isTenderScenario && scenario.bidRounds.length > 0 && <div className="cw-bid-rounds">
        <div className="head"><span>BidRound</span><span>轮次类型</span><span>权威投标编号</span><span>文件来源</span><span>截止日期</span><span>状态</span></div>
        {scenario.bidRounds.map(round => <div key={round.id}><span><strong>#{round.roundNo}</strong></span><span>{round.roundType}</span><span>{round.externalBidId ?? "待投标管理绑定"}</span><span>{round.tenderDocumentRef}</span><span>{round.bidDeadline}</span><span><Status tone={round.status === "on_hold" ? "danger" : round.status === "resulted" ? "success" : "info"}>{round.status}</Status>{round.status === "on_hold" && <small>等待销售项目生命周期重启决策，不自动改S阶段</small>}</span></div>)}
      </div>}
      {isEpcScenario && <>
        <div className="cw-relationship-split"><span>最终业主关系 <strong>{scenario.relationshipViews.endCustomer}分</strong></span><span>EPC采购关系 <strong>{scenario.relationshipViews.procurementCustomer}分</strong></span><small>两个关系视角独立评价，不用EPC关系替代最终业主关系。</small></div>
        {scenario.quotationRoutes.length ? <div className="cw-route-table"><div className="head"><span>QuotationRoute / EPC客户</span><span>询价记录</span><span>报价版本与金额</span><span>授权底价</span><span>价格结论</span><span>通路状态</span></div>{scenario.quotationRoutes.map(route => <div key={route.id}><span><strong>{route.epcCustomer}</strong><small>{route.id} · {route.evidence}</small></span><span>{route.inquiryRequests}次</span><span>{route.quoteVersion}<small>{route.quotedAmount.toLocaleString("zh-CN")}万元</small></span><span>{route.authorizedFloorPrice.toLocaleString("zh-CN")}万元</span><span><Status>{route.pricingConclusion}</Status>{!manager && project.stage === "S4" && route.pricingConclusion === "同标同价" && gateStatus !== "pending" && gateStatus !== "approved" && <button className="cw-link" onClick={() => onRequestPriceException?.(route)}>申请例外</button>}</span><span><Status>{route.status}</Status><small>{route.updatedAt}</small>{!manager && ["S1", "S2", "S3", "S4"].includes(project.stage) && <button className="cw-link" onClick={() => project.stage === "S4" && (gateStatus === "pending" || gateStatus === "approved") ? onRequestG5Reopen?.("withdraw_route", route) : onWithdrawEpcRoute?.(route)}>{project.stage === "S4" && (gateStatus === "pending" || gateStatus === "approved") ? "申请解冻后撤回" : "撤回通路"}</button>}</span></div>)}</div> : <div className="cw-boundary"><strong>尚未登记EPC报价通路</strong> G4批准前至少需要一条有效通路；多家EPC默认继承同一项目授权报价。</div>}
        {project.g5ReopenRequest?.status === "pending" && <div className="cw-help compact"><strong>G5冻结批次变更申请待处理</strong><br />{project.g5ReopenRequest.changeType === "add_route" ? "新增后到EPC报价通路" : project.g5ReopenRequest.changeType === "withdraw_route" ? "撤回尚未提交的EPC报价通路" : project.g5ReopenRequest.changeType === "route_price_change" ? "变更通路报价" : "变更通路材料"}｜依据：{project.g5ReopenRequest.evidenceRef}<br />批准只会解冻当前G5；通路新增、撤回或重新组包仍须由责任角色随后执行。{manager ? <span className="cw-inline-actions"><button className="cw-secondary" onClick={() => onDecideG5Reopen?.(project.g5ReopenRequest!, "return")}>退回申请</button><button className="cw-primary" onClick={() => onDecideG5Reopen?.(project.g5ReopenRequest!, "approve")}>批准解冻</button></span> : <span><br />等待销售主管处理；在此之前冻结快照不可修改。</span>}</div>}
        <div className="cw-route-total"><strong>项目金额只计一次：{project.amount.toLocaleString("zh-CN")}万元</strong><span>{scenario.quotationRoutes.length}条EPC报价通路不拆分项目，也不相加为项目预计金额。</span></div>
      </>}
    </details>}
  </div>;
}

const layerMeta: Record<Relationship["layer"], { weight: string; desc: string }> = {
  客户高层: { weight: "60%", desc: "最终批准、战略支持与资源决策" },
  商务决策链: { weight: "20%", desc: "采购、预算、流程和价格影响" },
  技术层: { weight: "20%", desc: "参数、方案、验收和技术评分" },
};

export function RelationsWorkspace({ project, manager, onAdd, onRiskAction }: { project: SalesProject; manager: boolean; onAdd: (layer?: Relationship["layer"]) => void; onRiskAction: (title: string) => void }) {
  const layers = Object.keys(layerMeta) as Relationship["layer"][];
  const [mapMode, setMapMode] = useState<"list" | "fishbone">("list");
  const [selectedRelationId, setSelectedRelationId] = useState(project.relationships[0]?.id ?? "");
  const selectedRelation = project.relationships.find(item => item.id === selectedRelationId) ?? project.relationships[0];
  const decisionSteps = ["需求提出", "技术评审", "采购评审", "预算审核", "最终批准"];
  const decisionLayers: Relationship["layer"][] = ["技术层", "技术层", "商务决策链", "商务决策链", "客户高层"];
  const stale = project.relationships.filter(item => item.lastTouch < "2026-08-01").length;
  const allLayersCovered = layers.every(layer => project.relationships.some(item => item.layer === layer));
  const identity = project.customerIdentity;
  const leadRoleCandidates = project.sourceLineage?.candidateFacts?.keyRoles ?? [];
  const leadPartyCandidates = project.sourceLineage?.candidateFacts?.parties ?? [];
  const relationshipEditable = project.result === "pending" && ["S1", "S2"].includes(project.stage);
  return <div className="cw-page">
    <div className="cw-page-actions"><div><span>RELATIONSHIP INTELLIGENCE</span><h2>客户决策链覆盖与关系证据</h2><p>不是通讯录：每条关系必须说明态度、影响力、覆盖责任和有效证据。</p></div><div>{relationshipEditable ? <><button className="cw-secondary" onClick={() => onRiskAction("安排客户拜访")}>安排拜访</button>{manager ? <button className="cw-primary" onClick={() => onRiskAction("补充客户关系事实与证据")}>要求补充关系</button> : <button className="cw-primary" onClick={() => onAdd()}>＋ 新增关系记录</button>}</> : <Status tone="info">结果形成，关系事实只读</Status>}</div></div>
    <div className="cw-lineage-card">
      <div className="cw-lineage-node source"><span>上游来源</span><strong>{project.sourceLineage?.sourceSystem ?? "手工立项"}</strong><small>{project.sourceLineage?.sourceRecordId ?? "无外部记录"}</small></div>
      <b>→</b>
      <div className="cw-lineage-node"><span>来源客户名称</span><strong>{identity?.sourceName ?? project.customer}</strong><small>原始快照｜不可覆盖</small></div>
      <b>→</b>
      <div className="cw-lineage-node identity"><span>客户系统匹配</span><strong>{identity?.status ?? "待匹配"}</strong><small>{identity?.customerRecordId ?? "临时客户"}</small></div>
      <b>→</b>
      <div className="cw-lineage-node"><span>客户准入/信用</span><strong>{identity?.creditStatus ?? "待客户系统返回"}</strong><small>专业结论来自客户系统</small></div>
      <Status tone={identity?.status === "已准入" || identity?.status === "已匹配正式客户" ? "success" : "warning"}>线索APP维护</Status>
    </div>
    {identity && identity.matchCandidates.length > 0 && <div className="cw-identity-warning"><Status tone="warning">线索待补充</Status><strong>发现{identity.matchCandidates.length}个可能匹配主体</strong><span>{identity.matchCandidates.join(" / ")}</span><small>客户主体匹配与建档在线索APP完成；销售项目只读继承结果。</small></div>}
    {(leadRoleCandidates.length > 0 || leadPartyCandidates.length > 0) && <Panel kicker="LEAD CANDIDATES · READ ONLY" title="线索带入的关键角色与项目参与方候选">
      <p className="cw-footnote">以下内容保留线索来源，不计入关系覆盖，也不满足Gate。销售员核实并补充证据后，才形成正式项目关系记录。</p>
      <div className="cw-gap-list">
        {leadRoleCandidates.map((item, index) => <article key={`lead-role-${index}`}><Status tone="warning">待核实角色</Status><strong>{String(item.name ?? "未命名")} · {String(item.position ?? item.role ?? "角色待确认")}</strong><small>{String(item.evidence ?? "线索未提供证据")}</small>{relationshipEditable ? <button onClick={() => onRiskAction(`核实线索关键角色：${String(item.name ?? "未命名")}`)}>核实并转为行动</button> : <small>结果形成，保留为历史候选</small>}</article>)}
        {leadPartyCandidates.map((item, index) => <article key={`lead-party-${index}`}><Status tone="info">来源参与方</Status><strong>{String(item.name ?? "未命名")} · {String(item.role ?? "角色待确认")}</strong><small>{String(item.country ?? "国家待确认")} · {String(item.evidence ?? "线索来源快照")}</small></article>)}
      </div>
    </Panel>}

    <div className="cw-grid cw-grid-main">
      <Panel kicker="DECISION PATH" title="客户决策链地图" className="cw-span-9" action={<div className="cw-map-toggle" aria-label="关系地图显示模式"><button className={mapMode === "list" ? "active" : ""} onClick={() => setMapMode("list")}>清单模式</button><button className={mapMode === "fishbone" ? "active" : ""} onClick={() => setMapMode("fishbone")}>鱼骨图模式</button></div>}>
        {mapMode === "list" && <><div className="cw-decision-path">{decisionSteps.map((step, index) => <span key={step}><i>{index + 1}</i><strong>{step}</strong><small>{project.relationships.find(item => item.layer === decisionLayers[index])?.name ?? "待识别"}</small>{index < decisionSteps.length - 1 && <b>→</b>}</span>)}</div>
        <div className="cw-relation-map">{layers.map(layer => <div className="cw-relation-layer" key={layer}><aside><i>{layer === "客户高层" ? "①" : layer === "商务决策链" ? "②" : "③"}</i><strong>{layer}</strong><b>{layerMeta[layer].weight}</b><small>{layerMeta[layer].desc}</small></aside><div>{project.relationships.filter(item => item.layer === layer).map(item => <article key={item.id}><header><span className="cw-avatar">{item.name.slice(-1)}</span><div><strong>{item.name}</strong><small>{item.title}</small></div><Status>{item.attitude}</Status></header><dl><div><dt>影响力</dt><dd>{item.influence}</dd></div><div><dt>覆盖负责人</dt><dd>{item.owner}</dd></div><div><dt>最近Touch</dt><dd>{item.lastTouch}</dd></div></dl><p><b>关系证据</b>{item.evidence}</p></article>)}{!project.relationships.some(item => item.layer === layer) && (relationshipEditable ? <button className="cw-empty-card" onClick={manager ? () => onRiskAction(`补充${layer}关系与证据`) : () => onAdd(layer)}>＋ 补充{layer}关系与证据</button> : <div className="cw-empty-card readonly">{layer}未形成有效记录</div>)}</div></div>)}</div></>}
        {mapMode === "fishbone" && <div className="cw-fishbone-view">
          <div className="cw-fishbone-legend"><span><i className="support" />支持</span><span><i className="neutral" />中立</span><span><i className="oppose" />反对</span><span><b>高</b>高影响力</span><small>点击人物查看覆盖责任和证据</small></div>
          <div className="cw-fishbone-canvas">
            <div className="cw-fish-spine"><span>采购意向</span><i /><strong>客户最终采购决策</strong></div>
            {["技术层", "商务决策链", "客户高层"].map((layer, layerIndex) => { const typedLayer = layer as Relationship["layer"]; const people = project.relationships.filter(item => item.layer === typedLayer); return <section className={`cw-fish-bone bone-${layerIndex + 1}`} key={layer}><header><i>{layerIndex + 1}</i><div><strong>{layer}</strong><small>{layerMeta[typedLayer].weight} · {layerMeta[typedLayer].desc}</small></div></header><div>{people.map(item => <button key={item.id} className={`${selectedRelation?.id === item.id ? "active" : ""} attitude-${item.attitude}`} onClick={() => setSelectedRelationId(item.id)}><span>{item.name.slice(-1)}</span><div><strong>{item.name}{item.influence === "高" && <b>高</b>}</strong><small>{item.title}</small></div><em>{item.attitude}</em></button>)}{people.length === 0 && (relationshipEditable ? <button className="gap" onClick={manager ? () => onRiskAction(`补充${layer}关系与证据`) : () => onAdd(typedLayer)}>＋ {layer}待识别</button> : <span className="gap">{layer}未形成记录</span>)}</div></section>; })}
          </div>
          {selectedRelation && <div className="cw-fishbone-detail"><span className="cw-avatar">{selectedRelation.name.slice(-1)}</span><div><strong>{selectedRelation.name} · {selectedRelation.title}</strong><small>{selectedRelation.layer}｜{selectedRelation.attitude}｜{selectedRelation.influence}影响力</small></div><dl><div><dt>覆盖负责人</dt><dd>{selectedRelation.owner}</dd></div><div><dt>最近Touch</dt><dd>{selectedRelation.lastTouch}</dd></div></dl><p><b>关系证据</b>{selectedRelation.evidence}</p><button onClick={() => onRiskAction(`更新${selectedRelation.name}关系证据`)}>{manager ? "要求更新证据" : "更新证据"}</button></div>}
        </div>}
      </Panel>

      <Panel kicker="RELATION COVERAGE" title="关系覆盖与缺口" className="cw-span-3 cw-relation-side-panel">
          <div className="cw-relation-coverage-chart">
            <div className="cw-coverage-ring" style={{ background: `conic-gradient(${project.relationships.some(item => item.layer === "客户高层") ? "#16835f" : "#dce4eb"} 0 60%, ${project.relationships.some(item => item.layer === "商务决策链") ? "#2475c5" : "#dce4eb"} 60% 80%, ${project.relationships.some(item => item.layer === "技术层") ? "#d78719" : "#dce4eb"} 80% 100%)` }}><div><strong>{project.health.relationship}</strong><span>关系健康度</span></div></div>
            <div className="cw-coverage-legend">{layers.map(layer => { const covered = project.relationships.some(item => item.layer === layer); return <div key={layer} className={covered ? "covered" : "missing"}><i /><span><strong>{layer}</strong><small>{layerMeta[layer].weight} · {covered ? "已有有效记录" : "尚未覆盖"}</small></span></div>; })}<p>覆盖必须有关系事实和证据；认识客户不等于有效覆盖。</p></div>
          </div>
          <div className="cw-gap-list">
            {!project.relationships.some(item => item.layer === "商务决策链" && item.influence === "高") && <article><Status tone="danger">阻断风险</Status><strong>关键商务决策人尚未覆盖</strong>{relationshipEditable && <button onClick={() => onRiskAction("覆盖客户关键商务决策人")}>转为行动</button>}</article>}
            {!project.relationships.some(item => item.layer === "客户高层") && <article><Status tone="danger">关系缺口</Status><strong>客户最终批准人与高层影响路径尚未识别</strong>{relationshipEditable && <button onClick={() => onRiskAction("识别并覆盖客户最终批准人")}>转为行动</button>}</article>}
            {!project.relationships.some(item => item.layer === "技术层") && <article><Status tone="warning">关系缺口</Status><strong>最终技术决策接口尚未覆盖</strong>{relationshipEditable && <button onClick={() => onRiskAction("覆盖客户技术决策接口")}>转为行动</button>}</article>}
            {stale > 0 && <article><Status tone="warning">证据过期</Status><strong>{stale}条关系证据需要更新</strong>{relationshipEditable && <button onClick={() => onRiskAction("更新客户关系证据")}>转为行动</button>}</article>}
            {project.partner.needed && project.partner.match !== "已验证" && <article><Status tone="info">待验证</Status><strong>伙伴关系缺少客户侧确认</strong>{relationshipEditable && <button onClick={() => onRiskAction("验证伙伴引荐有效性")}>转为行动</button>}</article>}
            {allLayersCovered && project.relationships.some(item => item.layer === "商务决策链" && item.influence === "高") && stale === 0 && <article><Status tone="success">基本完整</Status><strong>三层关系均有有效覆盖</strong></article>}
          </div>
      </Panel>

      <Panel kicker="EVIDENCE" title="关系证据与 Touch 记录" className="cw-span-12">
        <div className="cw-data-table cw-evidence-table"><div className="head"><span>客户人员</span><span>最近触达</span><span>触达类型</span><span>关键结论</span><span>证据</span><span>有效性</span><span>下一动作</span></div>{project.relationships.map((item, index) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.title}</small></span><span>{item.lastTouch}</span><span>{index % 2 ? "技术交流" : "客户拜访"}</span><span>{item.attitude === "支持" ? "支持我方方案，关注交期和全寿命成本" : "态度中立，需要补充事实验证"}</span><span className="link">纪要-{item.lastTouch.replaceAll("-", "")}.pdf</span><span><Status>{item.lastTouch < "2026-08-01" ? "已过期" : "有效"}</Status></span><span><button className="cw-link" onClick={() => onRiskAction(`更新${item.name}关系证据`)}>更新证据</button></span></div>)}</div>
      </Panel>
    </div>
  </div>;
}

export function StrategyWorkspace({ project, manager, onAction, onStrategyAction, onAddCompetitor, onSaveG2Strategy, onNotify }: { project: SalesProject; manager: boolean; onAction: (title: string) => void; onStrategyAction: () => void; onAddCompetitor: () => void; onSaveG2Strategy?: (input: { decisionPreference: string; objective: string; competitiveAssessment: string; valueProposition: string; relationshipPlan: string; resourcePlan: string; winPath: string; requirementScope: string; keyRisks: string; nonBidConsequence: string; evidenceRef: string; winThemes: string[] }) => void; onNotify: (message: string) => void }) {
  const plan = project.strategyPlan;
  const competitors = project.competitors ?? [];
  const leadCompetitorCandidates = project.sourceLineage?.candidateFacts?.competitors ?? [];
  const themeOptions = ["技术匹配", "交付可信", "服务能力", "客户关系", "价格竞争力", "属地伙伴"];
  const defaultDraft = { projectId: project.id, objective: plan?.objective ?? "", valueProposition: plan?.valueProposition ?? "", winPath: plan?.winPath ?? "", winThemes: plan?.winThemes ?? [], nonBidConsequence: plan?.nonBidConsequence ?? "尚需主管判断" };
  const [draftState, setDraftState] = useState(defaultDraft);
  const strategyDraft = draftState.projectId === project.id ? draftState : defaultDraft;
  const setStrategyDraft = (patch: Partial<typeof defaultDraft>) => setDraftState({ ...strategyDraft, ...patch });
  const highInfluenceRelationships = project.relationships.filter(item => item.influence === "高");
  const coveredLayers = new Set(project.relationships.map(item => item.layer));
  const relationshipGaps = ["客户高层", "商务决策链", "技术层"].filter(layer => !coveredLayers.has(layer as typeof project.relationships[number]["layer"]));
  const initialRequirement = project.sourceLineage?.initialRequirement;
  const decisionPreference = highInfluenceRelationships.length ? highInfluenceRelationships.map(item => `${item.layer} ${item.name}：${item.evidence}`).join("；") : "尚无高影响力客户角色的有效偏好证据";
  const competitiveAssessment = competitors.length ? competitors.map(item => `${item.name}（${item.role}，可信度${item.confidence}）：${item.evidence}`).join("；") : "尚无已核实竞对事实";
  const relationshipPlan = relationshipGaps.length ? `待覆盖：${relationshipGaps.join("、")}` : `三层决策链已有记录；最近接触 ${project.relationships.map(item => item.lastTouch).sort().at(-1) ?? "待补"}`;
  const resourcePlan = project.resources.filter(item => item.required).map(item => `${item.role}：${item.person}（${item.status}）`).join("；") || "当前阶段未提出新增必需角色";
  const requirementScope = initialRequirement ? `${initialRequirement.productRequirement}；待澄清：${initialRequirement.unknowns.join("、") || "暂无显式缺口"}` : project.target;
  const keyRisks = project.risks.filter(item => item.status !== "已关闭").map(item => `${item.level}：${item.title}`).join("；") || "当前风险台账无开放项";
  const evidenceRef = [...new Set([project.sourceLineage?.evidence, ...project.relationships.map(item => item.evidence), ...competitors.map(item => item.evidence), ...project.risks.map(item => item.evidence)].filter(Boolean))].join("；").slice(0, 500) || `SalesProject:${project.id}`;
  const strategyInput = { decisionPreference, objective: strategyDraft.objective, competitiveAssessment, valueProposition: strategyDraft.valueProposition, relationshipPlan, resourcePlan, winPath: strategyDraft.winPath, requirementScope, keyRisks, nonBidConsequence: strategyDraft.nonBidConsequence, evidenceRef, winThemes: strategyDraft.winThemes };
  const criteria = [["客户关系", 25], ["技术匹配", 25], ["价格竞争力", 20], ["交付可信度", 20], ["服务与业绩", 10]] as const;
  const our = project.competitivePosition ?? { relationship: project.health.relationship, technical: project.health.resource, price: 70, delivery: project.health.operation, service: 70, confidence: "中" as const, evidence: "项目团队判断" };
  const comparisonRows = [
    { id: "OUR", name: "钱江电气（我方）", role: "我方方案", relationship: our.relationship, technical: our.technical, price: our.price, delivery: our.delivery, service: our.service, evidence: our.evidence, confidence: our.confidence, updatedAt: "2026-08-17" },
    ...competitors.map(item => ({ ...item, service: item.service ?? Math.round((item.relationship + item.delivery) / 2) })),
  ];
  const strategyEditable = project.result === "pending" && ["S1", "S2", "S3", "S4"].includes(project.stage);
  return <div className="cw-page">
    <div className="cw-page-actions"><div><span>WIN STRATEGY</span><h2>竞争态势与赢单策略</h2><p>区分可验证事实、判断和待验证假设；策略必须转化为有证据的行动。</p></div><div>{strategyEditable ? <>{!manager && <button className="cw-secondary" onClick={onAddCompetitor}>＋ 补充竞争事实</button>}<button className="cw-primary" onClick={onStrategyAction}>{manager ? plan?.status === "待主管评审" ? "批准策略版本" : "要求策略更新" : "提交主管评审"}</button></> : <Status tone="info">结果形成，竞争与策略只读</Status>}</div></div>
    <div className="cw-context-strip strategy"><div><span>策略版本</span><strong>{plan?.version ?? "尚未形成"}</strong></div><div><span>审批状态</span><Status>{plan?.status ?? "草稿"}</Status></div><div><span>赢单目标</span><strong>{plan?.objective ?? project.strategy}</strong></div><div><span>赢单概率</span><strong>{probabilityLabel(project)}</strong><small>{project.probabilityAssessed === false ? "尚未形成受控评估；当前不自动测算" : "项目团队评估"}</small></div></div>
    {leadCompetitorCandidates.length > 0 && <Panel kicker="LEAD CANDIDATES · READ ONLY" title="线索竞对候选">
      <p className="cw-footnote">候选竞对不自动进入竞争结论。必须补充来源、可信度和项目侧核实记录。</p>
      <div className="cw-gap-list">{leadCompetitorCandidates.map((item, index) => <article key={`lead-competitor-${index}`}><Status tone="warning">待核实</Status><strong>{String(item.name ?? "未命名竞对")}</strong><small>{String(item.source ?? "来源未说明")} · 可信度 {String(item.confidence ?? "待评估")}</small><button onClick={() => onAction(`核实线索竞对：${String(item.name ?? "未命名竞对")}`)}>转为验证行动</button></article>)}</div>
    </Panel>}
    <div className="cw-grid cw-grid-main">
      {project.persisted && ["S1", "S2", "S3", "S4"].includes(project.stage) && !manager && <Panel kicker="WIN STRATEGY VERSION" title="形成当前赢单策略版本" className="cw-span-12" action={<Status>{project.stage === "S1" ? "G2首版来源" : "持续重评估"}</Status>}>
        <p className="cw-footnote">系统先汇总客户、需求、竞对、关系、资源和风险事实；销售Owner只确认赢单判断。来源变化后形成新版本，Gate只读引用冻结版本。</p>
        <div className="cw-strategy-facts">
          {[{ label: "客户决策依据", value: decisionPreference }, { label: "需求范围与缺口", value: requirementScope }, { label: "竞对事实", value: competitiveAssessment }, { label: "关系覆盖", value: relationshipPlan }, { label: "责任资源", value: resourcePlan }, { label: "开放风险", value: keyRisks }].map(item => <article key={item.label}><span>系统汇总</span><strong>{item.label}</strong><p>{item.value}</p></article>)}
        </div>
        <div className="cw-strategy-builder">
          <label className="field"><span>本阶段赢单目标</span><input value={strategyDraft.objective} onChange={event => setStrategyDraft({ objective: event.target.value })} placeholder="一句话写清要赢得什么、达到什么结果" /></label>
          <fieldset><legend>主要赢单主题（至少选择一项）</legend><div className="cw-theme-options">{themeOptions.map(theme => <label key={theme}><input type="checkbox" checked={strategyDraft.winThemes.includes(theme)} onChange={() => setStrategyDraft({ winThemes: strategyDraft.winThemes.includes(theme) ? strategyDraft.winThemes.filter(item => item !== theme) : [...strategyDraft.winThemes, theme] })} />{theme}</label>)}</div></fieldset>
          <label className="field"><span>客户为什么选择我们</span><textarea value={strategyDraft.valueProposition} onChange={event => setStrategyDraft({ valueProposition: event.target.value })} placeholder="只写核心价值主张，不重复抄需求、竞对和关系事实" /></label>
          <label className="field"><span>关键赢单路径</span><textarea value={strategyDraft.winPath} onChange={event => setStrategyDraft({ winPath: event.target.value })} placeholder="说明先突破什么、由谁影响谁、最终如何形成客户选择" /></label>
          <label className="field"><span>不投/不报影响</span><select value={strategyDraft.nonBidConsequence} onChange={event => setStrategyDraft({ nonBidConsequence: event.target.value })}><option>尚需主管判断</option><option>无重大经营影响</option><option>影响当前客户覆盖</option><option>影响后续项目机会</option><option>影响战略客户或区域布局</option></select></label>
        </div>
        <div className="cw-form-actions"><span>证据和来源编号由系统自动关联，不要求销售员抄写。</span><button className="cw-primary" disabled={!strategyDraft.objective.trim() || !strategyDraft.valueProposition.trim() || !strategyDraft.winPath.trim() || strategyDraft.winThemes.length === 0} onClick={() => onSaveG2Strategy?.(strategyInput)}>保存策略版本</button></div>
      </Panel>}
      <Panel kicker="COMPETITIVE POSITION" title="我方与竞争对手同维度对比" className="cw-span-12">
        <div className="cw-criteria-strip">{criteria.map(([name, weight], index) => <span key={name}><strong>{name}</strong><b>{weight}%</b><small>{index < 2 ? "已验证" : "持续验证"}</small></span>)}</div>
        {competitors.length ? <div className="cw-competitor-table unified"><div className="head"><span>参与方 / 角色</span><span>关系</span><span>技术</span><span>价格</span><span>交付</span><span>服务</span><span>证据与可信度</span><span>动作</span></div>{comparisonRows.map(item => <div key={item.id} className={item.id === "OUR" ? "our-row" : ""}><span><strong>{item.name}</strong><small>{item.role}</small></span>{[["关系", item.relationship], ["技术", item.technical], ["价格", item.price], ["交付", item.delivery], ["服务", item.service]].map(([label, score]) => <span key={String(label)}><b>{score}</b><i><em className={Number(score) < 60 ? "low" : Number(score) >= 80 ? "high" : ""} style={{ width: `${score}%` }} /></i></span>)}<span>{item.evidence}<small>{item.updatedAt} · 可信度{item.confidence}</small></span><span>{item.id === "OUR" ? <button className="cw-link" onClick={() => onNotify("我方评分来自关系覆盖、资源到位、版本评审和伙伴事实；不是客户官方评分")}>查看评分依据</button> : strategyEditable ? <button className="cw-link" onClick={() => onAction(`验证竞争判断：${item.name}`)}>转为验证行动</button> : <small>历史事实</small>}</span></div>)}</div> : <div className="cw-empty-inline"><strong>尚无已核实竞争公司事实</strong><span>线索候选不能直接作为项目结论。销售Owner需记录来源、日期、可信度和同维度判断后才展示对比。</span>{!manager && strategyEditable && <button className="cw-secondary" onClick={onAddCompetitor}>新增第一条竞争事实</button>}</div>}
        <p className="cw-footnote">权重和分数是项目团队判断，不表示客户官方评分；低可信度信息必须转为验证行动。</p>
      </Panel>
      <Panel kicker="WIN THEMES" title="赢单策略画布" className="cw-span-8" action={<Status>{plan?.status ?? "草稿"}</Status>}><div className="cw-strategy-canvas"><section><span>赢单主题</span>{plan?.winThemes.map(item => <p key={item}>✓ {item}</p>)}</section><section><span>必须证明</span>{plan?.mustProve.map(item => <p key={item}>○ {item}</p>)}</section><section className="gap"><span>必须关闭的缺口</span>{plan?.gaps.map(item => strategyEditable ? <button key={item} onClick={() => onAction(item)}>! {item}<small>转为行动 →</small></button> : <p key={item}>! {item}</p>)}</section><section className="boundary"><span>不承诺边界</span>{plan?.noPromise.map(item => <p key={item}>— {item}</p>)}</section></div></Panel>
      <Panel kicker="GOVERNANCE" title="策略责任与版本" className="cw-span-4"><dl className="cw-summary"><div><dt>策略Owner</dt><dd>{plan?.owner ?? project.owner}</dd></div><div><dt>批准人</dt><dd>{plan?.approver ?? project.approver}</dd></div><div><dt>当前竞争判断</dt><dd>{project.competition}</dd></div><div><dt>更新触发</dt><dd>客户需求、关键关系、主要对手或定价边界变化</dd></div></dl><div className="cw-help compact">销售员维护事实并提交策略；销售主管批准策略、调整资源，不代替销售员编造竞争信息。</div></Panel>
    </div>
  </div>;
}


type ActivityLane = "销售项目经营轨" | "投标运营轨";
type ActivityPathRow = ProjectAction & { lane: ActivityLane; trackType: "SALES_PROJECT_MANAGEMENT" | "BID_OPERATION"; definitionCode: string; ltcNode: string; businessObjectRef: string; completionEvent: string; milestoneId: string; timing: string; resourceRelated: boolean; executionStatus?: string; activityVersion?: number; manuallyControllable?: boolean; readOnly?: boolean; sourceSystem?: string; simulated?: boolean; generated?: boolean };

export function ActionsWorkspace({ project, manager, focusActivityId, onAdd, onRisk, onAddMilestone, onOpenResources, onUpdateActivity }: { project: SalesProject; manager: boolean; focusActivityId?: string; onAdd: () => void; onRisk: (title: string) => void; onAddMilestone: () => void; onOpenResources: () => void; onUpdateActivity: (activityId: string) => void }) {
  const milestones = project.milestones ?? [];
  const resultLocked = project.result !== "pending";
  const [mode, setMode] = useState<"path" | "list">("path");
  const [selection, setSelection] = useState({ projectId: project.id, milestoneId: "", activityId: "" });
  const projectSelection = selection.projectId === project.id ? selection : { projectId: project.id, milestoneId: "", activityId: "" };
  const normalizeDate = (value?: string) => value && /^\d{2}-\d{2}$/.test(value) ? `2026-${value}` : value ?? "—";
  const dayDelta = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Math.ceil((new Date(`${value}T00:00:00`).getTime() - new Date("2026-08-17T00:00:00").getTime()) / 86400000) : null;
  const laneOf = (text: string): ActivityLane => /资源|负责人|关系|伙伴|拜访|Touch|策略|竞争|业主|主体/.test(text) ? "销售项目经营轨" : "投标运营轨";
  const semanticOf = (text: string, lane: ActivityLane) => {
    if (lane === "销售项目经营轨") {
      if (/结果|移交/.test(text)) return ["ACT-SPM-07", "L2.9", "CommercialDealResult", "SalesResultConfirmed"] as const;
      if (/合同|订单|排产|交付|回款/.test(text)) return ["ACT-SPM-08", "L2.9", "DownstreamCommercialStatus", "DownstreamStatusSynchronized"] as const;
      if (/资源|负责人/.test(text)) return ["ACT-SPM-04", "L2.2", "ResourceRequestRef", "CriticalResourceArrived"] as const;
      if (/关系|客户|业主|主体/.test(text)) return ["ACT-SPM-03", "L2.2", "CustomerRelationshipCoverage", "DecisionChainUpdated"] as const;
      if (/策略|竞争/.test(text)) return ["ACT-SPM-02", "L2.2", "SalesProjectStrategy", "SalesStrategyApproved"] as const;
      if (/伙伴|协同/.test(text)) return ["ACT-SPM-05", "L2.3", "PartnerContributionRecord", "PartnerContributionConfirmed"] as const;
      return ["ACT-SPM-06", "L2.6", "TriangleEvaluation", "ProjectRiskEvaluated"] as const;
    }
    if (/结果|中标|丢标/.test(text)) return ["ACT-BID-09", "L2.9", "CommercialAwardBaseline", "SalesResultConfirmed"] as const;
    if (/提交|交标|报价|回执/.test(text)) return ["ACT-BID-08", "L2.8", project.scenarioContext?.submissionObject ?? "CommercialSubmission", "CommercialSubmissionAccepted"] as const;
    if (/决策|Bid.No.Bid/.test(text)) return ["ACT-BID-07", "L2.7", "BidDecision", "BidDecisionMade"] as const;
    if (/评审/.test(text)) return ["ACT-BID-06", "L2.6", "BidReview", "BidReviewCompleted"] as const;
    if (/投标包|标书|投标方案/.test(text)) return ["ACT-BID-05", "L2.5", "BidSolutionVersion", "BidPackagePrepared"] as const;
    if (/技术|方案|核价|成本|BOM|认证/.test(text)) return ["ACT-BID-04", "L2.4", "TechnicalSolution/QuotationDesignBOM/CostBaseline", "TechnicalPricingBaselineApproved"] as const;
    if (/商务|条款|偏差|价格|定价|授权/.test(text)) return ["ACT-BID-03", "L2.3", "CommercialSolution/PricingAuthorization", "CommercialSolutionCompleted"] as const;
    if (/准备|需求|澄清/.test(text)) return ["ACT-BID-02", "L2.2", "RequirementBaseline", "BidPreparationCompleted"] as const;
    return ["ACT-BID-01", "L2.1", "SalesProject", "SalesProjectCreated"] as const;
  };
  const milestoneFor = (text: string) => {
    const patterns = [/负责人|资源/, /客户|关系|主体|业主/, /需求|澄清/, /技术|方案|认证/, /核价|成本|毛利/, /偏差|授权|定价|价格/, /投标|交标|提交|报价/, /结果|移交|复盘/];
    for (const pattern of patterns) if (pattern.test(text)) { const matched = milestones.find(item => pattern.test(item.title)); if (matched) return matched; }
    return milestones.find(item => item.status !== "已完成") ?? milestones.at(-1);
  };
  const timingOf = (status: ProjectAction["status"], plannedEnd: string, actualEnd?: string) => {
    const remain = dayDelta(plannedEnd);
    const actualEndDelta = dayDelta(actualEnd);
    const planEndDelta = dayDelta(plannedEnd);
    if (status === "已完成") return actualEndDelta !== null && planEndDelta !== null && actualEndDelta > planEndDelta ? `晚于计划${actualEndDelta - planEndDelta}天` : "按计划完成";
    if (status === "已延期") return remain !== null && remain < 0 ? `已逾期${Math.abs(remain)}天` : "已延期";
    if (remain !== null && remain < 0) return `已逾期${Math.abs(remain)}天`;
    if (remain === null) return "待确认日期";
    return remain === 0 ? "今天到期" : remain > 0 ? `剩余${remain}天` : `已逾期${Math.abs(remain)}天`;
  };
  const persistedRows: ActivityPathRow[] = (project.activityRecords ?? []).map(record => {
    const milestone = milestoneFor(record.title);
    const status: ProjectAction["status"] = record.status === "completed" ? "已完成" : record.status === "cancelled" ? "已取消" : record.status === "blocked" ? "已阻塞" : record.status === "in_progress" ? "进行中" : record.timelinessStatus === "overdue" ? "已延期" : "待开始";
    const timing = record.timelinessStatus === "overdue" ? "已逾期" : record.timelinessStatus === "due_soon" ? "临近到期" : record.timelinessStatus === "completed_late" ? "晚于计划完成" : status === "已完成" ? "按计划完成" : "按计划";
    return { id: record.id, type: record.definitionCode, title: record.title, purpose: record.purpose, owner: record.ownerName, due: record.plannedEnd, status, evidence: record.evidenceRefs.join("；") || "待形成", result: record.result ?? record.exceptionReason ?? "待执行", plannedStart: record.plannedStart, plannedEnd: record.plannedEnd, actualStart: record.actualStart, actualEnd: record.actualEnd, progress: status === "已完成" ? 100 : status === "进行中" ? 55 : status === "已阻塞" || status === "已延期" ? 35 : 0, lane: record.trackType === "BID_OPERATION" ? "投标运营轨" : "销售项目经营轨", trackType: record.trackType, definitionCode: record.definitionCode, ltcNode: record.ltcNodeCode ?? "跨阶段", businessObjectRef: record.businessObjectRefs.map(item => `${item.objectType}:${item.objectId}${item.version ? `@${item.version}` : ""}`).join(" / ") || "尚无对象版本引用", completionEvent: record.completionEvent, milestoneId: milestone?.id ?? "", timing, resourceRelated: record.definitionCode === "ACT-SPM-04", executionStatus: record.status, activityVersion: record.version, manuallyControllable: ["ACT-SPM-05", "ACT-SPM-06"].includes(record.definitionCode), readOnly: record.readOnly, sourceSystem: record.sourceSystem, simulated: record.simulated };
  });
  const inferredRows: ActivityPathRow[] = project.actions.map(action => {
    const milestone = milestoneFor(`${action.type}${action.title}`);
    const plannedEnd = action.plannedEnd ?? action.due;
    const lane = laneOf(`${action.type}${action.title}`);
    const [definitionCode, ltcNode, businessObjectRef, completionEvent] = semanticOf(`${action.type}${action.title}`, lane);
    return { ...action, plannedEnd, lane, trackType: lane === "销售项目经营轨" ? "SALES_PROJECT_MANAGEMENT" : "BID_OPERATION", definitionCode, ltcNode, businessObjectRef, completionEvent, milestoneId: milestone?.id ?? "", timing: timingOf(action.status, plannedEnd, action.actualEnd), resourceRelated: /资源|负责人|伙伴/.test(`${action.type}${action.title}`) };
  });
  const explicitRows = project.persisted ? persistedRows : inferredRows;
  const linkedMilestones = new Set(explicitRows.map(item => item.milestoneId));
  const taskLabel = (title: string) => /需求/.test(title) ? `完成${title}的客户澄清` : /技术|方案|认证/.test(title) ? `组织${title}并关闭评审意见` : /核价|成本|毛利/.test(title) ? `汇总成本边界并推进${title}` : /偏差|授权|定价|价格/.test(title) ? `准备依据并完成${title}` : /投标|交标|提交|报价/.test(title) ? `核对提交条件并完成${title}` : /结果/.test(title) ? `取得正式证据并确认${title}` : `推进${title}并形成结果证据`;
  const generatedRows: ActivityPathRow[] = (project.persisted ? [] : milestones.filter(item => !linkedMilestones.has(item.id))).map(item => {
    const plannedEnd = normalizeDate(item.plannedAt);
    const milestoneIndex = milestones.findIndex(milestone => milestone.id === item.id);
    const status: ProjectAction["status"] = item.status === "已完成" ? "已完成" : item.status === "已延期" || item.status === "受阻" ? "已延期" : item.status === "进行中" ? "进行中" : "待开始";
    const lane = laneOf(item.title);
    const [definitionCode, ltcNode, businessObjectRef, completionEvent] = semanticOf(item.title, lane);
    return { id: `ACT-${item.id}`, type: "里程碑支撑活动", title: taskLabel(item.title), purpose: item.completionCriteria, owner: item.owner, due: plannedEnd, status, evidence: item.evidence, result: item.status === "已完成" ? item.completionCriteria : "待形成", plannedStart: milestoneIndex > 0 ? normalizeDate(milestones[milestoneIndex - 1]?.plannedAt) : plannedEnd, plannedEnd, actualStart: item.status === "未开始" ? "—" : normalizeDate(item.actualAt === "—" ? item.plannedAt : item.actualAt), actualEnd: item.status === "已完成" ? normalizeDate(item.actualAt) : "—", progress: item.status === "已完成" ? 100 : item.status === "进行中" ? 55 : item.status === "受阻" || item.status === "已延期" ? 35 : 0, lane, trackType: lane === "销售项目经营轨" ? "SALES_PROJECT_MANAGEMENT" : "BID_OPERATION", definitionCode, ltcNode, businessObjectRef, completionEvent, milestoneId: item.id, timing: timingOf(status, plannedEnd, item.status === "已完成" ? normalizeDate(item.actualAt) : "—"), resourceRelated: /资源|负责人|伙伴/.test(item.title), generated: true };
  });
  const activityRows = [...explicitRows, ...generatedRows].sort((a, b) => (a.plannedEnd ?? a.due).localeCompare(b.plannedEnd ?? b.due));
  const defaultRow = activityRows.find(item => item.id === focusActivityId) ?? activityRows.find(item => item.status === "已延期") ?? activityRows.find(item => item.status === "进行中") ?? activityRows[0];
  const selectedRow = activityRows.find(item => item.id === projectSelection.activityId) ?? defaultRow;
  const selectedL5Policies = selectedRow ? l5PoliciesForDefinition(selectedRow.definitionCode, project.scenarioContext?.scenario) : [];
  const selectedMilestone = milestones.find(item => item.id === (projectSelection.milestoneId || selectedRow?.milestoneId));
  const selectMilestone = (milestoneId: string) => setSelection({ projectId: project.id, milestoneId, activityId: activityRows.find(item => item.milestoneId === milestoneId)?.id ?? "" });
  const selectActivity = (row: ActivityPathRow) => setSelection({ projectId: project.id, milestoneId: row.milestoneId, activityId: row.id });
  const handleActivity = (row: ActivityPathRow) => {
    if (row.readOnly) return;
    if (resultLocked && row.context !== "post_award_responsibility") return;
    if (row.resourceRelated) { onOpenResources(); return; }
    if (project.persisted) { if (row.manuallyControllable) onUpdateActivity(row.id); return; }
    if (manager) { onRisk(`督办活动：${row.title}`); return; }
    onAdd();
  };
  const renderPathNode = (row: ActivityPathRow, index: number, laneRows: ActivityPathRow[]) => <button key={row.id} className={`cw-path-node ${selectedRow?.id === row.id ? "selected" : ""} ${row.status === "已延期" || row.status === "已阻塞" ? "blocked" : row.status === "已完成" ? "done" : row.status === "已取消" ? "cancelled" : ""} ${projectSelection.milestoneId && projectSelection.milestoneId !== row.milestoneId ? "muted" : ""}`} onClick={() => selectActivity(row)}><header><span>{row.definitionCode} · {row.ltcNode}</span><Status>{row.status}</Status></header><strong>{row.title}</strong><small className="cw-object-ref">{row.businessObjectRef}</small><dl><div><dt>Owner</dt><dd>{row.owner}</dd></div><div><dt>计划</dt><dd>{row.plannedStart ?? "待定"} → {row.plannedEnd}</dd></div><div><dt>实际</dt><dd>{row.actualStart ?? "—"} → {row.actualEnd ?? "—"}</dd></div></dl><footer><span className={row.timing.includes("逾期") || row.timing.includes("晚于") ? "danger" : ""}>{row.timing}</span><small>{row.evidence === "待形成" ? "证据待形成" : `证据 ${row.evidence}`}</small></footer>{index < laneRows.length - 1 && <i className="cw-path-connector">→</i>}</button>;
  return <div className="cw-page">
    {((project.sourceLineage?.candidateFacts?.followups.length ?? 0) > 0 || (project.sourceLineage?.candidateFacts?.attachments.length ?? 0) > 0) && <Panel kicker="LEAD HISTORY · READ ONLY" title="线索历史跟进与来源证据">
      <p className="cw-footnote">这是转化前历史，只读保留来源；不会自动生成项目行动，也不会冒充项目阶段完成证据。</p>
      <div className="cw-grid cw-grid-main">
        <div className="cw-span-7 cw-gap-list">{project.sourceLineage!.candidateFacts!.followups.map((item, index) => <article key={`lead-followup-${index}`}><Status tone="info">历史跟进</Status><strong>{String(item.title ?? item.content ?? item.summary ?? `跟进记录 ${index + 1}`)}</strong><small>{String(item.occurredAt ?? item.date ?? item.time ?? "时间未提供")} · {String(item.actor ?? item.owner ?? "人员未提供")}</small></article>)}</div>
        <div className="cw-span-5 cw-gap-list">{project.sourceLineage!.candidateFacts!.attachments.map((item, index) => <article key={`lead-attachment-${index}`}><Status tone="neutral">来源附件</Status><strong>{String(item.name ?? item.fileName ?? item.ref ?? `附件引用 ${index + 1}`)}</strong><small>{String(item.type ?? item.mimeType ?? "类型未提供")} · {String(item.hash ?? item.evidenceRef ?? "引用未提供")}</small></article>)}</div>
      </div>
    </Panel>}
    {project.persisted && project.stage === "S1" && <Panel kicker="EXTERNAL COLLABORATION · READ ONLY" title="投标作业轨方案准备协同">
      <p className="cw-footnote">专业任务已从销售项目界面移出。销售员和主管只查看任务状态及回传结果；本地演示由独立集成测试台模拟外部技术作业系统。</p>
      {project.externalTasks?.filter(item => ["TECHNICAL_COLLABORATION", "REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION"].includes(item.taskType)).map(item => <dl className="cw-summary" key={item.id}><div><dt>专业工作包</dt><dd>{item.taskType === "TECHNICAL_COLLABORATION" ? "启动评估" : item.taskType === "REQUIREMENT_BASELINE_PREPARATION" ? "正式需求基线" : item.taskType === "TECHNICAL_SOLUTION_PREPARATION" ? "技术方案" : "报价设计BOM与问题闭环"}</dd></div><div><dt>责任人</dt><dd>{item.assigneeName}</dd></div><div><dt>状态</dt><dd><Status>{externalStatusText[item.status] ?? item.status}</Status></dd></div><div><dt>来源</dt><dd>{item.targetSystem} · demo · 模拟数据</dd></div></dl>) ?? null}
      {!project.externalTasks?.some(item => ["TECHNICAL_COLLABORATION", "REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION"].includes(item.taskType)) && <div className="cw-help compact">尚未生成专业协同任务。请先由销售主管在“伙伴与资源”配置技术负责人。</div>}
    </Panel>}
    <div className="cw-page-actions"><div><span>MILESTONE & CONTROLLED EXECUTION</span><h2>里程碑与双轨活动</h2><p>里程碑独立维护计划与完成标准；流程任务由系统派发，经营行动必须从风险、关系或策略缺口发起。</p></div><div>{resultLocked ? <Status tone="info">商业结果已形成，投标前活动与计划只读</Status> : <><button className="cw-secondary" onClick={() => onRisk(project.risks[0]?.title ?? "项目风险缺口")}>{manager ? "从风险发起督办" : "从风险创建行动"}</button><button className="cw-primary" onClick={onAddMilestone}>＋ 维护里程碑</button></>}</div></div>
    <div className="cw-context-strip"><div><span>当前阶段目标</span><strong>{project.strategyPlan?.objective ?? project.strategy}</strong></div><div><span>开放活动</span><strong>{activityRows.filter(item => item.status !== "已完成").length}项</strong></div><div><span>计划偏差</span><strong>{activityRows.filter(item => item.timing.includes("逾期") || item.timing.includes("晚于")).length}项</strong></div><div><span>提交状态</span><strong>{submissionTimingLabel(project)}</strong></div></div>
    <div className="cw-grid cw-grid-main cw-execution-grid">
      <Panel kicker="MILESTONE-DRIVEN EXECUTION" title="项目关键路径｜里程碑驱动双线活动" className="cw-span-12 cw-execution-panel" action={<div className="cw-map-toggle"><button className={mode === "path" ? "active" : ""} onClick={() => setMode("path")}>依赖视图</button><button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>清单视图</button></div>}>
        <div className="cw-path-help"><strong>里程碑是结果锚点</strong><span>点击里程碑可高亮支撑活动；点击活动可查看计划、实际、责任和证据。</span><button className={!projectSelection.milestoneId ? "active" : ""} onClick={() => setSelection({ projectId: project.id, milestoneId: "", activityId: selectedRow?.id ?? "" })}>显示全部</button></div>
        {milestones.length ? <div className="cw-path-milestones">{milestones.map((item, index) => <button key={item.id} className={`${item.id === selectedMilestone?.id ? "selected" : ""} ${item.status === "受阻" || item.status === "已延期" ? "blocked" : item.status === "已完成" ? "done" : ""}`} onClick={() => selectMilestone(item.id)}><i>{item.status === "已完成" ? "✓" : index + 1}</i><span><small>{item.milestoneType ?? "项目管理"} · {item.plannedAt}</small><strong>{item.title}</strong><em>{item.completionCriteria}</em></span><Status>{item.status}</Status>{index < milestones.length - 1 && <b>→</b>}</button>)}</div> : <div className="cw-help"><strong>尚未建立项目里程碑</strong><br />流程活动和Gate状态不会被伪装成里程碑。请由Owner或主管建立计划锚点、负责人和完成标准。</div>}
        {mode === "path" ? <div className="cw-path-map">
          {(["销售项目经营轨", "投标运营轨"] as ActivityLane[]).map(lane => { const laneRows = activityRows.filter(item => item.lane === lane); return <section key={lane} className={lane === "销售项目经营轨" ? "operation" : "bid"}><header><i>{lane === "销售项目经营轨" ? "经" : "投"}</i><div><strong>{lane}</strong><small>{lane === "销售项目经营轨" ? "客户、关系、伙伴、策略与关键资源" : "需求、方案、设计BOM、核价、授权、提交与回执"}</small></div><span>{laneRows.length}项</span></header><div className="cw-path-track">{laneRows.map((row, index) => renderPathNode(row, index, laneRows))}</div></section>; })}
        </div> : <div className="cw-activity-tree cw-activity-tree-list"><div className="head"><span>轨道 / ACT活动</span><span>Owner</span><span>计划</span><span>实际</span><span>时间状态</span><span>执行状态</span></div>{activityRows.map(row => <button key={row.id} className={`cw-activity-list-row ${row.status === "已延期" ? "late" : ""} ${row.lane === "投标运营轨" ? "bid" : ""}`} onClick={() => selectActivity(row)}><div><i>{row.lane === "销售项目经营轨" ? "经" : "投"}</i><span><small>{row.definitionCode} · {row.ltcNode}</small><strong>{row.title}</strong><em>{row.businessObjectRef}</em></span></div><b>{row.owner}</b><span><small>开始 {row.plannedStart ?? "待定"}</small><strong>完成 {row.plannedEnd}</strong></span><span><small>开始 {row.actualStart ?? "—"}</small><strong>完成 {row.actualEnd ?? "—"}</strong></span><span className={row.timing.includes("逾期") || row.timing.includes("晚于") ? "danger" : ""}><strong>{row.timing}</strong><small>时间状态</small></span><div><Status>{row.status}</Status><small>{row.progress ?? 0}%</small></div></button>)}</div>}
        {selectedRow && <section className="cw-selected-activity"><header><div><span>{selectedRow.definitionCode} · {selectedRow.trackType}{selectedRow.readOnly ? ` · 外部只读${selectedRow.simulated ? " · demo模拟" : ""}` : " · 本系统权威"}{selectedRow.activityVersion ? ` · V${selectedRow.activityVersion}` : ""}</span><strong>{selectedRow.title}</strong>{selectedL5Policies.length > 0 && <small className="cw-activity-scenario-policy">当前场景：{selectedL5Policies.map(item => `${item.code} ${item.scenario.label} · ${L5_EXECUTION_MODE_LABELS[item.scenario.mode]} · ${item.workModes.join("/")}`).join("；")}</small>}</div><Status>{selectedRow.status}</Status></header><div><article><span>业务对象引用</span><strong>{selectedRow.businessObjectRef}</strong></article><b>→</b><article><span>计划动作</span><strong>{selectedRow.purpose}</strong></article><b>→</b><article><span>责任人</span><strong>{selectedRow.owner}</strong></article><b>→</b><article><span>时间状态</span><strong>{selectedRow.plannedEnd} · {selectedRow.timing}</strong></article><b>→</b><article><span>完成事件 / 证据</span><strong>{selectedRow.completionEvent || "等待外部完成事件"} · {selectedRow.evidence}</strong></article></div><footer><small>{selectedRow.readOnly ? `来源系统：${selectedRow.sourceSystem}；销售项目APP只读引用，不允许代填专业结论。` : `关联里程碑：${selectedMilestone?.title ?? "待关联"} · StageGate：${currentGate(project).code} · 执行状态与时间状态分别记录。`}</small><button className="cw-primary" disabled={selectedRow.readOnly || (resultLocked && selectedRow.context !== "post_award_responsibility") || (!selectedRow.resourceRelated && project.persisted && !selectedRow.manuallyControllable)} onClick={() => handleActivity(selectedRow)}>{selectedRow.readOnly ? "外部活动只读" : resultLocked && selectedRow.context !== "post_award_responsibility" ? "结果形成，已冻结" : selectedRow.resourceRelated ? "查看伙伴与资源" : project.persisted && !selectedRow.manuallyControllable ? "由Gate或领域事件更新" : manager ? "督办/更新" : "更新进展"}</button></footer></section>}
      </Panel>
    </div>
  </div>;
}

export function VersionsWorkspace({ project, manager, onChange, onSubmit, onApprove, onSaveRequirement, onNotify }: { project: SalesProject; manager: boolean; onChange: () => void; onSubmit: () => void; onApprove: (id: string) => void; onSaveRequirement?: (input: RequirementSourceInput) => void; onNotify: (message: string) => void }) {
  const order: ArtifactVersion["kind"][] = ["需求澄清包", "客户需求", "技术方案", "设计BOM", "核价方案", "授权底价", "投标方案"];
  const current = order.map(kind => project.versions.filter(item => item.kind === kind).at(-1));
  const reviewRequired = project.versions.filter(item => item.status === "需要重新评审").length;
  const pendingDeviation = project.deviations.filter(item => item.status === "待审批");
  const blocked = reviewRequired > 0 || pendingDeviation.length > 0 || project.resources.some(item => item.required && item.status !== "已到位");
  const configuration = project.configuration;
  const comparable = project.versions.filter(item => !["需求澄清包"].includes(item.kind));
  const comparisonDefaults = comparable.length > 1
    ? [comparable.at(-2)?.id ?? "", comparable.at(-1)?.id ?? ""]
    : ["", ""];
  const [comparison, setComparison] = useState({ projectId: project.id, leftId: comparisonDefaults[0], rightId: comparisonDefaults[1] });
  const leftId = comparison.projectId === project.id ? comparison.leftId : comparisonDefaults[0];
  const rightId = comparison.projectId === project.id ? comparison.rightId : comparisonDefaults[1];
  const setLeftId = (id: string) => setComparison({ projectId: project.id, leftId: id, rightId });
  const setRightId = (id: string) => setComparison({ projectId: project.id, leftId, rightId: id });
  const [showAllMatrixRows, setShowAllMatrixRows] = useState(false);
  const comparisonVersions = comparable;
  const leftVersion = comparisonVersions.find(item => item.id === leftId);
  const rightVersion = comparisonVersions.find(item => item.id === rightId);
  const costingCapabilityAvailable = true;
  type MatrixCell = { value: string; source: string; state: "provided" | "missing" | "future" | "not-applicable" | "unknown" };
  const emptyCell = (kind: ArtifactVersion["kind"]): MatrixCell => current[order.indexOf(kind)] ? { value: "未返回", source: "当前版本缺少该结构化字段", state: "missing" } : { value: "尚未形成", source: "该生命周期节点尚未形成", state: "future" };
  const notApplicableCell = (): MatrixCell => ({ value: "不适用", source: "该属性不属于此生命周期节点", state: "not-applicable" });
  const valueCell = (kind: ArtifactVersion["kind"], value?: string, source?: string): MatrixCell => value ? { value, source: source ?? current[order.indexOf(kind)]?.id ?? "权威版本", state: "provided" } : emptyCell(kind);
  const configurationRows = [
    { label: "型号", patterns: ["型号"] }, { label: "数量", patterns: ["数量", "台数"] }, { label: "关键参数", patterns: ["参数", "容量", "损耗", "能效", "接口", "标准"] }, { label: "供货范围", patterns: ["范围", "成套", "设备", "改造"] },
    { label: "交期", patterns: ["交期", "交付周期", "停电窗口", "现场窗口"] }, { label: "交付地点", patterns: ["交付地点", "项目地点", "区域仓"] }, { label: "验收条件", patterns: ["验收"] }, { label: "付款条件", patterns: ["付款", "质保金"] },
  ].map(rule => ({ ...rule, item: configuration?.items.find(item => rule.patterns.some(pattern => item.name.includes(pattern))) })).map(({ label, item }) => {
    const cells = Object.fromEntries(order.map(kind => {
      const explicit = item?.lifecycleValues?.[kind];
      if (explicit) return [kind, explicit.applicability === "not_applicable" ? { value: "不适用", source: explicit.source, state: "not-applicable" } : { value: explicit.value, source: explicit.source, state: explicit.applicability === "unknown" ? "unknown" : "provided" }];
      if (!item?.lifecycleValues && item && kind === "客户需求") return [kind, valueCell(kind, item.customerValue, item.source)];
      if (!item?.lifecycleValues && item && kind === "设计BOM") return [kind, valueCell(kind, item.proposedValue, item.source)];
      return [kind, emptyCell(kind)];
    })) as Record<ArtifactVersion["kind"], MatrixCell>;
    const distinctValues = [...new Set(order.map(kind => cells[kind]).filter(cell => cell.state === "provided").map(cell => cell.value))];
    const result = item?.status === "需要重新评审" ? "需要重新评审" : item?.status === "存在偏差" || distinctValues.length > 1 ? "存在偏差" : distinctValues.length === 1 && order.filter(kind => cells[kind].state === "provided").length > 1 ? "一致" : "暂不可判断";
    return { group: item?.group ?? "待分类", label, cells, result, source: item?.source ?? "尚无结构化来源", impacts: item?.impacts.join(" / ") ?? "待识别" };
  });
  const costing = current[4];
  const authorization = current[5];
  const submission = current[6];
  const money = (value?: number) => value === undefined ? undefined : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 万元`;
  const commercialRows = [
    { group: "商务与价格", label: "完整成本", cells: Object.fromEntries(order.map(kind => [kind, kind === "核价方案" ? valueCell(kind, money(costing?.costAmount), costing?.id) : notApplicableCell()])) as Record<ArtifactVersion["kind"], MatrixCell>, result: costing?.costAmount === undefined ? "暂不可判断" : "核价事实", source: costing?.id ?? "尚无核价版本", impacts: "核价 / 毛利 / 授权" },
    { group: "商务与价格", label: "报价", cells: Object.fromEntries(order.map(kind => [kind, kind === "核价方案" ? valueCell(kind, money(costing?.amount), costing?.id) : kind === "授权底价" ? valueCell(kind, money(authorization?.amount), authorization?.id) : kind === "投标方案" ? valueCell(kind, money(submission?.amount), submission?.id) : notApplicableCell()])) as Record<ArtifactVersion["kind"], MatrixCell>, result: submission?.amount === undefined ? "待投标确认" : authorization?.floorAmount !== undefined && submission.amount < authorization.floorAmount ? "未授权偏差" : authorization?.amount !== undefined && submission.amount !== authorization.amount ? "待核对授权范围" : "在授权范围", source: [costing?.id, authorization?.id, submission?.id].filter(Boolean).join(" / ") || "尚无价格链", impacts: "授权 / 投标 / 合同" },
    { group: "商务与价格", label: "授权底价", cells: Object.fromEntries(order.map(kind => [kind, kind === "授权底价" ? valueCell(kind, money(authorization?.floorAmount), authorization?.id) : notApplicableCell()])) as Record<ArtifactVersion["kind"], MatrixCell>, result: authorization?.floorAmount === undefined ? "暂不可判断" : "授权事实", source: authorization?.id ?? "尚无价格授权", impacts: "正式报价" },
    { group: "商务与价格", label: "毛利率", cells: Object.fromEntries(order.map(kind => [kind, kind === "核价方案" ? valueCell(kind, costing?.grossMarginRate === undefined ? undefined : `${costing.grossMarginRate.toFixed(2)}%`, costing?.id) : notApplicableCell()])) as Record<ArtifactVersion["kind"], MatrixCell>, result: costing?.grossMarginRate === undefined ? "暂不可判断" : "核价事实", source: costing?.id ?? "尚无核价版本", impacts: "经营决策 / 价格授权" },
  ];
  const consistencyRows = [...configurationRows, ...commercialRows];
  const visibleConsistencyRows = showAllMatrixRows ? consistencyRows : consistencyRows.filter(row => !["一致", "核价事实", "授权事实", "在授权范围"].includes(row.result));
  const consistencyCounts = consistencyRows.reduce((counts, row) => ({ ...counts, [row.result]: (counts[row.result] ?? 0) + 1 }), {} as Record<string, number>);
  const approvedConfiguration = configuration && ["已冻结", "中标基线"].includes(configuration.status) ? configuration : undefined;
  const hasExceptions = project.changeCount > 0 || project.deviations.length > 0 || blocked;
  const [requirementDraft, setRequirementDraft] = useState<RequirementSourceInput>({ originalText: current[0]?.summary ?? "", sourceRef: current[0]?.basedOn ?? "" });
  return <div className="cw-page">
    <div className="cw-page-actions"><div><span>OBJECT LINEAGE & DIGITAL THREAD</span><h2>需求到授标的版本血缘</h2><p>需求基线 → 技术方案 → 报价设计BOM → 成本基线 → 授权底价 → 对客提交；专业明细只读引用。</p></div><div>{project.stage === "S2" && <button className="cw-secondary" onClick={manager ? () => onNotify("已向项目Owner发起需求变更证据补充督办；主管不会代替销售员登记客户事实") : onChange}>{manager ? "督办需求变更登记" : "登记客户需求变更"}</button>}{["S5", "S6"].includes(project.stage) && <Status tone="info">结果形成，历史版本只读</Status>}<button className="cw-secondary" onClick={() => document.getElementById("baseline-consistency")?.scrollIntoView({ behavior: "smooth", block: "start" })}>查看一致性</button><button className="cw-secondary" onClick={() => onNotify(project.stage === "S4" ? "请到阶段门查看G5条件；批准后由投标作业执行正式提交并回传" : "正式提交状态由投标作业系统回传，本系统不提供模拟提交")}>查看外部提交状态</button></div></div>
    {project.sourceLineage?.initialRequirement && <Panel kicker="LEAD REQUIREMENT SNAPSHOT" title="线索初始需求快照" action={<Status tone="info">冻结只读</Status>}>
      <p className="cw-footnote">该快照来自线索培育阶段，用于说明项目为什么被转化以及后续要澄清什么；它不会因为S2澄清或G3评审而被覆盖，也不等于正式客户需求基线。</p>
      <dl className="cw-lead-requirement"><div><dt>客户原始表达</dt><dd>{project.sourceLineage.initialRequirement.originalText}</dd></div><div><dt>产品需求</dt><dd>{project.sourceLineage.initialRequirement.productRequirement}</dd></div><div><dt>数量</dt><dd>{project.sourceLineage.initialRequirement.quantity ?? "待澄清"}</dd></div><div><dt>资格/准入要求</dt><dd>{project.sourceLineage.initialRequirement.qualificationRequirements ?? "线索未提供"}</dd></div><div><dt>已知约束</dt><dd>{project.sourceLineage.initialRequirement.knownConstraints.join("；") || "线索未提供"}</dd></div><div><dt>待澄清事项</dt><dd>{project.sourceLineage.initialRequirement.unknowns.join("；") || "暂无显式缺口"}</dd></div><div><dt>来源引用</dt><dd>{project.sourceLineage.initialRequirement.sourceRefs.join("；") || project.sourceLineage.evidence}</dd></div><div><dt>冻结时间</dt><dd>{project.sourceLineage.initialRequirement.frozenAt}</dd></div></dl>
    </Panel>}
    <div className="cw-context-strip version"><div><span>一致性状态</span><Status>{reviewRequired ? "需要重新评审" : pendingDeviation.length ? "存在未批准偏差" : "一致或偏差已授权"}</Status></div><div><span>未批准偏差</span><strong>{pendingDeviation.length}</strong></div><div><span>下游受影响版本</span><strong>{reviewRequired}</strong></div><div><span>正式提交</span><Status tone={blocked ? "danger" : "success"}>{blocked ? "未允许" : "允许"}</Status></div></div>
    <div className="cw-help">锁定规则：已批准或正式提交版本不可覆盖，只能创建新版本；需求变更会把受影响的配置项以及技术、核价和投标版本标记为“需要重新评审”。</div>
    {project.stage === "S2" && <Panel kicker="S2 SOURCE FACTS" title="需求与方案来源记录（阶段门自动引用）" action={<Status>{project.s2Readiness?.items.every(item => item.ready) ? "来源已齐套" : "待补齐"}</Status>}>
      <p className="cw-footnote">线索初始需求已作为独立只读快照保留。本区记录项目阶段的新澄清事实和来源；技术负责人据此形成标准化需求与方案，独立技术评审人在G3确认正式基线。</p>
      <div className="form-grid two">
        <label className="field"><span>客户需求原文 / 最新答复</span><textarea value={requirementDraft.originalText} disabled={manager} onChange={event => setRequirementDraft(current => ({ ...current, originalText: event.target.value }))} placeholder="保留客户原始表达和最新确认边界；这里不是正式技术需求基线" /></label>
        <label className="field"><span>来源定位与证据</span><textarea value={requirementDraft.sourceRef} disabled={manager} onChange={event => setRequirementDraft(current => ({ ...current, sourceRef: event.target.value }))} placeholder="附件、页码、邮件或纪要编号" /></label>
      </div>
      {!manager && <div className="cw-form-actions"><span>责任角色：销售项目Owner负责客户澄清协调；没有新事实时无需重复保存</span><button className="cw-primary" disabled={!requirementDraft.originalText.trim() || !requirementDraft.sourceRef.trim()} onClick={() => onSaveRequirement?.(requirementDraft)}>保存需求澄清包新版本</button></div>}
      <div className="cw-help compact"><strong>技术评估由外部协同任务回传</strong><br />本页不允许销售员或销售主管代填标准化需求、设计采用值、技术方案、澄清和偏差结论。回传数据会作为独立技术来源版本自动显示在下方就绪检查中。</div>
      {project.externalTasks?.filter(item => ["REQUIREMENT_BASELINE_PREPARATION", "TECHNICAL_SOLUTION_PREPARATION", "BOM_AND_CLOSURE_PREPARATION"].includes(item.taskType)).map(item => <dl className="cw-summary" key={item.id}><div><dt>专业工作包</dt><dd>{item.taskType === "REQUIREMENT_BASELINE_PREPARATION" ? "正式需求基线" : item.taskType === "TECHNICAL_SOLUTION_PREPARATION" ? "技术方案" : "报价设计BOM与问题闭环"}</dd></div><div><dt>责任人</dt><dd>{item.assigneeName}</dd></div><div><dt>任务状态</dt><dd><Status>{externalStatusText[item.status] ?? item.status}</Status></dd></div><div><dt>任务编号</dt><dd>{item.externalTaskId}</dd></div></dl>)}
    </Panel>}
    <Panel kicker="TRACEABILITY" title="标的物版本链">
      <div className="cw-version-flow">{current.map((version, index) => { const capabilityHeld = !costingCapabilityAvailable && ["核价方案", "授权底价"].includes(order[index]); return <div className="cw-version-node" key={version?.id ?? order[index]}><div className={`cw-version-card ${capabilityHeld ? "muted" : ""}`}><span>{order[index]}</span><strong>{capabilityHeld ? "未接权威数据" : version ? `${order[index]} ${version.version}` : "待形成"}</strong>{version && !capabilityHeld && <small className="cw-version-ref" title={version.id}>{version.id.length > 18 ? `${version.id.slice(0, 18)}…` : version.id}</small>}<Status tone={capabilityHeld ? "warning" : undefined}>{capabilityHeld ? "能力冻结" : version?.status ?? "未形成"}</Status><dl>{capabilityHeld ? <div><dt>说明</dt><dd>历史demo记录已隔离</dd></div> : <><div><dt>上游</dt><dd title={version?.basedOn}>{version?.basedOn ?? "—"}</dd></div><div><dt>批准人</dt><dd>{version?.approver ?? "—"}</dd></div><div><dt>形成时间</dt><dd>{version?.createdAt ?? "—"}</dd></div></>}</dl></div>{!capabilityHeld && version && project.versions.filter(item => item.kind === version.kind).length > 1 && <div className="cw-version-history">另有 {project.versions.filter(item => item.kind === version.kind).length - 1} 个历史版本</div>}{index < current.length - 1 && <b>→<small>{["派生", "形成", "核价", "授权", "对客提交"][index]}</small></b>}</div>; })}</div>
    </Panel>
    <Panel kicker="CURRENT COMMITMENT" title="七节点承诺一致性矩阵" action={<div className="cw-counts"><Status tone="danger">差异 {(consistencyCounts["存在偏差"] ?? 0) + (consistencyCounts["未授权偏差"] ?? 0)}</Status><Status tone="warning">待确认 {(consistencyCounts["待投标确认"] ?? 0) + (consistencyCounts["暂不可判断"] ?? 0)}</Status><button className="cw-secondary" onClick={() => setShowAllMatrixRows(value => !value)}>{showAllMatrixRows ? "仅看差异与缺口" : "查看全部字段"}</button></div>}>
      <div id="baseline-consistency" className="cw-lifecycle-matrix-scroll"><table className="cw-lifecycle-matrix"><thead><tr><th>承诺属性</th>{order.map(kind => <th key={kind}>{kind}<small>{current[order.indexOf(kind)]?.version ?? "未形成"}</small></th>)}<th>一致性结论</th></tr></thead><tbody>{visibleConsistencyRows.map(row => <tr key={row.label} className={["存在偏差", "需要重新评审", "未授权偏差"].includes(row.result) ? "blocked" : ""}><th><small>{row.group}</small>{row.label}<span title={row.source}>来源可追溯</span></th>{order.map(kind => { const cell = row.cells[kind]; return <td key={kind} className={cell.state}><strong>{cell.value}</strong><small title={cell.source}>{cell.source}</small></td>; })}<td><Status tone={["存在偏差", "需要重新评审", "未授权偏差"].includes(row.result) ? "danger" : row.result.includes("待") || row.result === "暂不可判断" ? "warning" : "success"}>{row.result}</Status><small>影响：{row.impacts}</small></td></tr>)}</tbody></table></div>
      {!visibleConsistencyRows.length && <div className="cw-empty-inline"><strong>当前没有差异或缺口</strong><span>可切换“查看全部字段”核对七节点完整取值。</span></div>}
      <p className="cw-footnote">矩阵逐字段比较七个生命周期节点。“未返回”表示节点已经形成但权威系统没有提供该结构化字段；“尚未形成”表示流程尚未到达；“不适用”不参与一致性判断。</p>
    </Panel>
    {comparisonVersions.length > 1 && <Panel kicker="VERSION COMPARISON" title="版本链节点对比" action={<Status>可选任意节点</Status>}>
      <p className="cw-footnote"><strong>两种口径分开：</strong>这里选择任意两个生命周期节点核对身份、状态、上游与摘要；型号、数量、关键参数、范围、交期、地点、验收、付款、成本、价格和毛利的业务差异，以“当前承诺一致性矩阵”的结构化来源为准。</p>
      <div className="cw-version-compare-controls"><label><span>左侧版本</span><select value={leftVersion?.id ?? ""} onChange={event => setLeftId(event.target.value)}>{comparisonVersions.map(item => <option key={item.id} value={item.id}>{item.kind} {item.id} · {item.status}</option>)}</select></label><b>对比</b><label><span>右侧版本</span><select value={rightVersion?.id ?? ""} onChange={event => setRightId(event.target.value)}>{comparisonVersions.map(item => <option key={item.id} value={item.id}>{item.kind} {item.id} · {item.status}</option>)}</select></label></div>
      {leftVersion && rightVersion ? <div className="cw-history-comparison"><div><span>{leftVersion.kind}</span><strong>{leftVersion.version}</strong><small title={leftVersion.id}>{leftVersion.id}</small><p>{leftVersion.summary}</p></div><b>→</b><div><span>{rightVersion.kind}</span><strong>{rightVersion.version}</strong><small title={rightVersion.id}>{rightVersion.id}</small><p>{rightVersion.summary}</p></div><aside><Status tone={rightVersion.basedOn === leftVersion.id ? "success" : "warning"}>{rightVersion.basedOn === leftVersion.id ? "上下游引用一致" : "需核对上游引用"}</Status><p>左：{leftVersion.status}｜批准人 {leftVersion.approver}<br />右：{rightVersion.status}｜批准人 {rightVersion.approver}<br />右侧上游：{rightVersion.basedOn}</p></aside></div> : <div className="cw-empty-state"><strong>至少形成两个生命周期节点后才能比较</strong></div>}
    </Panel>}
    {hasExceptions && <Panel kicker="EXCEPTIONS & IMPACT" title="差异、阻断与影响" action={<Status tone={blocked ? "danger" : "warning"}>{blocked ? "存在阻断" : "需要关注"}</Status>}>
      <div className="cw-exception-summary"><div><span>需求变更</span><strong>{project.changeCount}项</strong></div><div><span>待重新评审版本</span><strong>{reviewRequired}个</strong></div><div><span>待审批偏差</span><strong>{pendingDeviation.length}项</strong></div><div><span>影响对象</span><strong>{reviewRequired ? "技术 / 投标" : "见主矩阵"}</strong></div></div>
      {project.deviations.map(item => <article className="cw-deviation-item" key={item.id}><div><span>偏差 {item.id}</span><strong>{item.field}：{item.requirement} → {item.proposal}</strong><small>{item.reason} · 影响：{item.impact} · 审批人：{item.approver}</small></div><Status>{item.status}</Status>{item.status === "待审批" && <button className="cw-primary" onClick={() => manager ? onApprove(item.id) : onNotify("销售员只能查看并催办；请切换销售主管审批偏差")}>{manager ? "批准偏差" : "查看审批要求"}</button>}</article>)}
      {blocked && <section className="cw-blocker"><strong>系统已阻止正式提交</strong><p>{pendingDeviation.length ? `存在${pendingDeviation.length}项未批准偏差；` : ""}{reviewRequired ? `${reviewRequired}个下游版本需要重新评审；` : ""}{project.resources.some(item => item.required && item.status !== "已到位") ? "关键资源未到位。" : ""}</p><button onClick={onSubmit}>查看全部阻断项</button></section>}
    </Panel>}
    {approvedConfiguration && <section className="cw-approved-baseline-strip" aria-label="已批准配置基线"><div><span>已批准配置基线</span><strong>{approvedConfiguration.id}</strong></div><div><span>版本</span><strong>{approvedConfiguration.version}</strong></div><div><span>状态</span><Status>{approvedConfiguration.status}</Status></div><div><span>批准人</span><strong>{approvedConfiguration.approver}</strong></div></section>}
    <details className="cw-history-disclosure"><summary><span><small>HISTORY & EXTERNAL REFERENCE</small><strong>版本历史与投标系统引用</strong></span><Status>{project.versions.filter(item => !["核价方案", "授权底价"].includes(item.kind)).length}个可追溯版本</Status></summary><div className="cw-grid cw-grid-main">
      <Panel kicker="HISTORY" title="版本时间线｜历史版本不可覆盖" className="cw-span-8"><div className="cw-version-timeline">{[...project.versions].reverse().filter(item => !["核价方案", "授权底价"].includes(item.kind)).map(item => <article key={item.id}><i /><div><strong>{item.kind} {item.id}</strong><Status>{item.status}</Status><p>{item.kind === "投标方案" && !costingCapabilityAvailable ? "投标版本及回执状态已保留；价格、成本和毛利明细在核价权威口径确认前不展示" : item.summary}</p><small>{item.createdAt} · 创建：{item.creator} · 批准：{item.approver} · 上游：{item.basedOn}</small></div></article>)}</div><p className="cw-footnote">核价方案和授权底价的历史demo记录已隔离，不作为当前业务事实展示。</p></Panel>
      <Panel kicker="EXTERNAL REFERENCE" title="投标管理APP" className="cw-span-4" action={<Status>{project.externalBid.status}</Status>}><dl className="cw-impact"><div><dt>投标编号</dt><dd>{project.externalBid.id}</dd></div><div><dt>负责人</dt><dd>{project.externalBid.owner}</dd></div><div><dt>最近同步</dt><dd>{project.externalBid.updatedAt}</dd></div><div><dt>当前引用版本</dt><dd>{current[6]?.id ?? "—"}</dd></div></dl><button className="cw-secondary full" onClick={() => onNotify("演示边界：打开外部投标管理APP，本系统不编制投标文件")}>打开外部系统（演示） ↗</button><p className="cw-footnote">本APP仅引用状态、版本和结果，不编制投标文件。</p></Panel>
    </div></details>
  </div>;
}

export function RulesWorkspace({ manager, onNotify }: { manager: boolean; onNotify: (message: string) => void }) {
  return <div className="cw-page">
    <div className="cw-page-actions"><div><span>BUSINESS RULE CONFIGURATION</span><h2>平台规则配置</h2><p>阶段、评分、风险阈值、角色权限和编号规则。销售主管只读查看，修改需业务管理员权限。</p></div><div><button className="cw-secondary" onClick={() => onNotify("已导出当前生效规则清单（演示）")}>导出规则清单</button><button className="cw-primary" onClick={() => onNotify(manager ? "销售主管没有全局规则编辑权限；需由业务管理员发起规则变更" : "当前角色无权访问平台规则配置")}>新建规则版本</button></div></div>
    <div className="cw-rules-banner"><Status tone="info">只读治理视图</Status><strong>销售主管可以核对项目使用了哪一版规则，但不能修改全公司的阶段门或权限。</strong><span>当前环境：演示租户 · 规则快照 2026-08-17</span></div>
    <Panel kicker="RULE CATALOG" title="规则版本目录"><div className="cw-data-table cw-rules-table"><div className="head"><span>规则类别</span><span>规则编号 / 版本</span><span>摘要</span><span>责任部门</span><span>生效日期</span><span>状态</span><span>操作</span></div>{platformRuleSets.map(rule => <div key={rule.id}><span><strong>{rule.category}</strong></span><span>{rule.id}<small>{rule.version}</small></span><span>{rule.summary}</span><span>{rule.owner}</span><span>{rule.effectiveAt}</span><span><Status>{rule.status}</Status></span><span><button className="cw-link" onClick={() => onNotify(`已打开${rule.category}${rule.version}规则详情；当前为只读演示`)}>查看规则</button></span></div>)}</div></Panel>
    <div className="cw-grid cw-grid-main"><Panel kicker="PERMISSION" title="角色权限摘要" className="cw-span-7"><div className="cw-permission-matrix"><div className="head"><span>业务动作</span><span>销售员</span><span>销售主管</span><span>业务管理员</span></div>{[["维护客户、竞争和行动事实", "允许", "查看/督办", "规则配置"], ["提交策略与阶段申请", "允许", "审核", "配置流程"], ["批准偏差、阶段和结果", "无权", "允许", "配置权限"], ["修改全局评分与阈值", "无权", "只读", "允许"]].map(row => <div key={row[0]}>{row.map((cell, index) => <span key={cell}><Status tone={cell === "允许" ? "success" : cell === "无权" ? "danger" : undefined}>{index === 0 ? <strong>{cell}</strong> : cell}</Status></span>)}</div>)}</div></Panel><Panel kicker="CHANGE CONTROL" title="规则变更边界" className="cw-span-5"><div className="cw-help compact">规则变更必须创建新版本、设置生效日期并保留历史。已运行项目是否套用新规则需要单独迁移决策，不能直接覆盖。</div><dl className="cw-summary"><div><dt>当前批准角色</dt><dd>业务管理员 / 流程与内控委员会</dd></div><div><dt>销售主管权限</dt><dd>查看、反馈、发起变更建议</dd></div><div><dt>本Demo边界</dt><dd>只演示规则目录和权限，不建设完整配置后台</dd></div></dl></Panel></div>
  </div>;
}

export type GateCondition = { label: string; ok: boolean; hard: boolean; owner: string };

function GateActivitySnapshotPanel({ snapshot }: { snapshot?: GateActivitySnapshot }) {
  if (!snapshot?.items.length) return null;
  return <details className="cw-audit-disclosure cw-span-12"><summary><span><small>ACTIVITY REFERENCES</small><strong>{snapshot.gateCode} 活动引用（只读）</strong></span><em>{snapshot.hasHardBlocker ? "存在活动硬阻断 · 点击展开" : "活动一致性通过 · 点击展开"}</em></summary><div className="cw-audit-body">
    <p className="cw-footnote">活动快照用于确认作业责任和状态是否闭环；需求、方案、价格、提交回执等业务对象仍是Gate判定的权威事实，不能只凭“活动完成”推进阶段。</p>
    <div className="cw-source-fact-grid">{snapshot.items.map((item, index) => <article className={item.ready ? "ready" : "missing"} key={`${item.definitionCode}-${item.sourceId ?? "missing"}-${index}`}>
      <header><span>{item.trackType === "BID_OPERATION" ? "投标作业轨" : "销售项目管理轨"}</span><Status>{item.sourceKind === "not_reported" ? item.hard ? "活动未回传" : "上下文未上报" : item.ready ? "状态满足" : "状态阻断"}</Status></header>
      <h3>{item.definitionCode}｜{item.purpose}</h3>
      <p>{item.sourceKind === "external" ? `${item.sourceSystem}只读回传` : item.sourceKind === "owned" ? "销售项目管理APP权威活动" : "尚未形成可引用的活动实例"}</p>
      <dl><div><dt>活动实例</dt><dd>{item.sourceId ?? "—"}</dd></div><div><dt>状态 / 版本</dt><dd>{item.status} · {item.instanceVersion ? `V${item.instanceVersion}` : "—"}</dd></div><div><dt>责任人</dt><dd>{item.ownerName ?? "按来源对象责任"}</dd></div><div><dt>控制级别</dt><dd>{item.hard ? "硬阻断" : "决策上下文"}</dd></div><div><dt>证据引用</dt><dd>{item.evidenceRefs.join(" / ") || "见业务对象快照"}</dd></div></dl>
    </article>)}</div>
    <p className="cw-footnote">规则版本：{snapshot.definitionVersion} · 冻结后来源ID、状态和版本发生变化时必须重新提交。</p>
  </div></details>;
}

export function GateWorkspace({ project, manager, conditions, onAdvance, onSubmitG2, onNavigateG2Source, onNavigateS2Source, onSubmitS2, onRequestCosting, onSubmitS3, onSubmitS4, onSubmitG6, gateStatus, gateComment, g2Readiness, s2Readiness, s3Readiness, g5Readiness, g6Readiness }: { project: SalesProject; manager: boolean; conditions: GateCondition[]; onAdvance: () => void; onSubmitG2?: () => void; onNavigateG2Source?: (tab: G2SourceTab) => void; onNavigateS2Source?: () => void; onSubmitS2?: () => void; onRequestCosting?: () => void; onSubmitS3?: () => void; onSubmitS4?: () => void; onSubmitG6?: (remediation?: { resolutionSummary: string; evidenceRef: string }) => void; gateStatus?: "pending" | "returned" | "approved"; gateComment?: string; g2Readiness?: G2ReadinessSnapshot; s2Readiness?: S2ReadinessSnapshot; s3Readiness?: S3ReadinessSnapshot; g5Readiness?: G5ReadinessSnapshot; g6Readiness?: G6ReadinessSnapshot }) {
  const [g6RemediationSummary, setG6RemediationSummary] = useState("");
  const [g6RemediationEvidence, setG6RemediationEvidence] = useState("");
  const blockers = conditions.filter(item => !item.ok);
  const hard = blockers.filter(item => item.hard);
  const gate = currentGate(project);
  const professionalExit = project.stage === "S2" || project.stage === "S3";
  const exitName = `${gate.code} ${gate.name}`;
  const exitEvent = project.stage === "S2" ? "CustomerRequirementBaselined" : project.stage === "S3" ? "CostingSolutionApproved" : project.stage === "S4" ? "BidDecisionMade + CommercialSubmissionAccepted" : gate.stageExitEvent;
  const decisionRole = project.stage === "S2" ? "系统校验（技术负责人已在来源确认）" : project.stage === "S3" ? "财务授权人" : project.stage === "S4" ? "销售主管/投标授权决策人" : "销售主管";
  const activitySnapshot = project.stage === "S1" ? g2Readiness?.activitySnapshot : project.stage === "S2" ? s2Readiness?.activitySnapshot : project.stage === "S3" ? s3Readiness?.activitySnapshot : project.stage === "S4" ? g5Readiness?.activitySnapshot : project.stage === "S5" ? g6Readiness?.activitySnapshot : undefined;
  const g1Draft = project.stage === "S0" && !gateStatus;
  const g1Waiting = project.stage === "S0" && gateStatus === "pending";
  const g1Returned = project.stage === "S0" && gateStatus === "returned";
  const primaryDisabled = (manager && hard.length > 0) || (manager && professionalExit) || (project.stage === "S4" && manager && gateStatus !== "pending") || (project.stage === "S0" && manager && !g1Waiting) || (project.stage === "S0" && !manager && g1Waiting);
  const primaryLabel = manager
    ? professionalExit ? `等待${decisionRole}` : project.stage === "S4" ? "决定投标并授权提交" : project.stage === "S0" ? g1Waiting ? "审查并决策" : g1Returned ? "等待Owner重新提交" : "等待Owner提交G1" : "批准推进"
    : project.stage === "S0" ? g1Draft ? "提交G1审批" : g1Returned ? "补充后重新提交" : "已提交，等待主管" : project.stage === "S1" ? "核对G2来源汇总" : professionalExit || project.stage === "S4" ? `核对${gate.code}来源汇总` : "提交主管审批";
  return <div className="cw-page">
    <div className={`cw-role-contract ${manager ? "manager" : "sales"}`}><div><span>{manager ? professionalExit ? "主管只读督办区" : "主管决策区" : "销售提交区"}</span><strong>{g1Draft ? manager ? "S0草稿尚未形成审批任务；等待项目Owner提交" : "核对项目来源与责任后，由Owner提交G1" : manager ? professionalExit ? `查看${exitName}状态，不代替${decisionRole}` : "批准或退回；终止走独立受控分支" : project.stage === "S2" ? "核对销售与技术权威来源，触发G3系统校验" : professionalExit ? `核对自动引用的来源事实，申请${decisionRole}确认` : "补齐来源事实并提交指定责任人"}</strong></div><p>阶段出口只冻结并引用来源对象，不在审批页重复录入专业事实，也不让销售主管代批专业结论。企业尚未确认“附条件批准”规则，当前不提供该决策。</p><Status>{g1Draft ? "草稿｜未提交" : g1Waiting ? "G1快照已冻结" : hard.length ? `${hard.length}项硬阻断` : blockers.length ? `${blockers.length}项管理缺口` : project.stage === "S2" ? "允许系统校验" : professionalExit && manager ? `等待${decisionRole}确认` : "允许推进"}</Status></div>
    <div className="cw-gate-heading"><div><span>{project.id} · {project.stage} {project.stageName}</span><h2>{exitName}</h2><p>{project.stage === "S2" ? "G3汇总销售确认的需求澄清包，以及专业责任人形成的正式需求基线、技术方案、报价设计BOM、问题澄清和偏差；销售Owner只提交冻结快照，由独立技术评审人确认基线。" : project.stage === "S3" ? "G4汇总技术基线、BOM、价格快照、成本利润与交期风险；财务/价格授权人确认 CostingSolutionApproved 后，系统进入S4。" : project.stage === "S4" ? "G5汇总投标专员形成的提交包与专业评审人的独立结论，由销售主管一次完成投/不投及提交授权；批准后仍停留S4，投标作业回传有效回执才进入S5。" : gate.interaction}</p>{g1Draft ? <p><Status>项目草稿</Status> 尚未生成G1审批实例或冻结快照。</p> : gateStatus && <p><Status>{gateStatus === "pending" ? "评审中" : gateStatus === "returned" ? "已退回补充" : project.stage === "S4" ? "已批准，等待正式提交回执" : "已批准"}</Status>{gateComment ? ` ${gateComment}` : ""}</p>}</div>{project.stage === "S0" && <div><button className="cw-primary" disabled={primaryDisabled} onClick={onAdvance}>{primaryLabel}</button></div>}</div>
    <div className="cw-gate-rail">{gateDefinitions.map(item => <span key={item.code} className={item.code === gate.code ? "current" : ""}><i>{item.code}</i><strong>{item.name}</strong><small>{item.stage}</small></span>)}</div>
    <div className="cw-gate-contract"><div><span>当前交互输入</span><strong>{stageDefinitions.find(item => item.code === project.stage)?.output}</strong></div><b>→</b><div><span>门禁决策</span><strong>{gate.code} · {hard.length ? "存在硬阻断" : blockers.length ? "需要管理判断" : "允许推进"}</strong></div><b>→</b><div><span>输出 / 反馈事件</span><strong>{gate.interaction.split("→").at(-1)}</strong></div></div>
    <div className="cw-grid cw-grid-main">
      {project.stage === "S1" && <Panel kicker="G2 WORK INITIATION REVIEW" title="G2投入启动门｜经营事实与专业作业计划" className="cw-span-12" action={<Status>{gateStatus === "pending" ? "快照已冻结，等待主管" : g2Readiness?.items.every(item => !item.hard || item.ready) ? "硬条件已齐套" : manager ? "等待Owner补齐" : "存在硬条件缺口"}</Status>}>
        <p className="cw-footnote">G2决定是否投入详细需求、方案和投报作业，不审批技术结论。系统按首版赢单策略、客户决策链、资源投入、采购/投报计划和启动评估自动汇总；最近客户接触和初版商务条款作为管理上下文显示。</p>
        <div className="cw-source-fact-grid">{g2Readiness?.items.map(item => <article className={item.ready ? "ready" : item.hard ? "missing" : ""} key={item.key}><header><span>{item.track}</span><Status>{item.ready ? "来源已就绪" : item.hard ? "硬条件缺失" : "后续阶段上下文"}</Status></header><h3>{item.label}</h3><p>{item.summary || "尚无可引用的来源记录"}</p><dl><div><dt>责任角色</dt><dd>{item.owner}</dd></div><div><dt>门禁属性</dt><dd>{item.hard ? "G2硬条件" : "G2非阻断上下文"}</dd></div><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl><button className="cw-secondary" onClick={() => onNavigateG2Source?.(item.sourceTab)}>{item.ready ? "查看来源" : item.hard ? "去来源页面补充" : "查看责任边界"}</button></article>) ?? <p className="cw-help">当前内置样例没有D1来源引用；请使用真实立项项目验证自动汇总流程。</p>}</div>
        {!manager && <div className="cw-form-actions"><span>提交的是当前来源快照和投入建议，不要求销售员在Gate页重复填写，也不把客户接触记录或商务上下文伪装成专业交付件。</span><button className="cw-primary" disabled={gateStatus === "pending" || !g2Readiness?.items.every(item => !item.hard || item.ready) || g2Readiness?.activitySnapshot?.hasHardBlocker} onClick={() => onSubmitG2?.()}>{gateStatus === "returned" ? "按来源补充后重新提交G2" : "提交专业作业投入申请"}</button></div>}
        {manager && gateStatus === "pending" && <div className="cw-form-actions"><span>主管在同一审查抽屉中核对冻结事实，并选择批准或退回；不会直接一键推进。</span><button className="cw-primary" onClick={onAdvance}>审查并形成G2结论</button></div>}
      </Panel>}
      {project.stage === "S2" && <Panel kicker="G3 TECHNICAL BASELINE REVIEW" title="G3需求与技术基线门｜按对象顺序汇总" className="cw-span-12" action={<Status>{gateStatus === "pending" ? "快照已冻结，等待独立技术评审" : s2Readiness?.items.every(item => item.ready) ? "来源已齐套" : "存在来源缺口"}</Status>}>
        <p className="cw-footnote">顺序固定为：需求澄清包 → 正式需求基线 → 技术方案 → 报价设计BOM → 问题澄清与偏差闭环 → 独立技术评审。销售Owner只协调客户澄清和提交冻结快照，不编制或自审专业对象。</p>
        <div className="cw-source-fact-grid">{s2Readiness?.items.map(item => { const stale = !item.ready && item.sourceRefs.length > 0; return <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : stale ? "来源已失效" : "来源缺失"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p><dl><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl><button className="cw-secondary" onClick={onNavigateS2Source}>{item.ready ? "查看版本链来源" : stale ? "查看失效版本" : "去版本链补充"}</button></article>; }) ?? <p className="cw-help">尚无S2来源记录，请先到“标的物与版本”保存需求来源和技术评估。</p>}</div>
        {!manager && <div className="cw-form-actions"><span>技术负责人完成编制后，销售Owner核对来源并提交；系统冻结快照，由独立技术评审人作出评审结论。</span><button className="cw-primary" disabled={gateStatus === "pending" || !s2Readiness?.items.every(item => !item.hard || item.ready) || s2Readiness?.activitySnapshot?.hasHardBlocker} onClick={() => onSubmitS2?.()}>{gateStatus === "returned" ? "补充后重新提交G3评审" : "提交G3技术评审"}</button></div>}
        {gateStatus === "pending" && <div className="cw-help compact"><strong>旧版G3确认任务已冻结</strong><br />该流程不再允许销售提交给技术负责人自审。刷新业务数据后，由销售Owner按新流程重新触发系统校验。</div>}
      </Panel>}
      {project.stage === "S3" && <Panel kicker="G4 AUTO-AGGREGATED GATE REVIEW" title="G4核价授权门｜来源事实汇总" className="cw-span-12" action={<Status>{gateStatus === "pending" ? "快照已冻结，等待财务授权确认" : s3Readiness?.items.every(item => item.ready) ? "来源已齐套" : "存在来源缺口"}</Status>}>
        <p className="cw-footnote">核价结果是进入G4的必备外部权威事实。销售项目APP不计算成本或核价，只读引用有效的 CostingSolution、PricingAuthorization 及版本证据；G3通过只进入S3，不自动指派核价负责人，也不伪造核价结果。</p>
        {(() => { const task = project.externalTasks?.find(item => item.taskType === "COSTING_COLLABORATION" && ["pending", "accepted", "completed"].includes(item.status)); return <div className="cw-help compact"><strong>核价专业作业启动</strong><br />{task ? <>任务 {task.externalTaskId}｜{externalStatusText[task.status] ?? task.status}｜{task.assigneeName}｜{task.targetSystem}（demo模拟）</> : manager ? <>G3技术基线已批准，但核价任务尚未启动。主管需要确认启动协同；启动不等于指派到位，也不等于核价完成。<br /><button className="cw-primary" onClick={onRequestCosting}>确认启动核价专业作业</button></> : <>尚未生成核价专业作业任务；请由销售主管确认启动，销售Owner不能代替专业人员形成结果。</>}</div>; })()}
        <div className="cw-source-fact-grid">{s3Readiness?.items.map(item => { const stale = !item.ready && item.sourceRefs.length > 0; return <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : stale ? "来源已失效" : "来源缺失"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p><dl><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl><button className="cw-secondary" onClick={onNavigateS2Source}>{item.ready ? "查看版本链来源" : "查看专业作业缺口"}</button></article>; }) ?? <p className="cw-help">尚未收到S3核价专业结果。请在3010处理核价协同任务，完成后刷新本页。</p>}</div>
        {!manager && <div className="cw-form-actions"><span>没有有效核价和价格授权结果时保持阻断；仅在责任人、权威版本和全部专业来源齐套后才允许申请G4。</span><button className="cw-primary" disabled={gateStatus === "pending" || !s3Readiness?.items.every(item => item.ready) || s3Readiness?.activitySnapshot?.hasHardBlocker} onClick={() => onSubmitS3?.()}>{gateStatus === "returned" ? "专业结果更新后重新提交G4" : "申请财务/价格授权人确认G4"}</button></div>}
        {gateStatus === "pending" && <div className="cw-help compact"><strong>G4外部财务授权任务已发出</strong><br />销售员与销售主管不能在本页代批。请在3010由罗总形成结论，然后刷新主系统。{project.externalTasks?.filter(item => item.taskType === "G4_GATE_REVIEW").slice(0, 1).map(item => <span key={item.id}><br />任务 {item.externalTaskId}｜{externalStatusText[item.status] ?? item.status}｜{item.assigneeName}｜demo模拟</span>)}</div>}
      </Panel>}
      {project.stage === "S4" && <Panel kicker="G5 SINGLE BUSINESS DECISION" title="G5商务决策与提交门｜一次决策、受控执行" className="cw-span-12" action={<Status>{gateStatus === "approved" ? "已授权，等待投标作业回执" : gateStatus === "pending" ? "等待主管商务决策" : g5Readiness?.items.some(item => item.hard && !item.ready) ? "存在硬条件缺口" : "硬条件已齐套"}</Status>}>
        <p className="cw-footnote">G5汇总G4价格授权、最终提交包、专业评审、风险、偏差和签审一致性。主管只作一次“投/不投 + 是否按冻结版本提交”的决策；投标作业实际提交不是第二次审批。</p>
        <div className="cw-source-fact-grid">{g5Readiness?.items.map(item => <article className={item.ready ? "ready" : item.hard ? "missing" : "context"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : item.hard ? "来源缺失或失效" : "需在决策中确认"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p><dl><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl><button className="cw-secondary" onClick={onNavigateS2Source}>{item.ready ? "查看版本与来源" : "查看来源缺口"}</button></article>) ?? <p className="cw-help">G4通过后会在独立集成测试台生成投标包编制任务；完成回传后刷新本页。</p>}</div>
        {(g5Readiness?.deviationAuthorizations?.length ?? 0) > 0 && <details className="cw-audit-details"><summary>查看已生效偏差授权（{g5Readiness!.deviationAuthorizations!.length}）</summary><div className="cw-table-wrap"><table className="cw-table"><thead><tr><th>偏差来源</th><th>授权范围</th><th>剩余风险</th><th>适用版本</th><th>有效期</th><th>授权人</th><th>证据</th></tr></thead><tbody>{g5Readiness!.deviationAuthorizations!.map(item => <tr key={String(item.id)}><td>{String(item.deviation_ref)}</td><td>{String(item.scope)}</td><td>{String(item.risk)}</td><td>{String(item.applicable_version_id)}</td><td>{String(item.valid_until)}</td><td>{String(item.authorized_by_name)}</td><td>{String(item.evidence_ref)}</td></tr>)}</tbody></table></div></details>}
        {!manager && <div className="cw-form-actions"><span>销售Owner只提交自动汇总快照，不重复填写价格、风险或投标包数据。</span><button className="cw-primary" disabled={gateStatus === "pending" || gateStatus === "approved" || g5Readiness?.items.some(item => item.hard && !item.ready) || g5Readiness?.activitySnapshot?.hasHardBlocker} onClick={() => onSubmitS4?.()}>{gateStatus === "returned" ? "来源更新后重新提交G5" : "提交G5商务决策"}</button></div>}
        {manager && gateStatus === "pending" && <div className="cw-form-actions"><span>在同一G5审查表中选择投/报或不投/不报；任何结论都必须填写依据。</span><button className="cw-primary" onClick={onAdvance}>审查并形成G5结论</button></div>}
        {gateStatus === "approved" && <div className="cw-help compact"><strong>商务决策已完成，项目仍在S4</strong><br />系统已生成投标作业正式提交任务。只有孙投标回传与冻结包哈希一致的客户/平台回执，系统才会记录 CommercialSubmissionAccepted 并进入S5。{project.externalTasks?.filter(item => item.taskType === "G5_SUBMISSION_EXECUTION").slice(0, 1).map(item => <span key={item.id}><br />任务 {item.externalTaskId}｜{externalStatusText[item.status] ?? item.status}｜{item.assigneeName}｜demo模拟</span>)}</div>}
        {!g5Readiness?.bidPackageVersion && project.externalTasks?.filter(item => item.taskType === "BID_PACKAGE_PREPARATION").slice(0, 1).map(item => <div className="cw-help compact" key={item.id}><strong>投标包编制任务已发出</strong><br />任务 {item.externalTaskId}｜{externalStatusText[item.status] ?? item.status}｜{item.assigneeName}。投标包形成后，系统将另行生成专业评审任务。</div>)}
      </Panel>}
      {project.stage === "S5" && <Panel kicker="G6 AUTO-AGGREGATED RESULT GATE" title="G6结果与移交门｜统一提交与审批入口" className="cw-span-12" action={<Status>{gateStatus === "pending" ? "快照已冻结，等待主管" : g6Readiness?.items.every(item => item.ready) ? "来源已齐套" : "存在来源缺口"}</Status>}>
        <p className="cw-footnote">G6与“结果与移交”工作区引用同一份服务端就绪快照和同一个Gate实例。本页可以直接提交或审批，不再要求用户记住另一个入口；结果明细与移交执行仍在结果工作区查看。</p>
        <div className="cw-source-fact-grid">{g6Readiness?.items.map(item => <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : "来源缺失或不一致"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p><dl><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl></article>) ?? <p className="cw-help">尚未收到L2.9正式结果或复盘/移交来源。</p>}</div>
        {!manager && gateStatus === "returned" && g6Readiness?.resultType === "won" && <div className="form-grid two"><label><span>合同退回整改结论</span><textarea value={g6RemediationSummary} onChange={event => setG6RemediationSummary(event.target.value)} placeholder="说明已修正的来源、承诺范围或合同差异" /></label><label><span>整改证据</span><input value={g6RemediationEvidence} onChange={event => setG6RemediationEvidence(event.target.value)} placeholder="修订记录、确认单或受控版本编号" /></label></div>}
        {!manager && <div className="cw-form-actions"><span>提交前服务端重新计算结果、版本血缘和活动状态；本页不允许人工重写结果。</span><button className="cw-primary" disabled={gateStatus === "pending" || !g6Readiness?.items.every(item => item.ready) || g6Readiness?.activitySnapshot?.hasHardBlocker || (gateStatus === "returned" && g6Readiness?.resultType === "won" && (!g6RemediationSummary.trim() || !g6RemediationEvidence.trim()))} onClick={() => onSubmitG6?.(gateStatus === "returned" && g6Readiness?.resultType === "won" ? { resolutionSummary: g6RemediationSummary, evidenceRef: g6RemediationEvidence } : undefined)}>{gateStatus === "returned" ? "整改后重新提交G6新版本" : "提交G6结果确认"}</button></div>}
        {manager && gateStatus === "pending" && <div className="cw-form-actions"><span>主管确认的是冻结的商业结果及移交/复盘分支，不代替投标作业形成结果事实。</span><button className="cw-primary" onClick={onAdvance}>审查并形成G6结论</button></div>}
      </Panel>}
      <GateActivitySnapshotPanel snapshot={activitySnapshot} />
      {project.stage === "S0" && <Panel kicker="CHECKLIST" title="G1进入条件与核心输出" className="cw-span-12" action={<div className="cw-counts"><Status tone="success">已满足 {conditions.filter(item => item.ok).length}</Status><Status tone="warning">未满足 {blockers.length}</Status></div>}>
        <div className="cw-gate-checks"><div className="head"><span>检查项</span><span>责任人</span><span>证据 / 版本</span><span>系统校验</span><span>人工结论</span></div>{conditions.map((item, index) => <div key={item.label}><span><i className={item.ok ? "ok" : "bad"}>{item.ok ? "✓" : "!"}</i><strong>{item.label}</strong><small>{item.hard ? "硬校验" : "管理要求"}</small></span><span><Person name={item.owner} /></span><span>{index % 2 ? project.versions[index % Math.max(project.versions.length, 1)]?.id ?? "任务证据" : project.evidence}</span><span><Status>{item.ok ? "通过" : item.hard ? "阻断" : "警告"}</Status></span><span>{item.ok ? "满足" : "待补充结论"}</span></div>)}</div>
      </Panel>}
      <details className="cw-audit-disclosure cw-span-12"><summary><span><small>AUDIT TRAIL</small><strong>活动记录（只读）</strong></span><em>点击展开</em></summary><div className="cw-audit-pairs"><article><span>申请与冻结</span><strong>{project.owner}提交阶段出口申请</strong><small>系统重新计算来源、冻结对象ID与版本快照</small></article><b>→</b><article><span>独立评审与决策</span><strong>{decisionRole}</strong><small>{gateStatus === "approved" ? "已形成批准结论" : gateStatus === "returned" ? "已退回，等待来源更新后重提" : "等待在顶部唯一决策入口形成结论"}</small></article><b>→</b><article><span>执行与回执</span><strong>{project.stage === "S4" ? "正式提交回执" : professionalExit ? exitEvent : "阶段完成事件"}</strong><small>{project.stage === "S4" ? "批准不等于已提交；收到 CommercialSubmissionAccepted 才完成" : "执行结果与审批结论成对留痕，不改写历史记录"}</small></article></div></details>
    </div>
  </div>;
}

export function ResultWorkspace({ project, manager, gateStatus, gateExecutionStatus, onPrepareReview, onOpenGate, onRequestResultCorrection, onAddPostAwardResponsibility, onManagePostAwardResponsibilities, onReset, onNotify }: { project: SalesProject; manager: boolean; gateStatus?: "pending" | "returned" | "approved"; gateExecutionStatus?: "not_required" | "executing" | "completed"; onPrepareReview: () => void; onOpenGate: () => void; onRequestResultCorrection: (routeResultId: string, reason: string, evidenceRef: string) => void; onAddPostAwardResponsibility: () => void; onManagePostAwardResponsibilities: () => void; onReset: () => void; onNotify: (message: string) => void }) {
  const [correctionResultId, setCorrectionResultId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("多条通路同时标记中标，需要投标作业责任人复核正式授标结果与钱江入选范围");
  const [correctionEvidence, setCorrectionEvidence] = useState("");
  const language = submissionLanguage(project);
  const adminStatus = project.administrativeStatus ?? "Active";
  const reportedType = project.g6Readiness?.resultType;
  const readiness = project.g6Readiness;
  const allReady = Boolean(readiness?.items.length && readiness.items.every(item => item.ready) && !readiness.activitySnapshot?.hasHardBlocker);
  const resultTasks = project.externalTasks?.filter(item => item.taskType === "COMMERCIAL_RESULT_TRACKING") ?? [];
  const openResultTasks = resultTasks.filter(item => ["pending", "accepted"].includes(item.status));
  const routeResultProgress = readiness?.submittedRoutes?.length ? `${readiness.routeResults?.length ?? 0}/${readiness.submittedRoutes.length}` : undefined;
  const contractTask = project.externalTasks?.find(item => item.taskType === "CONTRACT_HANDOVER_EXECUTION" && ["pending", "accepted"].includes(item.status));
  const downstreamLabels: Record<NonNullable<SalesProject["downstreamEvents"]>[number]["objectType"], string> = { Contract: "合同", Order: "订单", Delivery: "交付", Acceptance: "验收", Invoice: "开票", Payment: "回款" };
  const downstreamOrder: NonNullable<SalesProject["downstreamEvents"]>[number]["objectType"][] = ["Contract", "Order", "Delivery", "Acceptance", "Invoice", "Payment"];
  const latestDownstreamByType = new Map(downstreamOrder.map(type => [type, project.downstreamEvents?.filter(item => item.objectType === type).at(-1)]));
  const postAwardResponsibilities = project.actions.filter(item => item.context === "post_award_responsibility");
  const onWin = () => onNotify("真实项目必须先由投标作业轨回传BidResult，再提交G6；主系统不能直接模拟中标");
  const onLost = onPrepareReview;
  if (project.stage !== "S5" && project.stage !== "S6") return <div className="cw-page"><Panel title="尚未进入结果与移交阶段"><div className="cw-empty-state"><i>S5</i><strong>完成正式投标提交并取得客户回执后进入</strong><p>结果由销售主管确认；销售员负责跟踪客户通知并准备移交或复盘材料。</p></div></Panel></div>;
  if (project.persisted && project.result === "pending") return <div className="cw-page">
    <div className={`cw-role-contract ${manager ? "manager" : "sales"}`}><div><span>{manager ? "G6结果确认" : "G6材料准备"}</span><strong>{reportedType ? `投标作业轨已回传：${reportedType === "won" ? language.won : language.lost}` : "等待L2.9正式结果事实"}</strong></div><p>结果事实、主管决策和合同移交执行分开留痕。</p><Status>{gateStatus === "pending" ? "等待主管确认" : reportedType ? "来源汇总中" : "等待外部结果"}</Status></div>
    <div className="cw-result-state"><span>商业结果 <strong>Pending</strong></span><span>行政状态 <strong>{adminStatus}</strong></span><small>在G6批准前，外部结果通知不会直接改写SalesProject商业结果。</small></div>
    {!reportedType ? <><Panel kicker="BID RESULT" title="等待投标作业轨逐通路回传结果"><div className="cw-help"><strong>主系统不提供“模拟中标/丢标”按钮</strong><br />请在3010逐条处理L2.9结果跟踪任务。单条EPC结果不会直接改写项目结果；全部已提交通路齐备后系统自动汇总。{routeResultProgress && <span><br />通路结果进度 {routeResultProgress}｜{readiness?.resultAggregationStatus === "conflict" ? "多条中标结果冲突，需核实授标范围" : openResultTasks.length ? `${openResultTasks.length}项任务待处理` : "等待刷新"}</span>}</div></Panel>{readiness?.resultAggregationStatus === "conflict" && <Panel kicker="RESULT CONFLICT" title="多条中标通路核实" action={<Status tone="danger">G6已阻断</Status>}><p className="cw-footnote">这里不允许销售角色直接修改投标结果。销售Owner选择一条存疑记录并发起核实，投标作业责任人在3010引用原记录和新的正式证据形成更正版本；若复核后仍为多标段同时授标，则继续保持阻断，等待企业拆分规则。</p><div className="form-grid two"><label><span>待核实通路结果</span><select value={correctionResultId} onChange={event => setCorrectionResultId(event.target.value)}><option value="">请选择</option>{readiness.routeResults?.map(result => <option key={String(result.id)} value={String(result.id)}>{String(result.epc_customer ?? result.route_id)}｜{String(result.result_type)}｜{String(result.source_ref)}</option>)}</select></label><label><span>核实请求依据</span><input value={correctionEvidence} onChange={event => setCorrectionEvidence(event.target.value)} placeholder="客户通知、平台公告或投标作业核实单号" /></label><label><span>核实原因</span><textarea value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} /></label></div>{!manager ? <div className="cw-form-actions"><span>发起后将在3010生成结果核实任务，原结果不会被删除。</span><button className="cw-primary" disabled={!correctionResultId || !correctionReason.trim() || !correctionEvidence.trim() || openResultTasks.length > 0} onClick={() => onRequestResultCorrection(correctionResultId, correctionReason, correctionEvidence)}>发起结果核实</button></div> : <div className="cw-help">销售主管只能查看冲突和督办，不能代销售Owner发起、更不能代投标作业修改结果。</div>}</Panel>}</> : <div className="cw-grid cw-grid-main">
      <Panel kicker="G6 AUTO-AGGREGATED REVIEW" title={`G6结果与移交门｜${reportedType === "won" ? "赢单移交" : "未成交复盘"}`} className="cw-span-8" action={<Status>{gateStatus === "pending" ? "快照已冻结" : allReady ? "来源已齐套" : "存在来源缺口"}</Status>}>
        <p className="cw-footnote">销售Owner只准备复盘或核对系统自动形成的中标血缘；销售主管只作一次G6确认。合同接收是批准后的执行回执，不是第二次审批。</p>
        <div className="cw-source-fact-grid">{readiness?.items.map(item => <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : "来源缺失"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p><dl><div><dt>来源对象</dt><dd>{item.sourceType}</dd></div><div><dt>来源记录</dt><dd>{item.sourceRefs.join(" / ") || "—"}</dd></div></dl></article>)}</div>
        {!manager && reportedType !== "won" && !readiness?.lossTerminationReview && <div className="cw-form-actions"><span>先完成原因、证据、差距、行动、责任人和期限。</span><button className="cw-lose" onClick={onPrepareReview}>准备结构化复盘</button></div>}
        <div className="cw-form-actions"><span>本页只查看结果事实与移交/复盘材料；G6提交、退回和批准统一在“阶段门”页完成。</span><button className="cw-primary" onClick={onOpenGate}>进入G6阶段门处理</button></div>
      </Panel>
      <Panel kicker="CONTROL" title="G6不会混成两个审批" className="cw-span-4"><div className="cw-decision-impact"><strong>主管一次确认</strong><p>✓ 确认正式结果事实</p><p>✓ 确认赢单移交或未成交关闭分支</p><strong>批准后受控执行</strong><p>✓ 赢单：等待合同APP按哈希接收</p><p>✓ 未成交：结构化复盘完成后Closed</p><p>× 合同接收不再发起第二个Gate</p></div></Panel>
      <GateActivitySnapshotPanel snapshot={readiness?.activitySnapshot} />
    </div>}
  </div>;
  if (project.persisted && project.result === "terminated" && adminStatus !== "Closed") return <div className="cw-page"><div className="cw-page-actions"><div><span>TERMINATED｜G6 PENDING</span><h2>G5不投/不报已形成终止事实，尚未完成G6关闭</h2><p>终止不等于自动关闭；销售Owner仍需形成结构化复盘，主管一次确认后才Closed。</p></div><Status tone="danger">行政状态 {adminStatus}</Status></div><Panel kicker="G6 REVIEW" title="终止复盘与关闭条件"><div className="cw-source-fact-grid">{readiness?.items.map(item => <article className={item.ready ? "ready" : "missing"} key={item.key}><header><span>{item.owner}</span><Status>{item.ready ? "来源已就绪" : "来源缺失"}</Status></header><h3>{item.label}</h3><p>{item.summary}</p></article>)}</div>{!manager && !readiness?.lossTerminationReview && <button className="cw-lose" onClick={onPrepareReview}>准备结构化终止复盘</button>}<div className="cw-form-actions"><span>复盘完成后到阶段门页提交或审批G6。</span><button className="cw-primary" onClick={onOpenGate}>进入G6阶段门处理</button></div></Panel></div>;
  if (project.result === "pending") return <div className="cw-page"><div className={`cw-role-contract ${manager ? "manager" : "sales"}`}><div><span>{manager ? "结果确认" : "结果跟踪"}</span><strong>{manager ? `主管确认：${language.won} / ${language.lost}` : "销售员登记客户通知与证据"}</strong></div><p>{project.externalBid.receipt}</p><Status>{language.submitted}｜等待正式结果</Status></div><div className="cw-result-state"><span>商业结果 <strong>Pending</strong></span><span>行政状态 <strong>{adminStatus}</strong></span><small>商业结果、阶段与行政关闭分开记录。</small></div><Panel kicker="CUSTOMER RESULT" title="客户结果待确认"><div className="cw-result-choice"><div><i>✓</i><strong>{language.submitted}，正式版本已固化</strong><p>{project.externalBid.submissionHash}</p></div><p>{manager ? "确认结果后，赢单将生成不可覆盖的移交基线；未赢必须完成结构化复盘。" : "先登记客户通知及证据，再提交主管确认；销售员不能直接确认结果。"}</p><div>{manager ? <><button className="cw-win" onClick={onWin}>确认：{language.won}</button><button className="cw-lose" onClick={onLost}>确认：{language.lost}</button></> : <><button className="cw-win" onClick={() => onNotify("客户结果通知已登记为草稿，等待补充正式证据")}>登记客户通知</button><button className="cw-lose" onClick={() => onNotify("未赢复盘材料草稿已创建，结果仍需主管确认")}>准备复盘材料</button></>}</div></div></Panel></div>;
  if (project.result === "terminated") return <div className="cw-page"><div className="cw-page-actions"><div><span>TERMINATED｜G6 CLOSED</span><h2>项目已终止并完成行政关闭</h2><p>Terminated是经营决策形成的商业结果，不等同于Lost；G6已确认终止证据与结构化复盘。</p></div><Status tone="danger">行政状态 {adminStatus}</Status></div><div className="cw-grid cw-grid-main"><Panel kicker="TERMINATION REVIEW" title="终止复盘" className="cw-span-8"><dl className="cw-review"><div><dt>原因分类</dt><dd>{project.lostReview?.reason ?? "已在G5经营决策和G6冻结快照中留痕"}</dd></div><div><dt>关键差距</dt><dd>{project.lostReview?.gap ?? "—"}</dd></div><div><dt>终止证据</dt><dd>{project.lostReview?.evidence ?? "见G5与G6审计记录"}</dd></div><div><dt>改进行动</dt><dd>{project.lostReview?.improvement ?? "—"}</dd></div></dl></Panel><Panel kicker="CLOSE CONTROL" title="关闭结果" className="cw-span-4"><div className="cw-gap-list"><article><Status tone="success">已完成</Status><strong>G5不投/不报决策已留痕</strong></article><article><Status tone="success">已完成</Status><strong>结构化终止复盘已冻结</strong></article><article><Status tone="success">已完成</Status><strong>销售主管已确认G6关闭</strong></article></div></Panel></div></div>;
  if (project.result === "lost" && project.lostReview) return <div className="cw-page"><div className="cw-page-actions"><div><span>LOST REVIEW｜G6 CLOSED</span><h2>{language.lost}｜结构化复盘</h2><p>正式结果、原因、竞争对手、差距、证据和改进行动已由G6冻结并确认。</p></div>{!project.persisted && <button className="cw-secondary" onClick={onReset}>重置结果分支</button>}</div><div className="cw-result-state"><span>商业结果 <strong>Lost</strong></span><span>行政状态 <strong>{adminStatus}</strong></span><small>商业结果与行政关闭已分别留痕；持久化结果不可在页面重置。</small></div><div className="cw-grid cw-grid-main"><Panel kicker="ROOT CAUSE" title="复盘结论" className="cw-span-8"><dl className="cw-review"><div><dt>主要原因</dt><dd>{project.lostReview.reason}</dd></div><div><dt>竞争对手</dt><dd>{project.lostReview.competitor}</dd></div><div><dt>关键差距</dt><dd>{project.lostReview.gap}</dd></div><div><dt>结果证据</dt><dd>{project.lostReview.evidence}</dd></div><div><dt>改进行动</dt><dd>{project.lostReview.improvement}</dd></div></dl></Panel><Panel kicker="CLOSE CONTROL" title="关闭条件" className="cw-span-4"><div className="cw-gap-list"><article><Status tone="success">已完成</Status><strong>结构化原因已填写</strong></article><article><Status tone="success">已完成</Status><strong>结果证据已关联</strong></article><article><Status tone="success">已完成</Status><strong>改进行动、责任人和期限已冻结</strong></article><article><Status tone="success">已完成</Status><strong>销售主管已确认G6关闭</strong></article></div></Panel></div></div>;

  const baseline = project.baseline!;
  const manifest = [
    ["客户需求基线", baseline.requirementId, "已冻结"],
    ["技术方案", baseline.technicalId, "已冻结"],
    ["报价设计BOM", baseline.designBomId ?? "未提供", "已冻结"],
    ["核价方案", baseline.costingId, "已冻结"],
    ["价格授权", baseline.floorPriceId ?? "未提供", "已冻结"],
    ["最终投标/报价包", baseline.bidId, "已冻结"],
    ["正式对客提交", baseline.submissionId ?? "未提供", "已冻结"],
    ["客户结果通知", baseline.resultNoticeId ?? "未提供", "已冻结"],
  ];
  return <div className="cw-page">
    <div className="cw-page-actions"><div><span>WINNING BASELINE</span><h2>{language.won}｜授标基线包</h2><p>授标基线锁定正式对客承诺；合同专业作业由合同APP承担，S6仅跟踪下游只读事实。</p></div><div>{!project.persisted && manager && <button className="cw-secondary" onClick={onReset}>重置结果分支</button>}<button className="cw-secondary" onClick={() => onNotify("审计记录包含版本、审批、提交哈希、结果事实和合同接收回执")}>查看审计</button><button className="cw-primary" onClick={() => onNotify(baseline.transferStatus === "已接收" ? `合同APP已接收：${baseline.receiptRef ?? baseline.contractRef}` : contractTask ? `合同接收任务 ${contractTask.externalTaskId} 正在3010等待处理` : gateExecutionStatus === "executing" ? "合同接收任务执行中，请刷新查看" : "中标基线尚未满足合同接收条件")}>{baseline.transferStatus === "已接收" ? "查看合同接收回执" : "查看合同移交任务"}</button></div></div>
    <div className="cw-result-state"><span>商业结果 <strong>Won</strong></span><span>行政状态 <strong>{adminStatus}</strong></span><small>{project.stage === "S5" ? "G6已批准并生成中标基线；合同APP尚未接收，因此项目依法停留在S5。" : "合同APP已接收中标基线，项目进入S6成交后只读跟踪。"}</small></div>
    <div className="cw-kpis four">{[["客户结果", language.won, project.externalBid.receipt], ["结果基线", baseline.id, baseline.createdAt], ["项目金额", `${project.amount.toLocaleString()}万元`, ["EPC客户询价", "国内EPC询价", "海外伙伴/EPC询价"].includes(project.scenarioContext?.scenario ?? "") ? "多通路只计一次" : "SalesProject口径"], ["合同APP接收", baseline.transferStatus, baseline.receiptRef ?? baseline.contractRef]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="cw-grid cw-grid-main">
      <Panel kicker="IMMUTABLE PACKAGE" title={`中标基线包 ${baseline.id}`} className="cw-span-8" action={<Status>已生成｜只读</Status>}>
        <div className="cw-help compact">中标基线锁定正式对客承诺；组成对象沿用各自权威系统的原审批记录，本表只显示G6冻结引用，不伪造逐对象批准人或哈希。</div><div className="cw-data-table cw-manifest"><div className="head"><span>组成对象</span><span>版本 / 引用</span><span>基线状态</span><span>G6批准人 / 时间</span><span>基线证据</span><span>锁定</span></div>{manifest.map(row => <div key={row[0]}><span><strong>{row[0]}</strong></span><span>{row[1]}</span><span><Status>{row[2]}</Status></span><span>{baseline.approver} · {baseline.createdAt}</span><span>{baseline.manifestHash ?? "未提供"}</span><span>🔒</span></div>)}</div>
      </Panel>
      <div className="cw-span-4 cw-stack"><Panel kicker="CONTRACT APP" title="合同APP接收状态" action={<Status>{baseline.transferStatus}</Status>}><dl className="cw-impact"><div><dt>外部参考号</dt><dd>{baseline.contractRef}</dd></div><div><dt>基线生成时间</dt><dd>{baseline.createdAt}</dd></div><div><dt>销售Owner</dt><dd>{project.owner}</dd></div><div><dt>接收回执</dt><dd>{baseline.receiptRef ?? (baseline.transferStatus === "已接收" ? baseline.contractRef : "尚未回传")}</dd></div></dl><button className="cw-secondary full" onClick={() => onNotify("演示边界：打开合同APP；本APP不执行合同评审")}>打开合同APP（演示） ↗</button><p className="cw-footnote">移交责任人与检查结果将在合同APP真实回传后展示；当前不使用静态人员和模拟通过状态。</p></Panel></div>
      {project.stage === "S5" && <Panel kicker="CONTROLLED EXECUTION" title="等待合同APP接收中标基线" className="cw-span-12" action={<Status tone="warning">尚未进入S6</Status>}><div className="cw-help"><strong>这不是第二次审批，也不是流程卡死。</strong><br />G6决策已经完成；合同责任人需在3010核对中标基线哈希并回传接收凭证。回执一致后系统自动进入S6，销售员和主管均不能手工跳过。</div></Panel>}
      {project.stage === "S6" && <Panel kicker="READ ONLY" title="S6 赢单后商业事实跟踪" className="cw-span-12"><div className="cw-downstream">{downstreamOrder.map((type, index) => { const event = latestDownstreamByType.get(type); return <span key={type}><i>{index + 1}</i><strong>{downstreamLabels[type]}</strong><small>{event?.businessStatus ?? "尚未回传"}</small>{index < downstreamOrder.length - 1 && <b>→</b>}</span>; })}</div><p className="cw-footnote center">来自下游系统的只读权威事实，不在本APP修改。{project.downstreamEvents?.length ? ` 已接收 ${project.downstreamEvents.length} 条状态事件，最近事件：${project.downstreamEvents.at(-1)?.occurredAt}。` : " 当前尚无下游状态事件。"}</p></Panel>}
      {project.stage === "S6" && <Panel kicker="SALES RESPONSIBILITY" title="成交后销售遗留责任" className="cw-span-12" action={<div className="cw-inline-actions"><button className="cw-secondary" onClick={onManagePostAwardResponsibilities}>进入任务执行</button>{!manager && <button className="cw-primary" onClick={onAddPostAwardResponsibility}>登记遗留责任</button>}</div>}>
        {postAwardResponsibilities.length ? <div className="cw-data-table cw-post-award-list"><div className="head"><span>责任事项</span><span>责任目标</span><span>责任人</span><span>期限</span><span>状态</span><span>证据</span></div>{postAwardResponsibilities.map(item => <div key={item.id}><span><strong>{item.title}</strong><small>{item.id}</small></span><span>{item.purpose}</span><span>{item.owner}</span><span>{item.due}</span><span><Status tone={item.status === "已完成" ? "success" : item.status === "已延期" || item.status === "已阻塞" ? "danger" : undefined}>{item.status}</Status></span><span><strong>{item.result}</strong><small>{item.evidence}</small></span></div>)}</div> : <div className="cw-empty-state compact"><i>责</i><strong>尚无已登记的销售遗留责任</strong><p>这不表示下游工作已经完成。销售Owner应仅在存在需持续推动的客户承诺、合同差异、履约协调或开票回款事项时登记。</p></div>}
        <div className="cw-result-state"><span>G7 经营关闭门 <strong>受控未开放</strong></span><small>遗留责任清单与下游只读事实均不能单独推断经营关闭。企业关闭阈值、例外和重开规则未确认前，系统不提供人工通过G7的入口。</small></div>
      </Panel>}
    </div>
  </div>;
}
