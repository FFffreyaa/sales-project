"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  ArtifactVersion,
  DetailTab,
  glossary,
  initialProjects,
  LostReview,
  ProjectAction,
  ProjectStage,
  Relationship,
  Role,
  SalesProject,
  stageDefinitions,
  View,
} from "./demo-data";

const detailTabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "项目驾驶舱" },
  { id: "relations", label: "客户关系" },
  { id: "resources", label: "伙伴与资源" },
  { id: "actions", label: "活动与行动" },
  { id: "versions", label: "版本追溯" },
  { id: "gate", label: "阶段门" },
  { id: "result", label: "结果与移交" },
];

const stageMap = Object.fromEntries(stageDefinitions.map((stage) => [stage.code, stage]));

function money(value: number) {
  return `${value.toLocaleString("zh-CN")} 万元`;
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
  return <span className="term" tabIndex={0} data-tip={item?.[1] ?? "业务术语"}>{children}<span aria-hidden="true">?</span></span>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
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
  return <div className="progress-item"><div className="progress-ring" style={{ "--value": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><span>{value}</span></div><div><strong>{label}</strong><small>{value >= 80 ? "良好" : value >= 60 ? "需关注" : "存在缺口"}</small></div></div>;
}

function getGateConditions(project: SalesProject) {
  const hasTech = project.resources.some((item) => item.role === "技术负责人" && item.status === "已到位");
  const hasDecision = project.relationships.some((item) => item.layer === "商务决策链" && item.influence === "高");
  const pendingDeviation = project.deviations.some((item) => item.status === "待审批");
  const reviewRequired = project.versions.some((item) => item.status === "需要重新评审");
  const hasCosting = project.versions.some((item) => item.kind === "核价方案" && ["已批准", "生效", "已提交"].includes(item.status));
  const hasBid = project.versions.some((item) => item.kind === "投标方案" && !["草稿", "需要重新评审"].includes(item.status));

  if (project.stage === "S3") return [
    { label: "有效需求与技术方案可追溯", ok: !reviewRequired, hard: true, owner: "技术负责人" },
    { label: "核价方案已批准", ok: hasCosting, hard: true, owner: "核价评审组" },
    { label: "技术负责人已到位", ok: hasTech, hard: true, owner: "销售主管" },
    { label: "交期与盈利风险已有结论", ok: project.risks.every((risk) => risk.category !== "交期" || risk.status !== "开放"), hard: false, owner: "价格授权人" },
  ];
  if (project.stage === "S4") return [
    { label: "需求—技术—核价—投标版本有效", ok: !reviewRequired && hasBid, hard: true, owner: "技术/投标负责人" },
    { label: "所有方案偏差已获得授权", ok: !pendingDeviation, hard: true, owner: "价格授权人" },
    { label: "技术负责人已到位并接受责任", ok: hasTech, hard: true, owner: "销售主管" },
    { label: "客户关键商务决策人已覆盖", ok: hasDecision, hard: false, owner: "项目Owner" },
    { label: "外部投标APP提交包准备完成", ok: project.externalBid.status === "待提交" || project.externalBid.status === "已提交" || project.externalBid.status === "等待结果", hard: true, owner: project.externalBid.owner },
  ];
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

export default function DemoApp() {
  const [projects, setProjects] = useState<SalesProject[]>(initialProjects);
  const [role, setRole] = useState<Role>("sales");
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState("QJ-2026-0818");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [toast, setToast] = useState("");
  const [relationOpen, setRelationOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [submitBlockers, setSubmitBlockers] = useState<string[] | null>(null);
  const [actionSeed, setActionSeed] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("全部阶段");
  const [riskFilter, setRiskFilter] = useState("全部风险");
  const [ownerFilter, setOwnerFilter] = useState("全部负责人");
  const [listMode, setListMode] = useState<"table" | "card">("table");
  const [newStep, setNewStep] = useState(1);
  const [newProject, setNewProject] = useState({ intentType: "RFQ", evidence: "", customer: "", target: "", amount: "", bidDate: "", owner: "陈晨" });
  const [duplicateState, setDuplicateState] = useState<"idle" | "clear" | "found">("idle");

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const manager = role === "manager";

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const updateProject = (id: string, change: (project: SalesProject) => SalesProject) => {
    setProjects((current) => current.map((project) => project.id === id ? change(project) : project));
  };

  const openProject = (id: string, tab: DetailTab = "overview") => {
    setSelectedId(id);
    setDetailTab(tab);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetAll = () => {
    setProjects(initialProjects());
    setSelectedId("QJ-2026-0818");
    setDetailTab("overview");
    setView("dashboard");
    notify("演示数据已恢复到初始状态");
  };

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const textMatch = !query || [project.name, project.id, project.customer, project.target, project.owner].join(" ").toLowerCase().includes(query);
    return textMatch && (stageFilter === "全部阶段" || project.stage === stageFilter) && (riskFilter === "全部风险" || project.riskLevel === riskFilter) && (ownerFilter === "全部负责人" || project.owner === ownerFilter);
  }), [projects, search, stageFilter, riskFilter, ownerFilter]);

  const addRelationship = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const relation: Relationship = {
      id: `REL-${Date.now()}`,
      layer: String(data.get("layer")) as Relationship["layer"],
      name: String(data.get("name")),
      title: String(data.get("title")),
      attitude: String(data.get("attitude")) as Relationship["attitude"],
      influence: String(data.get("influence")) as Relationship["influence"],
      owner: String(data.get("owner")),
      evidence: String(data.get("evidence")),
      lastTouch: "2026-08-17",
    };
    updateProject(selected.id, (project) => ({ ...project, relationships: [...project.relationships, relation], health: { ...project.health, relationship: Math.min(100, project.health.relationship + (relation.layer === "商务决策链" ? 18 : 8)) } }));
    setRelationOpen(false);
    notify(`已新增客户关系：${relation.name}，关系覆盖已重新计算`);
  };

  const addAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const action: ProjectAction = {
      id: `ACT-${Date.now()}`,
      type: String(data.get("type")),
      title: String(data.get("title")),
      purpose: String(data.get("purpose")),
      owner: String(data.get("owner")),
      due: String(data.get("due")),
      status: "待开始",
      evidence: String(data.get("evidence")),
      result: "待执行",
    };
    updateProject(selected.id, (project) => ({ ...project, actions: [action, ...project.actions], risks: project.risks.map((risk) => risk.title === actionSeed ? { ...risk, status: "处理中" } : risk) }));
    setActionOpen(false);
    setActionSeed("");
    notify(`行动“${action.title}”已创建并指派给${action.owner}`);
  };

  const approveDeviation = (deviationId: string) => {
    if (!manager) { notify("请切换为销售主管后执行偏差审批"); return; }
    updateProject(selected.id, (project) => ({ ...project, deviations: project.deviations.map((item) => item.id === deviationId ? { ...item, status: "已批准" } : item), risks: project.risks.map((risk) => risk.evidence === deviationId ? { ...risk, status: "已关闭" } : risk) }));
    notify("偏差已批准；一致性和阶段门已重新计算，其他缺口仍保留");
  };

  const simulateChange = () => {
    updateProject(selected.id, (project) => {
      const next = project.changeCount + 1;
      const previousReq = project.versions.filter((item) => item.kind === "客户需求").at(-1);
      const newRequirement: ArtifactVersion = { id: `REQ-C${next + 1}.0`, kind: "客户需求", version: `V${next + 1}.0`, status: "生效", createdAt: "2026-08-17 11:20", creator: project.owner, approver: "客户项目负责人", basedOn: previousReq?.id ?? "客户变更函", summary: next === 2 ? "新增远程监测冗余与提前10天交付要求" : "客户新增能耗与监测要求" };
      return { ...project, changeCount: next, versions: [...project.versions.map((item) => item.kind === "客户需求" ? { ...item, status: "历史" as const } : { ...item, status: item.status === "已提交" ? item.status : "需要重新评审" as const }), newRequirement], riskLevel: "高", nextStep: "完成需求变更影响分析并重新发起技术与核价评审", risks: [{ id: `RSK-CHG-${next}`, level: "高", category: "方案", title: "新需求已生效，下游版本需要重新评审", owner: "赵工", due: "2026-08-20", status: "开放", evidence: newRequirement.id }, ...project.risks] };
    });
    notify("已创建新需求版本；技术、核价和投标版本均标记为需要重新评审");
  };

  const trySubmit = () => {
    const blockers: string[] = [];
    if (selected.deviations.some((item) => item.status === "待审批")) blockers.push("存在未批准方案偏差");
    if (selected.versions.some((item) => item.status === "需要重新评审")) blockers.push("存在需要重新评审的下游版本");
    if (!selected.resources.some((item) => item.role === "技术负责人" && item.status === "已到位")) blockers.push("技术负责人未到位");
    if (!selected.relationships.some((item) => item.layer === "商务决策链" && item.influence === "高")) blockers.push("客户关键商务决策人未覆盖");
    const bidVersion = selected.versions.find((item) => item.kind === "投标方案");
    if (!bidVersion) blockers.push("投标方案版本不存在");
    setSubmitBlockers(blockers);
    if (blockers.length === 0) {
      updateProject(selected.id, (project) => ({ ...project, stage: "S5", stageName: "结果与移交", versions: project.versions.map((item) => item.kind === "投标方案" ? { ...item, status: "已提交", immutable: true } : item), externalBid: { ...project.externalBid, status: "等待结果", updatedAt: "2026-08-17 11:35", submissionHash: "SHA256 6BC8…E921", receipt: "客户回执 DEMO-RCPT-001" } }));
      notify("正式提交已模拟完成，提交版本已固化且不可覆盖");
    }
  };

  const advanceStage = () => {
    if (!manager) { notify("阶段推进需由销售主管操作"); return; }
    const blockers = getGateConditions(selected).filter((item) => item.hard && !item.ok);
    if (blockers.length) { notify(`仍有${blockers.length}个硬阻断项，暂不能推进阶段`); return; }
    const index = stageDefinitions.findIndex((item) => item.code === selected.stage);
    const next = stageDefinitions[Math.min(index + 1, stageDefinitions.length - 1)];
    updateProject(selected.id, (project) => ({ ...project, stage: next.code as ProjectStage, stageName: next.name }));
    notify(`主管已批准推进至 ${next.code} ${next.name}`);
  };

  const simulateWin = () => {
    if (!manager) { notify("请切换为销售主管确认项目结果"); return; }
    const req = selected.versions.filter((item) => item.kind === "客户需求").at(-1)?.id ?? "—";
    const tech = selected.versions.filter((item) => item.kind === "技术方案").at(-1)?.id ?? "—";
    const cost = selected.versions.filter((item) => item.kind === "核价方案").at(-1)?.id ?? "—";
    const bid = selected.versions.filter((item) => item.kind === "投标方案").at(-1)?.id ?? "—";
    updateProject(selected.id, (project) => ({ ...project, result: "won", stage: "S6", stageName: "赢单后跟踪", probability: 100, baseline: { id: `WB-${project.id}`, createdAt: "2026-08-17 11:45", approver: "周主管", requirementId: req, technicalId: tech, costingId: cost, bidId: bid, transferStatus: "已接收", contractRef: "CONTRACT-DEMO-2026-018" }, nextStep: "跟踪合同签署与订单转化（只读）" }));
    notify("已确认中标并生成不可覆盖的中标移交基线");
  };

  const submitLost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manager) { notify("请切换为销售主管确认项目结果"); return; }
    const data = new FormData(event.currentTarget);
    const review: LostReview = { reason: String(data.get("reason")), competitor: String(data.get("competitor")), gap: String(data.get("gap")), evidence: String(data.get("evidence")), improvement: String(data.get("improvement")) };
    updateProject(selected.id, (project) => ({ ...project, result: "lost", lostReview: review, probability: 0, nextStep: "主管确认复盘并形成改进行动" }));
    setLostOpen(false);
    notify("丢标结果和结构化复盘已保存，可进入行政关闭确认");
  };

  const resetResult = () => {
    const original = initialProjects().find((item) => item.id === selected.id);
    if (original) updateProject(selected.id, () => original);
    notify("当前项目结果已重置，可回放另一结果分支");
  };

  const renderDashboard = () => {
    const major = projects.filter((project) => project.riskLevel === "重大" || project.riskLevel === "高");
    const approvals = projects.reduce((sum, project) => sum + project.deviations.filter((item) => item.status === "待审批").length, 0) + projects.filter((project) => project.stage === "S3").length;
    return <>
      <div className="page-title"><div><span className="eyebrow">销售项目工作台</span><h1>{manager ? "主管决策与项目组合" : "今天先处理这几件事"}</h1><p>{manager ? "关注资源冲突、阶段阻断和需要你决策的事项。" : "围绕交标时间、关系缺口和当前阶段输出推进项目。"}</p></div><button className="primary" onClick={() => setView("new")}>＋ 新建销售项目</button></div>
      <section className="priority-strip"><div><span className="priority-icon">!</span><div><strong>{manager ? `${approvals} 项需要主管决策` : "高风险项目距交标仅 2 天"}</strong><p>{manager ? "1项偏差审批、1项核价阶段门及资源协调待处理" : "西南新能源项目：技术负责人缺失、商务决策链未覆盖"}</p></div></div><button onClick={() => openProject("QJ-2026-0818", manager ? "gate" : "overview")}>{manager ? "进入决策中心" : "立即处理"} →</button></section>
      <div className="metric-grid">
        <article className="metric-card"><span>在管项目</span><strong>{projects.length}</strong><small>预计金额 {money(projects.reduce((sum, item) => sum + item.amount, 0))}</small></article>
        <article className="metric-card danger-line"><span>高风险 / 重大</span><strong>{major.length}</strong><small>其中 1 项进入交标红区</small></article>
        <article className="metric-card"><span>{manager ? "待决策" : "我的待办"}</span><strong>{manager ? approvals : 6}</strong><small>{manager ? "偏差、资源和阶段门" : "今日到期 3 项"}</small></article>
        <article className="metric-card"><span>未来 7 天交标</span><strong>{projects.filter((item) => item.countdown >= 0 && item.countdown <= 7).length}</strong><small>最近交标还有 2 天</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">项目优先队列</span><h2>{manager ? "需要决策与纠偏" : "接下来要做什么"}</h2></div><button className="text-button" onClick={() => setView("projects")}>查看全部项目</button></div>
          <div className="work-list">{projects.map((project) => <button className="work-row" key={project.id} onClick={() => openProject(project.id)}><span className={`risk-bar risk-${project.riskLevel}`} /><div className="work-main"><div><strong>{project.name}</strong><Badge>{project.riskLevel}风险</Badge></div><p>{project.nextStep}</p></div><div className="work-meta"><span>{project.stage} {project.stageName}</span><strong className={project.countdown <= 2 ? "danger-text" : ""}>{project.countdown < 0 ? "已交标" : `${project.countdown}天后交标`}</strong></div><span className="row-arrow">›</span></button>)}</div>
        </section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">阶段分布</span><h2>项目漏斗</h2></div></div><div className="stage-bars">{stageDefinitions.map((stage) => { const count = projects.filter((project) => project.stage === stage.code).length; return <div key={stage.code}><span>{stage.code} {stage.name}</span><div><i style={{ width: `${Math.max(4, count * 24)}%` }} /></div><strong>{count}</strong></div>; })}</div></section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">风险聚焦</span><h2>当前主要缺口</h2></div></div><div className="risk-summary"><button onClick={() => openProject("QJ-2026-0818", "resources")}><span>01</span><div><strong>关键资源</strong><p>技术负责人未到位</p></div></button><button onClick={() => openProject("QJ-2026-0818", "relations")}><span>02</span><div><strong>客户关系</strong><p>商务决策链缺口</p></div></button><button onClick={() => openProject("QJ-2026-0819", "versions")}><span>03</span><div><strong>版本一致性</strong><p>需求变更待重评</p></div></button></div></section>
        <section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">双线协同</span><h2>主动运作与投标协同</h2></div></div><div className="dual-lane"><div><span className="lane-label active">主动运作线</span>{["关系覆盖", "伙伴验证", "赢单策略", "关键资源", "风险行动"].map((item, index) => <span className="lane-node" key={item}><i>{index + 1}</i>{item}</span>)}</div><div><span className="lane-label external">投标协同线</span>{["需求澄清", "技术方案", "核价结果", "定价授权", "提交回执"].map((item, index) => <span className="lane-node external-node" key={item}><i>{index + 1}</i>{item}</span>)}</div><p>投标文件具体编制在投标管理APP完成；本Demo只管理状态、关键结果、版本和引用。</p></div></section>
      </div>
    </>;
  };

  const renderProjects = () => <>
    <div className="page-title"><div><span className="eyebrow">项目组合</span><h1>销售项目列表</h1><p>按当前阶段、负责人和风险筛选，阶段不等于任务状态。</p></div><button className="primary" onClick={() => setView("new")}>＋ 新建项目</button></div>
    <section className="panel filter-panel"><div className="search-box"><span>⌕</span><input aria-label="搜索项目" placeholder="搜索项目编号、客户、标的或负责人" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}><option>全部阶段</option>{stageDefinitions.map((stage) => <option key={stage.code} value={stage.code}>{stage.code} {stage.name}</option>)}</select><select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option>全部负责人</option>{[...new Set(projects.map((item) => item.owner))].map((owner) => <option key={owner}>{owner}</option>)}</select><select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option>全部风险</option><option>重大</option><option>高</option><option>中</option><option>低</option></select><div className="view-toggle"><button className={listMode === "table" ? "active" : ""} onClick={() => setListMode("table")}>表格</button><button className={listMode === "card" ? "active" : ""} onClick={() => setListMode("card")}>卡片</button></div></section>
    <div className="result-count">共 {filteredProjects.length} 个项目 <span>· 模拟数据截至 2026-08-17</span></div>
    {listMode === "table" ? <section className="panel table-wrap"><table><thead><tr><th>项目</th><th>阶段</th><th>Owner</th><th>预计金额</th><th>健康度</th><th>风险</th><th>交标</th><th /></tr></thead><tbody>{filteredProjects.map((project) => <tr key={project.id} onClick={() => openProject(project.id)}><td><strong>{project.name}</strong><small>{project.id} · {project.customer}</small></td><td><span className="stage-pill">{project.stage}</span>{project.stageName}</td><td>{project.owner}</td><td>{money(project.amount)}</td><td><div className="mini-health"><i style={{ width: `${Math.round((project.health.relationship + project.health.resource + project.health.operation) / 3)}%` }} /></div><small>{Math.round((project.health.relationship + project.health.resource + project.health.operation) / 3)} 分</small></td><td><Badge>{project.riskLevel}</Badge></td><td><strong className={project.countdown <= 2 && project.countdown >= 0 ? "danger-text" : ""}>{project.countdown < 0 ? "已交标" : `${project.countdown}天`}</strong><small>{project.bidDate}</small></td><td><button className="row-button">进入 ›</button></td></tr>)}</tbody></table></section> : <div className="project-cards">{filteredProjects.map((project) => <button className="project-card" key={project.id} onClick={() => openProject(project.id)}><div className="project-card-top"><span>{project.id}</span><Badge>{project.riskLevel}风险</Badge></div><h3>{project.name}</h3><p>{project.customer}</p><div className="project-card-stage"><span>{project.stage}</span><div><strong>{project.stageName}</strong><small>{project.nextStep}</small></div></div><div className="project-card-foot"><span>{project.owner}</span><strong>{money(project.amount)}</strong><span className={project.countdown <= 2 && project.countdown >= 0 ? "danger-text" : ""}>{project.countdown < 0 ? "已交标" : `${project.countdown}天后交标`}</span></div></button>)}</div>}
  </>;

  const renderNew = () => {
    const createProject = () => {
      if (!newProject.customer || !newProject.target || !newProject.evidence || !newProject.amount || !newProject.bidDate) { notify("请完成所有必填信息后再提交"); return; }
      if (duplicateState !== "clear") { notify("请先完成重复项目检查"); return; }
      const id = `QJ-2026-${String(820 + projects.length).padStart(4, "0")}`;
      const base = initialProjects()[0];
      const created: SalesProject = { ...base, id, name: `${newProject.customer}${newProject.target}项目`, customer: newProject.customer, target: newProject.target, intentType: newProject.intentType, evidence: newProject.evidence, amount: Number(newProject.amount), bidDate: newProject.bidDate, owner: newProject.owner, stage: "S0", stageName: "待立项", riskLevel: "中", probability: 20, countdown: 15, health: { relationship: 0, resource: 25, operation: 0 }, relationships: [], resources: [{ id: `RES-${Date.now()}`, role: "销售Owner", person: newProject.owner, status: "已到位", required: true, due: "2026-08-17" }], actions: [], risks: [], versions: [], deviations: [], externalBid: { id: "待创建", status: "未启动", owner: "待指派", updatedAt: "—", submissionHash: "—", receipt: "—" }, nextStep: "等待销售主管审核立项并配置资源", result: "pending", changeCount: 0 };
      setProjects((current) => [created, ...current]);
      openProject(id, "gate");
      notify("演示项目已创建，当前处于 S0 待立项");
    };
    return <><div className="page-title"><div><span className="eyebrow">采购意向确认</span><h1>项目立项向导</h1><p>明确采购意向是销售项目正式起点；模拟创建不会连接客户或审批系统。</p></div></div><div className="wizard-shell"><aside className="wizard-steps">{[[1, "采购意向"], [2, "客户与标的"], [3, "Owner与提交"]].map(([step, label]) => <button key={step} className={newStep === step ? "active" : newStep > Number(step) ? "done" : ""} onClick={() => setNewStep(Number(step))}><i>{newStep > Number(step) ? "✓" : step}</i><span>{label}</span></button>)}</aside><section className="panel wizard-panel">
      {newStep === 1 && <><div className="panel-head"><div><span className="eyebrow">步骤 1 / 3</span><h2>采购意向及证据</h2></div></div><div className="form-grid"><Field label="采购意向类型"><select value={newProject.intentType} onChange={(e) => setNewProject({ ...newProject, intentType: e.target.value })}>{["标书", "RFQ", "明确需求", "直接谈判", "渠道机会", "增购"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="采购意向证据" hint="演示中记录证据名称；不上传真实文件。"><input value={newProject.evidence} onChange={(e) => setNewProject({ ...newProject, evidence: e.target.value })} placeholder="如：客户RFQ编号、邮件或确认函" /></Field></div><div className="form-actions"><span /><button className="primary" onClick={() => newProject.evidence ? setNewStep(2) : notify("请先填写采购意向证据")}>下一步</button></div></>}
      {newStep === 2 && <><div className="panel-head"><div><span className="eyebrow">步骤 2 / 3</span><h2>客户与拟交易标的</h2></div></div><div className="form-grid two"><Field label="客户"><input value={newProject.customer} onChange={(e) => { setNewProject({ ...newProject, customer: e.target.value }); setDuplicateState("idle"); }} placeholder="客户采购主体" /></Field><Field label="产品或标的"><input value={newProject.target} onChange={(e) => { setNewProject({ ...newProject, target: e.target.value }); setDuplicateState("idle"); }} placeholder="产品、型号、数量或范围" /></Field><Field label="预计金额（万元）"><input type="number" value={newProject.amount} onChange={(e) => setNewProject({ ...newProject, amount: e.target.value })} placeholder="0" /></Field><Field label="客户交标日期"><input type="date" value={newProject.bidDate} onChange={(e) => setNewProject({ ...newProject, bidDate: e.target.value })} /></Field></div><div className={`duplicate-box ${duplicateState}`}><div><strong>重复项目检查</strong><p>{duplicateState === "clear" ? "未发现同一客户、同一采购事件的在管项目。" : duplicateState === "found" ? "发现相似项目，请核对后避免重复立项。" : "填写客户与标的后执行检查。"}</p></div><button className="secondary" onClick={() => { if (!newProject.customer || !newProject.target) return notify("请先填写客户和标的"); const found = projects.some((item) => item.customer === newProject.customer && item.target.includes(newProject.target)); setDuplicateState(found ? "found" : "clear"); }}>执行检查</button></div><div className="form-actions"><button className="secondary" onClick={() => setNewStep(1)}>上一步</button><button className="primary" onClick={() => duplicateState === "clear" ? setNewStep(3) : notify("请先完成重复项目检查")}>下一步</button></div></>}
      {newStep === 3 && <><div className="panel-head"><div><span className="eyebrow">步骤 3 / 3</span><h2>Owner与模拟提交</h2></div></div><div className="form-grid two"><Field label="项目Owner"><select value={newProject.owner} onChange={(e) => setNewProject({ ...newProject, owner: e.target.value })}><option>陈晨</option><option>林涛</option><option>孙倩</option></select></Field><Field label="技术负责人"><input value="待主管配置" disabled /></Field></div><div className="review-card"><h3>立项摘要</h3><dl><div><dt>采购意向</dt><dd>{newProject.intentType}</dd></div><div><dt>客户</dt><dd>{newProject.customer || "—"}</dd></div><div><dt>标的</dt><dd>{newProject.target || "—"}</dd></div><div><dt>预计金额</dt><dd>{newProject.amount ? `${newProject.amount}万元` : "—"}</dd></div><div><dt>交标日期</dt><dd>{newProject.bidDate || "—"}</dd></div><div><dt>重复检查</dt><dd><Badge>{duplicateState === "clear" ? "已通过" : "未通过"}</Badge></dd></div></dl></div><div className="demo-boundary">演示边界：提交后直接创建 S0 项目，不触发真实客户建档、登录或审批。</div><div className="form-actions"><button className="secondary" onClick={() => setNewStep(2)}>上一步</button><button className="primary" onClick={createProject}>提交立项申请</button></div></>}
      </section></div></>;
  };

  const renderStageRail = () => {
    const activeIndex = stageDefinitions.findIndex((item) => item.code === selected.stage);
    return <div className="stage-rail">{stageDefinitions.map((stage, index) => <button key={stage.code} className={`${index < activeIndex ? "complete" : ""} ${index === activeIndex ? "current" : ""}`} onClick={() => notify(`${stage.code} ${stage.name}：${stage.output}`)}><i>{index < activeIndex ? "✓" : stage.code}</i><span>{stage.name}</span></button>)}</div>;
  };

  const renderOverview = () => <div className="detail-grid"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">当前阶段</span><h2>{selected.stage} {selected.stageName}</h2></div><button className="secondary" onClick={() => setDetailTab("gate")}>查看阶段门 →</button></div><div className="stage-brief"><div><span>进入条件</span><strong>{selected.stage === "S4" ? "核价方案已批准" : selected.stage === "S3" ? "需求基线可核价" : "上一阶段批准完成"}</strong></div><div><span>核心输出</span><strong>{stageMap[selected.stage]?.output}</strong></div><div><span>Owner / 审批人</span><strong>{selected.owner} / {selected.approver}</strong></div><div><span>能否推进</span><Badge>{getGateConditions(selected).some((item) => item.hard && !item.ok) ? "存在阻断" : "允许推进"}</Badge></div></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">健康度</span><h2>当前阶段三角评估</h2></div></div><div className="health-stack"><Progress value={selected.health.relationship} label="客户关系" /><Progress value={selected.health.resource} label="关键资源" /><Progress value={selected.health.operation} label="项目运作" /></div><p className="rule-note">任一维度低于 60，项目进入重大运作风险。</p></section><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">主动运作</span><h2>当前缺口 → 动作 → 责任 → 证据</h2></div></div><div className="closure-table"><div className="closure-head"><span>当前缺口</span><span>计划动作</span><span>责任与期限</span><span>结果证据</span></div>{selected.risks.slice(0, 3).map((risk, index) => { const action = selected.actions[index]; return <div key={risk.id}><span><Badge>{risk.level}</Badge><strong>{risk.title}</strong></span><span>{action?.title ?? "尚未形成行动"}</span><span>{action ? `${action.owner} · ${action.due}` : `${risk.owner} · ${risk.due}`}</span><span>{action?.evidence || risk.evidence}</span></div>; })}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">赢单判断</span><h2>策略与竞争</h2></div></div><div className="strategy-block"><span>赢单策略</span><p>{selected.strategy}</p><span>竞争态势</span><p>{selected.competition}</p><span>赢单概率</span><div className="probability"><i style={{ width: `${selected.probability}%` }} /><strong>{selected.probability}%</strong></div></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">下一步</span><h2>首要行动</h2></div></div><div className="next-action"><span>01</span><strong>{selected.nextStep}</strong><small>责任人：{selected.owner}</small><button className="secondary" onClick={() => setDetailTab("actions")}>进入行动计划</button></div></section><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">投标协同</span><h2>外部投标管理APP引用</h2></div><Badge>{selected.externalBid.status}</Badge></div><div className="external-ref"><div><span>协同任务</span><strong>{selected.externalBid.id}</strong></div><div><span>负责人</span><strong>{selected.externalBid.owner}</strong></div><div><span>最近同步</span><strong>{selected.externalBid.updatedAt}</strong></div><div><span>正式提交哈希</span><strong>{selected.externalBid.submissionHash}</strong></div><button className="secondary" onClick={() => notify("演示边界：这里将跳转投标管理APP；本Demo不展开标书文件编制作业")}>打开投标管理APP ↗</button></div></section></div>;

  const renderRelations = () => {
    const layers: Relationship["layer"][] = ["客户高层", "商务决策链", "技术层"];
    return <><div className="section-actions"><div><span className="eyebrow">客户关系地图</span><h2>决策链覆盖与关系证据</h2><p>态度和影响力必须有证据，覆盖人员对关系推进负责。</p></div><button className="primary" onClick={() => setRelationOpen(true)}>＋ 新增关系记录</button></div><div className="relation-gap"><strong>关系缺口检查</strong><div>{layers.map((layer) => { const covered = selected.relationships.some((item) => item.layer === layer); return <span key={layer} className={covered ? "ok" : "gap"}>{covered ? "✓" : "!"} {layer}：{covered ? "已覆盖" : "未覆盖"}</span>; })}</div></div><div className="relation-columns">{layers.map((layer) => <section className="relation-column" key={layer}><div className="relation-column-head"><span>{layer === "客户高层" ? "60%" : "20%"}</span><h3>{layer}</h3><small>{layer === "客户高层" ? "战略支持与资源决策" : layer === "商务决策链" ? "采购、价格与最终评标" : "参数、方案与技术评分"}</small></div>{selected.relationships.filter((item) => item.layer === layer).map((relation) => <article className="contact-card" key={relation.id}><div className="avatar">{relation.name.slice(-1)}</div><div className="contact-main"><div><strong>{relation.name}</strong><Badge>{relation.attitude}</Badge></div><p>{relation.title} · 影响力{relation.influence}</p><dl><div><dt>覆盖负责人</dt><dd>{relation.owner}</dd></div><div><dt>最近接触</dt><dd>{relation.lastTouch}</dd></div></dl><div className="evidence"><span>证据</span>{relation.evidence}</div></div></article>)}{!selected.relationships.some((item) => item.layer === layer) && <Empty title="尚未覆盖" description="新增有证据的客户关系，补齐当前阶段缺口。" />}</section>)}</div></>;
  };

  const renderResources = () => <><div className="section-actions"><div><span className="eyebrow">伙伴与资源准备</span><h2>指派不等于到位</h2><p>只有负责人接受项目责任并有有效期记录，才视为资源已到位。</p></div><button className="secondary" onClick={() => notify(manager ? "资源协调任务已生成并模拟下发" : "资源申请已提交给销售主管")}>{manager ? "发起资源协调" : "申请关键资源"}</button></div><div className="resource-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">内部资源</span><h2>当前阶段必需角色</h2></div><span>{selected.resources.filter((item) => item.status === "已到位").length}/{selected.resources.length} 已到位</span></div><div className="resource-cards">{selected.resources.map((resource) => <article key={resource.id} className={resource.status === "缺失" ? "resource-card missing" : "resource-card"}><div><span className="resource-icon">{resource.status === "已到位" ? "✓" : "!"}</span><div><strong>{resource.role}</strong><small>{resource.required ? "当前阶段必需" : "按需"}</small></div></div><h3>{resource.person}</h3><div><Badge>{resource.status}</Badge><span>要求到位 {resource.due}</span></div>{manager && resource.status !== "已到位" && <button onClick={() => { updateProject(selected.id, (project) => ({ ...project, resources: project.resources.map((item) => item.id === resource.id ? { ...item, person: resource.role === "技术负责人" ? "赵工" : item.person, status: "已到位" } : item), health: { ...project.health, resource: Math.min(100, project.health.resource + 25) } })); notify(`${resource.role}已模拟到位，阶段门已更新`); }}>模拟指派并接受</button>}</article>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">合作伙伴</span><h2>{selected.partner.needed ? "需要伙伴" : "本项目不需要伙伴"}</h2></div><Badge>{selected.partner.match}</Badge></div>{selected.partner.needed ? <div className="partner-card"><div><span>伙伴类型</span><strong>{selected.partner.type}</strong></div><div><span>候选伙伴</span><strong>{selected.partner.name}</strong></div><div><span>匹配 / 认证</span><strong>{selected.partner.match} · {selected.partner.certification}</strong></div><div><span>关系证据</span><p>{selected.partner.evidence}</p></div><div><span>实际贡献</span><p>{selected.partner.contribution}</p></div>{selected.partner.match !== "已验证" && <button className="secondary" onClick={() => notify("已生成伙伴关系验证任务；自述认识客户不能视为到位")}>发起关系验证</button>}</div> : <div className="partner-card"><p>直销项目，客户采购主体和内部资源明确。伙伴不作为本阶段必需条件。</p></div>}</section></div></>;

  const renderActions = () => <><div className="section-actions"><div><span className="eyebrow">活动与行动计划</span><h2>风险必须转化为责任行动</h2><p>每项行动包含目的、负责人、截止时间、结论和证据。</p></div><button className="primary" onClick={() => { setActionSeed(""); setActionOpen(true); }}>＋ 新增项目行动</button></div><section className="panel"><div className="panel-head"><div><span className="eyebrow">风险台账</span><h2>开放风险与处理闭环</h2></div></div><div className="risk-list">{selected.risks.map((risk) => <article key={risk.id}><Badge>{risk.level}</Badge><div><strong>{risk.title}</strong><p>{risk.category} · 证据：{risk.evidence}</p></div><div><span>{risk.owner}</span><small>{risk.due}</small></div><Badge>{risk.status}</Badge><button className="secondary compact" onClick={() => { setActionSeed(risk.title); setActionOpen(true); }}>转为行动</button></article>)}</div></section><section className="panel table-wrap"><div className="panel-head"><div><span className="eyebrow">行动计划</span><h2>活动执行与证据</h2></div></div><table><thead><tr><th>行动</th><th>目的</th><th>负责人</th><th>截止</th><th>状态</th><th>结论 / 证据</th></tr></thead><tbody>{selected.actions.map((action) => <tr key={action.id}><td><strong>{action.title}</strong><small>{action.type} · {action.id}</small></td><td>{action.purpose}</td><td>{action.owner}</td><td className={action.status === "已延期" ? "danger-text" : ""}>{action.due}</td><td><Badge>{action.status}</Badge></td><td><strong>{action.result}</strong><small>{action.evidence}</small></td></tr>)}</tbody></table></section></>;

  const renderVersions = () => {
    const order = ["客户需求", "技术方案", "核价方案", "投标方案"];
    const currentVersions = order.map((kind) => selected.versions.filter((item) => item.kind === kind).at(-1)).filter(Boolean) as ArtifactVersion[];
    return <><div className="section-actions"><div><span className="eyebrow">标的物版本主线</span><h2>客户要什么 → 按什么核价 → 最终承诺什么</h2><p>一致性不要求文档完全相同，而要求差异可识别、评估、审批和追溯。</p></div><div className="button-row">{selected.id === "QJ-2026-0819" && <button className="secondary" onClick={simulateChange}>模拟再次需求变更</button>}<button className="primary" onClick={trySubmit}>模拟正式提交</button></div></div><div className="version-chain">{currentVersions.map((version, index) => <div className={`version-node ${statusTone(version.status)}`} key={version.id}><div className="node-index">0{index + 1}</div><span>{version.kind}</span><strong>{version.version}</strong><Badge>{version.status}</Badge><small>{version.id}</small>{index < currentVersions.length - 1 && <i className="chain-arrow">→</i>}</div>)}<div className="version-node baseline-node"><div className="node-index">05</div><span>中标基线</span><strong>{selected.baseline?.id ?? "待生成"}</strong><Badge>{selected.baseline ? "已固化" : "未形成"}</Badge><small>{selected.baseline?.contractRef ?? "合同/订单待引用"}</small></div></div><div className="version-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">追溯矩阵</span><h2>当前生效链与一致性</h2></div><Badge>{selected.versions.some((item) => item.status === "需要重新评审") ? "需要重新评审" : selected.deviations.some((item) => item.status === "待审批") ? "存在未批准偏差" : "一致或偏差已授权"}</Badge></div><div className="trace-matrix"><div className="trace-head"><span>比较项</span><span>客户需求</span><span>技术方案</span><span>核价方案</span><span>投标方案</span><span>结论</span></div>{[["型号与范围", "主变+成套", "逐项覆盖", "成本已计入", "正式响应", "一致"], ["数量", "1批", "配置清单", "完整计价", "完整报价", "一致"], ["交付周期", "150天", "技术可行", "储备165天", "承诺165天", selected.deviations.some((item) => item.status === "待审批") ? "待授权" : "已授权"], ["需求变更", `第${selected.changeCount}次`, "影响检查", "影响检查", "影响检查", selected.versions.some((item) => item.status === "需要重新评审") ? "需重评" : "已关闭"]].map((row) => <div key={row[0]}>{row.map((cell, i) => <span key={i}>{i === 5 ? <Badge>{cell}</Badge> : cell}</span>)}</div>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">偏差清单</span><h2>{selected.deviations.length} 项偏差</h2></div></div>{selected.deviations.length ? <div className="deviation-list">{selected.deviations.map((deviation) => <article key={deviation.id}><div><strong>{deviation.id} · {deviation.field}</strong><Badge>{deviation.status}</Badge></div><p><span>需求</span>{deviation.requirement}</p><p><span>方案</span>{deviation.proposal}</p><p><span>影响</span>{deviation.impact}</p><small>审批人：{deviation.approver}</small>{deviation.status === "待审批" && <button className="primary compact" onClick={() => approveDeviation(deviation.id)}>{manager ? "批准偏差" : "查看审批要求"}</button>}</article>)}</div> : <Empty title="无开放偏差" description="当前版本之间未发现需要授权的差异。" />}</section><section className="panel span-3"><div className="panel-head"><div><span className="eyebrow">版本时间线</span><h2>历史版本不可覆盖</h2></div></div><div className="timeline">{[...selected.versions].reverse().map((version) => <article key={version.id}><i /><div><div><strong>{version.kind} {version.version}</strong><Badge>{version.status}</Badge>{version.immutable && <Badge tone="neutral">已锁定</Badge>}</div><p>{version.summary}</p><small>{version.createdAt} · 创建：{version.creator} · 批准：{version.approver}</small><span>上游来源：{version.basedOn}</span></div></article>)}</div></section></div></>;
  };

  const renderGate = () => {
    const conditions = getGateConditions(selected);
    const blockers = conditions.filter((item) => !item.ok);
    return <><div className="section-actions"><div><span className="eyebrow">阶段门检查</span><h2>{selected.stage} {selected.stageName} → 下一阶段</h2><p>阶段是管理标签；检查当前阶段输出、任务、风险、负责人和批准责任。</p></div><Badge>{blockers.length ? `${blockers.length}项未满足` : "全部满足"}</Badge></div><div className="gate-layout"><section className="panel span-2"><div className="gate-summary"><div><span>进入条件</span><strong>{selected.stage === "S4" ? "核价评审已通过" : "上一阶段批准完成"}</strong></div><div><span>核心输出</span><strong>{stageMap[selected.stage]?.output}</strong></div><div><span>审批人</span><strong>{selected.approver}</strong></div><div><span>推进结论</span><Badge>{blockers.some((item) => item.hard) ? "禁止推进" : blockers.length ? "可申请例外" : "允许推进"}</Badge></div></div><div className="condition-list">{conditions.map((condition, index) => <article key={condition.label} className={condition.ok ? "ok" : "blocked"}><i>{condition.ok ? "✓" : "!"}</i><div><strong>{condition.label}</strong><small>{condition.hard ? "硬校验" : "管理要求"} · 责任人：{condition.owner}</small></div><Badge>{condition.ok ? "已满足" : "未满足"}</Badge></article>)}</div><div className="gate-actions"><button className="secondary" onClick={() => notify(manager ? "项目已模拟退回当前阶段Owner补充材料" : "已查看退回条件")}>退回补充</button><button className="secondary" onClick={() => notify("例外审批申请已生成；Demo不执行真实审批流")}>申请例外</button><button className="danger-button" onClick={() => notify("终止操作需要原因和主管确认；Demo未改变项目状态")}>终止项目</button><button className="primary" onClick={advanceStage}>{manager ? "批准推进下一阶段" : "提交主管审批"}</button></div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">阶段责任</span><h2>未完成任务与风险</h2></div></div><div className="gate-side"><div><span>未完成任务</span><strong>{selected.actions.filter((item) => item.status !== "已完成").length}</strong></div><div><span>开放风险</span><strong>{selected.risks.filter((item) => item.status !== "已关闭").length}</strong></div><div><span>阻断偏差</span><strong>{selected.deviations.filter((item) => item.status === "待审批").length}</strong></div></div><div className="decision-note"><strong>主管检查建议</strong><p>{blockers.length ? `先关闭“${blockers[0].label}”等缺口，再决定阶段推进。` : "当前硬条件已满足，可结合商业判断批准推进。"}</p></div></section></div></>;
  };

  const renderResult = () => <><div className="section-actions"><div><span className="eyebrow">结果与移交</span><h2>结果事实与行政关闭分离</h2><p>中标形成可追溯基线；丢标须完成结构化复盘后才能关闭。</p></div>{selected.id === "QJ-2026-0820" && selected.result !== "pending" && <button className="secondary" onClick={resetResult}>重置当前项目结果</button>}</div>{selected.stage !== "S5" && selected.stage !== "S6" && <section className="panel"><Empty title="尚未进入结果阶段" description="完成正式投标提交并获得客户回执后，才进入结果与移交。" /></section>}{(selected.stage === "S5" || selected.stage === "S6") && <div className="result-layout"><section className="panel span-2"><div className="panel-head"><div><span className="eyebrow">客户结果</span><h2>{selected.result === "pending" ? "等待正式结果" : selected.result === "won" ? "项目中标" : "项目丢标"}</h2></div><Badge>{selected.result === "pending" ? "待确认" : selected.result === "won" ? "中标" : "丢标"}</Badge></div>{selected.result === "pending" && <div className="result-choice"><div><strong>正式提交已固化</strong><p>{selected.externalBid.receipt}</p></div><p>请选择一个分支完成演示。结果由销售主管确认；销售员可跟踪但不能替代审批。</p><div><button className="win-button" onClick={simulateWin}>✓ 模拟项目中标</button><button className="lose-button" onClick={() => manager ? setLostOpen(true) : notify("请切换为销售主管填写丢标结果")}>× 模拟项目丢标</button></div></div>}{selected.result === "won" && selected.baseline && <div className="baseline-package"><div className="baseline-stamp">WIN</div><h3>中标移交基线包</h3><p>基线一经生成不可覆盖；后续变更需创建新版本并重新审批。</p><dl><div><dt>基线编号</dt><dd>{selected.baseline.id}</dd></div><div><dt>客户需求</dt><dd>{selected.baseline.requirementId}</dd></div><div><dt>技术方案</dt><dd>{selected.baseline.technicalId}</dd></div><div><dt>核价方案</dt><dd>{selected.baseline.costingId}</dd></div><div><dt>投标方案</dt><dd>{selected.baseline.bidId}</dd></div><div><dt>批准人 / 时间</dt><dd>{selected.baseline.approver} · {selected.baseline.createdAt}</dd></div></dl></div>}{selected.result === "lost" && selected.lostReview && <div className="lost-review"><h3>结构化丢标复盘</h3><dl><div><dt>主要原因</dt><dd>{selected.lostReview.reason}</dd></div><div><dt>竞争对手</dt><dd>{selected.lostReview.competitor}</dd></div><div><dt>关键差距</dt><dd>{selected.lostReview.gap}</dd></div><div><dt>结果证据</dt><dd>{selected.lostReview.evidence}</dd></div><div><dt>改进行动</dt><dd>{selected.lostReview.improvement}</dd></div></dl></div>}</section><section className="panel"><div className="panel-head"><div><span className="eyebrow">下游系统</span><h2>只读跟踪</h2></div></div>{selected.baseline ? <div className="downstream"><article><i>✓</i><div><strong>合同APP已接收</strong><small>{selected.baseline.contractRef}</small></div><Badge>{selected.baseline.transferStatus}</Badge></article><article><i>○</i><div><strong>订单状态</strong><small>等待合同生效后创建</small></div><Badge>只读</Badge></article><article><i>○</i><div><strong>交付与验收</strong><small>尚未开始</small></div><Badge>只读</Badge></article><article><i>○</i><div><strong>开票与回款</strong><small>尚无财务事实</small></div><Badge>只读</Badge></article></div> : <Empty title="尚无中标基线" description="只有批准的中标版本组合才能传递到合同APP。" />}</section></div>}</>;

  const renderDetail = () => <><div className="project-hero"><button className="back-button" onClick={() => setView("projects")}>← 返回项目列表</button><div className="project-hero-main"><div><div className="project-id"><span>{selected.id}</span><Badge>{selected.riskLevel}风险</Badge><Badge>{selected.intentType}</Badge></div><h1>{selected.name}</h1><p>{selected.customer} · {selected.target}</p></div><div className="project-hero-stats"><div><span>预计金额</span><strong>{money(selected.amount)}</strong></div><div><span>赢单概率</span><strong>{selected.probability}%</strong></div><div><span>交标倒计时</span><strong className={selected.countdown <= 2 && selected.countdown >= 0 ? "danger-text" : ""}>{selected.countdown < 0 ? "已交标" : `${selected.countdown} 天`}</strong></div><div><span>Owner</span><strong>{selected.owner}</strong></div></div></div>{renderStageRail()}</div><nav className="detail-tabs" aria-label="项目详情导航">{detailTabs.map((tab) => <button key={tab.id} className={detailTab === tab.id ? "active" : ""} onClick={() => setDetailTab(tab.id)}>{tab.label}{tab.id === "gate" && getGateConditions(selected).some((item) => !item.ok) && <i>{getGateConditions(selected).filter((item) => !item.ok).length}</i>}</button>)}</nav><div className="detail-content">{detailTab === "overview" && renderOverview()}{detailTab === "relations" && renderRelations()}{detailTab === "resources" && renderResources()}{detailTab === "actions" && renderActions()}{detailTab === "versions" && renderVersions()}{detailTab === "gate" && renderGate()}{detailTab === "result" && renderResult()}</div></>;

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">QJ</div><div><strong>钱江电气</strong><span>销售项目管理 APP</span></div></div><div className="topbar-center"><span className="demo-tag">交互演示原型</span><span>数据更新：2026-08-17 11:00</span></div><div className="topbar-actions"><button className="help-button" onClick={() => setGlossaryOpen(true)}>？ 术语帮助</button><div className="role-switch" aria-label="演示角色切换"><button className={role === "sales" ? "active" : ""} onClick={() => { setRole("sales"); notify("已切换为销售员视角"); }}>销售员</button><button className={role === "manager" ? "active" : ""} onClick={() => { setRole("manager"); notify("已切换为销售主管视角"); }}>销售主管</button></div><button className="avatar-button" aria-label="当前用户">{manager ? "周" : "陈"}</button></div></header>
    <aside className="sidebar"><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><i>◫</i><span>销售项目工作台</span></button><button className={view === "projects" || view === "detail" ? "active" : ""} onClick={() => setView("projects")}><i>▦</i><span>销售项目列表</span><em>{projects.length}</em></button><button className={view === "new" ? "active" : ""} onClick={() => setView("new")}><i>＋</i><span>项目立项</span></button></nav><div className="sidebar-section"><span>快捷入口</span><button onClick={() => openProject("QJ-2026-0818", "gate")}><i>!</i><span>阶段门待办</span><em>2</em></button><button onClick={() => openProject("QJ-2026-0819", "versions")}><i>≋</i><span>版本异常</span><em>1</em></button><button onClick={() => openProject("QJ-2026-0818", "actions")}><i>↗</i><span>风险与督办</span><em>4</em></button></div><div className="sidebar-bottom"><div><span>当前视角</span><strong>{manager ? "销售主管 · 周主管" : "销售员 · 陈晨"}</strong></div><button onClick={resetAll}>↻ 重置演示数据</button></div></aside>
    <main className={view === "detail" ? "main detail-main" : "main"}>{view === "dashboard" && renderDashboard()}{view === "projects" && renderProjects()}{view === "new" && renderNew()}{view === "detail" && renderDetail()}</main>
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    {relationOpen && <Modal title="新增客户关系记录" onClose={() => setRelationOpen(false)}><form onSubmit={addRelationship} className="modal-form"><div className="form-grid two"><Field label="关系层级"><select name="layer" defaultValue="商务决策链"><option>客户高层</option><option>商务决策链</option><option>技术层</option></select></Field><Field label="姓名"><input name="name" required placeholder="客户联系人" /></Field><Field label="客户角色/职务"><input name="title" required placeholder="如：采购决策负责人" /></Field><Field label="态度"><select name="attitude"><option>支持</option><option>中立</option><option>反对</option></select></Field><Field label="影响力"><select name="influence"><option>高</option><option>中</option><option>低</option></select></Field><Field label="覆盖负责人"><select name="owner"><option>{selected.owner}</option><option>刘总</option><option>赵工</option></select></Field></div><Field label="关系证据" hint="没有证据的‘认识客户’不能计为有效覆盖。"><textarea name="evidence" required placeholder="拜访纪要、客户确认、历史合作记录等" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setRelationOpen(false)}>取消</button><button className="primary">保存并更新覆盖</button></div></form></Modal>}
    {actionOpen && <Modal title={actionSeed ? "从风险创建行动" : "新增项目行动"} onClose={() => { setActionOpen(false); setActionSeed(""); }}><form onSubmit={addAction} className="modal-form"><div className="form-grid two"><Field label="行动类型"><select name="type"><option>关系推动</option><option>技术交流</option><option>高层拜访</option><option>客户澄清</option><option>资源协调</option><option>投标协同</option></select></Field><Field label="负责人"><select name="owner"><option>{selected.owner}</option><option>周主管</option><option>赵工</option><option>刘总</option></select></Field><Field label="行动名称"><input name="title" required defaultValue={actionSeed ? `关闭风险：${actionSeed}` : ""} placeholder="清晰描述要完成的动作" /></Field><Field label="截止日期"><input name="due" type="date" required defaultValue="2026-08-19" /></Field></div><Field label="目的"><textarea name="purpose" required defaultValue={actionSeed ? `形成证据并关闭风险“${actionSeed}”` : ""} placeholder="该行动要解决什么问题" /></Field><Field label="证据要求"><input name="evidence" required placeholder="如：客户确认邮件、会议纪要、评审结论" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setActionOpen(false)}>取消</button><button className="primary">创建并指派</button></div></form></Modal>}
    {lostOpen && <Modal title="填写结构化丢标复盘" onClose={() => setLostOpen(false)} wide><form onSubmit={submitLost} className="modal-form"><div className="form-grid two"><Field label="主要原因"><select name="reason"><option>价格竞争力不足</option><option>技术方案差距</option><option>客户关系覆盖不足</option><option>资质或业绩不足</option><option>交期无法满足</option><option>客户项目取消</option></select></Field><Field label="主要竞争对手"><input name="competitor" required placeholder="如：A厂" /></Field></div><Field label="关键差距"><textarea name="gap" required placeholder="说明可验证的差距，不用笼统描述" /></Field><Field label="结果证据"><input name="evidence" required placeholder="未中标通知、客户反馈或评标摘要" /></Field><Field label="改进行动"><textarea name="improvement" required placeholder="明确改进事项、责任方向和后续验证方式" /></Field><div className="form-actions"><button type="button" className="secondary" onClick={() => setLostOpen(false)}>取消</button><button className="lose-button">确认丢标并保存复盘</button></div></form></Modal>}
    {submitBlockers && submitBlockers.length > 0 && <Modal title="正式提交已被阻止" onClose={() => setSubmitBlockers(null)}><div className="blocked-dialog"><div className="blocked-symbol">!</div><p>系统发现以下未满足条件。正式提交版本不可绕过控制：</p>{submitBlockers.map((item) => <div key={item}><span>×</span><strong>{item}</strong></div>)}<p className="rule-note">处理偏差后阶段门会重新计算，但关系或资源缺口仍独立存在。</p><div className="form-actions"><button className="secondary" onClick={() => setSubmitBlockers(null)}>返回处理</button>{selected.deviations.some((item) => item.status === "待审批") && <button className="primary" onClick={() => { setSubmitBlockers(null); setDetailTab("versions"); }}>查看偏差审批</button>}</div></div></Modal>}
    {glossaryOpen && <Modal title="销售项目管理术语" onClose={() => setGlossaryOpen(false)} wide><div className="glossary-list">{glossary.map(([term, definition]) => <article key={term}><strong>{term}</strong><p>{definition}</p></article>)}</div><div className="demo-boundary">说明：术语定义用于本演示原型，最终口径应由业务、财务和投标管理团队共同确认。</div></Modal>}
  </div>;
}
