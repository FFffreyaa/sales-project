"use client";

import { useState } from "react";
import { ProjectStage, Role, SalesProject, View, stageDefinitions, submissionTimingLabel } from "./demo-data";

type DetailTarget = "overview" | "relations" | "strategy" | "resources" | "actions" | "versions" | "gate" | "result";
type ProjectFilter = { stage?: ProjectStage; risk?: string; owner?: string };

interface RoleDashboardProps {
  projects: SalesProject[];
  role: Role;
  openProject: (id: string, tab?: DetailTarget, context?: { source: string; title: string; summary: string; returnView?: View }) => void;
  onNewProject: () => void;
  onShowProjects: (filter?: ProjectFilter) => void;
  onOpenWorkspace: (view: View) => void;
  onQuickRelation: (id: string) => void;
  onQuickAction: (id: string) => void;
  onVoiceRecord: (projectId: string, transcript: string) => void;
  onNotify: (message: string) => void;
  quickProjectId: string;
  recentProjectIds: string[];
  onQuickProjectChange: (id: string) => void;
  dashboardFocus?: string;
  onManagerQuickDecision: (projectId: string, type: string) => void;
  realPendingGates: Record<string, "G1" | "G2" | "G3" | "G4" | "G5" | "G6">;
}

function Tone({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "danger" | "warning" | "success" | "info" | "neutral" }) {
  return <span className={`rd-tone rd-${tone}`}><i />{children}</span>;
}

function ProjectGrade({ project }: { project: SalesProject }) {
  const value = project.projectGrade ?? project.leadGrade ?? "B";
  return <span className={`rd-importance grade-${value}`}>项目{value}级</span>;
}

type SalesFocus = "mine" | "internal" | "external" | "deadline";
type SalesViewMode = "task" | "project";

function SalesDashboard({ projects, openProject, onNewProject, onShowProjects, onQuickRelation, onQuickAction, onVoiceRecord, onNotify, quickProjectId, recentProjectIds, onQuickProjectChange, dashboardFocus }: Omit<RoleDashboardProps, "role">) {
  const salesProjects = projects.filter((project) => project.owner === "陈晨" || project.participants?.includes("陈晨"));
  const focusProject = salesProjects.find(project => project.riskLevel === "重大" || project.riskLevel === "高") ?? salesProjects[0];
  const [focus, setFocus] = useState<SalesFocus>(() => ["mine", "internal", "external", "deadline"].includes(dashboardFocus ?? "") ? dashboardFocus as SalesFocus : "mine");
  const [viewMode, setViewMode] = useState<SalesViewMode>("task");
  const [showAll, setShowAll] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [saved, setSaved] = useState(false);
  const quickProject = salesProjects.find((project) => project.id === quickProjectId) ?? focusProject;
  const recentProjects = recentProjectIds.map((id) => salesProjects.find((project) => project.id === id)).filter(Boolean) as SalesProject[];

  if (!focusProject || !quickProject) return <div className="role-dashboard"><section className="rd-panel"><div className="rd-empty-filter">当前身份没有可访问的D1业务项目。系统不会用静态样例填充工作台。</div></section></div>;

  const actions = salesProjects.flatMap(project => {
    const nearDeadline = project.countdown >= 0 && project.countdown <= 7;
    const activityItems = project.actions.filter(action => action.status !== "已完成").map(action => {
      const customerFacing = /客户|关系|拜访|澄清|结果/.test(`${action.type}${action.title}`);
      const waitingExternal = /待客户|等待客户|待外部|等待外部/.test(`${action.status}${action.result}`);
      const ownerGroup: SalesFocus = waitingExternal ? "external" : action.owner === "陈晨" ? "mine" : "internal";
      return { project, type: action.type, title: action.title, reason: action.purpose, due: action.due, state: action.status, waiting: waitingExternal ? "客户/外部" : action.owner === "陈晨" ? "我来处理" : action.owner, evidence: action.evidence, tone: action.status === "已延期" ? "danger" as const : "warning" as const, tab: "actions" as const, groups: [ownerGroup, ...(nearDeadline ? ["deadline" as const] : [])] as SalesFocus[], ai: `${customerFacing ? "客户相关行动" : "内部行动"}来源于活动记录 ${action.id}，完成时必须补充结果和证据。` };
    });
    const resourceItems = project.resources.filter(resource => resource.required && resource.status !== "已到位").map(resource => ({ project, type: "资源申请", title: `${resource.role}${resource.status === "缺失" ? "尚未指派" : "尚未接受责任"}`, reason: `当前记录：${resource.person}｜${resource.status}`, due: resource.due, state: resource.status, waiting: "销售主管", evidence: resource.dataSource ?? "角色指派记录", tone: "danger" as const, tab: "resources" as const, groups: ["internal", ...(nearDeadline ? ["deadline" as const] : [])] as SalesFocus[], ai: "资源只有在指派且本人接受后才算到位。" }));
    const deviationItems = project.deviations.filter(item => item.status === "待审批").map(item => ({ project, type: "偏差授权", title: `跟踪${item.field}偏差 ${item.id}`, reason: item.impact, due: project.bidDate, state: "待内部审批", waiting: item.approver, evidence: item.id, tone: "danger" as const, tab: "versions" as const, groups: ["internal", ...(nearDeadline ? ["deadline" as const] : [])] as SalesFocus[], ai: "销售员可补充客户影响，但不能自行批准偏差。" }));
    const relationshipItems = project.stage !== "S0" && !project.relationships.some(item => item.layer === "商务决策链" && item.evidence.trim()) ? [{ project, type: "关系缺口", title: "补充客户商务决策链及证据", reason: "当前项目没有可验证的商务决策链关系记录", due: project.bidDate, state: "待我处理", waiting: "我来处理", evidence: "客户Touch、会议纪要或客户确认", tone: "warning" as const, tab: "relations" as const, groups: ["mine", ...(nearDeadline ? ["deadline" as const] : [])] as SalesFocus[], ai: "这是根据D1关系记录计算的缺口，不是预设任务。" }] : [];
    const resultItems = project.stage === "S5" && project.result === "pending" ? [{ project, type: "结果跟踪", title: "等待投标作业回传正式结果", reason: "已进入结果阶段，但尚未形成完整正式结果事实", due: project.bidDate, state: "待外部回传", waiting: "投标作业责任人", evidence: project.externalBid.receipt, tone: "info" as const, tab: "result" as const, groups: ["external"] as SalesFocus[], ai: "只接收正式结果证据，不根据口头信息确认中标。" }] : [];
    return [...activityItems, ...resourceItems, ...deviationItems, ...relationshipItems, ...resultItems];
  });
  const visibleActions = actions.filter((action) => action.groups.includes(focus)).sort((a, b) => Number(b.tone === "danger") - Number(a.tone === "danger") || a.due.localeCompare(b.due));
  const displayedActions = showAll ? visibleActions : visibleActions.slice(0, 5);
  const actionsByProject = visibleActions.reduce((groups, action) => {
    const current = groups.get(action.project.id) ?? [];
    current.push(action);
    groups.set(action.project.id, current);
    return groups;
  }, new Map<string, typeof visibleActions>());
  const visibleProjectGroups = [...actionsByProject.values()];
  const displayedProjectGroups = showAll ? visibleProjectGroups : visibleProjectGroups.slice(0, 5);
  const focusOptions = [
    { id: "mine" as const, label: "我现在要做", value: actions.filter((action) => action.groups.includes("mine")).length, note: `${actions.filter(action => action.groups.includes("mine") && action.state === "已延期").length}项逾期`, icon: "我", className: "danger" },
    { id: "internal" as const, label: "待内部响应", value: actions.filter((action) => action.groups.includes("internal")).length, note: "主管、核价与授权", icon: "协", className: "purple" },
    { id: "external" as const, label: "待客户/外部", value: actions.filter((action) => action.groups.includes("external")).length, note: "只显示正在等待的事项", icon: "客", className: "amber" },
    { id: "deadline" as const, label: "7日内交标", value: salesProjects.filter((project) => project.countdown >= 0 && project.countdown <= 7).length, note: "最近仅剩2天", icon: "◷", className: "cyan" },
  ];
  const startVoice = () => {
    setVoiceOpen(true);
    setListening(true);
    setSaved(false);
    setTranscript("");
    window.setTimeout(() => {
      setListening(false);
      setTranscript(`今天与${quickProject.customer}采购负责人沟通。客户关注交付承诺，要求周三前提供调整后的交期说明；下一步由陈晨在8月20日前发出确认邮件。客户目前态度中立。`);
    }, 900);
  };

  const saveVoice = () => {
    if (!transcript.trim()) return;
    onVoiceRecord(quickProject.id, transcript.trim());
    setSaved(true);
  };

  return <div className="role-dashboard rd-sales-home rd-sales-home-v2">
    <header className="rd-work-header">
      <div><span>2026年8月17日 · 星期一</span><h1>销售行动工作台</h1><p>先完成影响客户和交标的行动，再处理内部协同</p></div>
      <div><button className="rd-secondary" onClick={() => onShowProjects({ owner: "陈晨" })}>查看我的项目</button><button className="rd-primary" onClick={onNewProject}>＋ 发起项目立项</button></div>
    </header>

    <section className="rd-sales-focus" aria-label="销售行动分类">{focusOptions.map((item) => <button key={item.id} className={focus === item.id ? `active ${item.className}` : item.className} aria-pressed={focus === item.id} onClick={() => setFocus(item.id)}><i>{item.icon}</i><span><small>{item.label}</small><strong>{item.value}</strong><em>{item.note}</em></span><b>{focus === item.id ? "当前" : "展开"}</b></button>)}</section>

    <div className="rd-sales-layout-v2">
      <section className="rd-panel rd-priority-work-v2">
        <div className="rd-panel-head"><div><span>ACTION QUEUE</span><h2>{focusOptions.find((item) => item.id === focus)?.label}</h2></div><div className="rd-queue-controls"><button className={viewMode === "task" ? "active" : ""} onClick={() => setViewMode("task")}>按任务</button><button className={viewMode === "project" ? "active" : ""} onClick={() => setViewMode("project")}>按项目</button></div></div>
        <div className="rd-action-list-v2">
          {viewMode === "task" && displayedActions.map((item, index) => <article key={`${item.project.id}-${item.type}-${item.title}`} className={item.tone === "danger" ? "urgent" : ""}>
            <button className="rd-check" aria-label={`完成${item.title}`} onClick={() => onNotify(`“${item.title}”需要补充结果和证据后才能完成`)}>○</button>
            <div className="rd-action-content"><div><span>{item.type}</span><strong>{item.project.name}</strong></div><button onClick={() => openProject(item.project.id, item.tab)}>{item.title}</button><p>{item.reason}</p><small><b>完成证据：</b>{item.evidence}</small>{index === 0 && <em><i>AI</i>{item.ai}</em>}</div>
            <div className="rd-action-owner"><span>等待对象</span><strong>{item.waiting}</strong><time>{item.due}</time></div>
            <Tone tone={item.tone}>{item.state}</Tone>
            <div className="rd-row-actions">{item.waiting !== "我来处理" && <><button onClick={() => onNotify(`已生成给${item.waiting}的催办草稿；发送前请确认事项和截止时间`)}>催办</button><button onClick={() => onNotify(`已打开“${item.title}”补充材料区；不会替代对方决策`)}>补材料</button></>}<button className="rd-row-enter" onClick={() => openProject(item.project.id, item.tab)}>{item.waiting === "我来处理" ? "处理" : "详情"} ›</button></div>
          </article>)}
          {viewMode === "project" && displayedProjectGroups.map((items) => {
            const project = items[0].project;
            const urgentCount = items.filter(item => item.tone === "danger").length;
            return <article className="rd-project-task-group" key={project.id}>
              <header>
                <div><strong>{project.name}</strong><span>{project.id} · {project.customer}</span></div>
                <Tone tone={urgentCount ? "danger" : "warning"}>{project.stage} {project.stageName}</Tone>
                <b>{items.length}项待处理{urgentCount ? ` · ${urgentCount}项紧急` : ""}</b>
              </header>
              <div className="rd-project-task-list">{items.slice(0, 3).map(item => <button key={`${item.type}-${item.title}`} onClick={() => openProject(project.id, item.tab)}><span>{item.type}</span><strong>{item.title}</strong><small>{item.waiting} · {item.due}</small><i>处理 ›</i></button>)}</div>
              <footer><span>{items.length > 3 ? `另有${items.length - 3}项，进入项目后查看全部` : "已展示该项目全部待处理事项"}</span><button className="rd-row-enter" onClick={() => openProject(project.id)}>进入项目驾驶舱 ›</button></footer>
            </article>;
          })}
          {visibleActions.length === 0 && <div className="rd-empty-filter">当前分类没有待处理事项。</div>}
        </div>
        {((viewMode === "task" && visibleActions.length > 5) || (viewMode === "project" && visibleProjectGroups.length > 5)) && <button className="rd-show-all" onClick={() => setShowAll(value => !value)}>{showAll ? "收起，只看前5组" : viewMode === "task" ? `查看全部 ${visibleActions.length} 项` : `查看全部 ${visibleProjectGroups.length} 个项目`}</button>}
      </section>

      <aside className="rd-panel rd-quick-actions-v2">
        <div className="rd-panel-head"><div><span>QUICK ENTRY</span><h2>快捷记录与发起</h2></div></div>
        <label className="rd-quick-project"><span>当前记录到</span><select value={quickProject.id} onChange={(event) => onQuickProjectChange(event.target.value)}>{salesProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><small>{quickProject.stage} {quickProject.stageName} · {quickProject.id}</small></label>
        {recentProjects.length > 0 && <div className="rd-recent-projects"><span>最近使用</span>{recentProjects.slice(0, 3).map((project) => <button key={project.id} className={project.id === quickProject.id ? "active" : ""} onClick={() => onQuickProjectChange(project.id)}>{project.name.replace("项目", "")}</button>)}</div>}
        <div className="rd-quick-grid">
          <button onClick={() => onQuickRelation(quickProject.id)}><i>握</i><span><strong>记录客户Touch</strong><small>关系、态度与证据</small></span></button>
          <button onClick={() => onQuickAction(quickProject.id)}><i>行</i><span><strong>记录客户经营行动</strong><small>关联客户、关系、策略或风险缺口</small></span></button>
          <button onClick={() => openProject(quickProject.id, "resources")}><i>资</i><span><strong>申请关键资源</strong><small>提交主管配置</small></span></button>
          <button onClick={onNewProject}><i>项</i><span><strong>发起项目立项</strong><small>来源、采购意向与证据</small></span></button>
        </div>
        <button className="rd-voice-entry" onClick={startVoice}><span>◉</span><div><strong>AI语音录入</strong><small>口述拜访结论，生成待确认事实</small></div><b>开始 ›</b></button>
        <div className="rd-inline-agent"><span>AI建议</span><strong>{actions[0]?.title ?? "当前没有待处理业务事项"}</strong><p>{actions[0]?.reason ?? "工作台只依据D1活动、资源、关系与版本事实生成建议。"}</p>{actions[0] && <button onClick={() => openProject(actions[0].project.id, actions[0].tab)}>查看依据 ›</button>}</div>
      </aside>
    </div>

    <section className="rd-panel rd-project-pulse compact">
      <div className="rd-panel-head"><div><span>MY PROJECT PULSE</span><h2>我的项目动态</h2></div><em>来源详情已移入项目驾驶舱；这里仅保留下一步和异常</em></div>
      <div className="rd-pulse-list">{salesProjects.map(project => <article key={project.id}><button onClick={() => openProject(project.id)}><span><strong>{project.name}</strong><small>{project.owner === "陈晨" ? "我是Owner" : `协作项目 · Owner ${project.owner}`} · 来源：{project.sourceLineage?.sourceSystem ?? "手工立项"}</small></span><span className={`stage-chip stage-${project.stage.toLowerCase()}`}><b>{project.stage}</b>{project.stageName}</span><span><small>我的下一步</small>{project.nextStep}</span><Tone tone={project.riskLevel === "重大" || project.riskLevel === "高" ? "danger" : project.riskLevel === "中" ? "warning" : "success"}>{project.riskLevel}风险</Tone><time className={project.countdown <= 2 && project.countdown >= 0 ? "danger" : ""}>{submissionTimingLabel(project)}</time></button><button onClick={() => openProject(project.id)}>进入 ›</button></article>)}</div>
    </section>

    {voiceOpen && <div className="rd-voice-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setVoiceOpen(false)}>
      <section className="rd-voice-dialog" role="dialog" aria-modal="true" aria-label="AI语音录入">
        <header><div><span>AI VOICE CAPTURE · 演示能力</span><h2>语音记录客户沟通</h2></div><button onClick={() => setVoiceOpen(false)}>×</button></header>
        <div className={`rd-wave ${listening ? "listening" : ""}`}><i /><i /><i /><i /><i /><i /><i /><i /><span>{listening ? "正在识别语音…" : transcript ? "识别完成，请确认后保存" : "等待开始"}</span></div>
        {transcript && <><label>识别文本<textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} /></label><div className="rd-ai-fields"><p><span>关联项目</span><strong>{quickProject.name}</strong></p><p><span>客户事实</span><strong>关注交期承诺</strong></p><p><span>关系态度</span><strong>中立 · 需要确认</strong></p><p><span>下一行动</span><strong>8月20日前发送交期说明</strong></p><p className="warning"><span>可能影响</span><strong>交期承诺偏差，需人工判断是否触发需求变更</strong></p><p><span>来源血缘</span><strong>{quickProject.sourceLineage?.commercialProjectId ?? "待关联"} → {quickProject.id}</strong></p></div></>}
        <footer><small>AI只生成事实和行动草稿；销售员确认后写入项目，不自动改变需求版本或触发审批。</small><div><button className="rd-secondary" onClick={() => setVoiceOpen(false)}>取消</button>{transcript && <button className="rd-primary" disabled={saved} onClick={saveVoice}>{saved ? "已保存到项目行动" : "确认事实并生成后续行动"}</button>}</div></footer>
      </section>
    </div>}
  </div>;
}

type ManagerHomeFocus = "portfolio" | "major" | "deadline" | "todo" | "risk";

function ManagerDashboard({ projects, openProject, onShowProjects, onOpenWorkspace, onNotify, dashboardFocus, onManagerQuickDecision, realPendingGates }: Omit<RoleDashboardProps, "role" | "onNewProject" | "onQuickRelation" | "onQuickAction" | "onVoiceRecord">) {
  const initialFocus = ["portfolio", "major", "deadline", "todo", "risk"].includes(dashboardFocus ?? "") ? dashboardFocus as ManagerHomeFocus : "todo";
  const [focus, setFocus] = useState<ManagerHomeFocus>(initialFocus);
  const [expanded, setExpanded] = useState("");
  const [stageScope, setStageScope] = useState("全部");
  const [healthScope, setHealthScope] = useState<"全部" | "健康" | "关注" | "干预">("全部");
  const teamProjects = projects;
  const majorProjects = projects.filter(project => (project.projectGrade ?? project.leadGrade) === "S");
  const deadlineProjects = projects.filter(project => project.countdown >= 0 && project.countdown <= 7).sort((a, b) => a.countdown - b.countdown);
  const riskProjects = projects.filter(project => project.riskLevel === "重大" || project.riskLevel === "高");
  const persistedGateItems = projects.filter(project => realPendingGates[project.id]).map(project => { const code = realPendingGates[project.id]; const professional = code === "G3" || code === "G4"; return { id: `${code}-${project.id}`, type: code === "G1" ? "立项审批" : professional ? "专业Gate督办" : "阶段门", project, title: code === "G1" ? `${project.customer}${project.target}立项审批` : code === "G2" ? `${project.name} G2投入启动门` : code === "G3" ? `${project.name} G3需求与技术基线门` : code === "G4" ? `${project.name} G4核价授权门` : code === "G5" ? `${project.name} G5商务决策与提交门` : `${project.name} G6结果与移交门`, fact: code === "G1" ? `线索${project.leadGrade ?? project.projectGrade ?? "B"}级、采购意向和定级影响因素已冻结，等待主管确认或有依据调整销售项目等级。` : code === "G2" ? "投入启动来源已冻结，等待主管明确投入范围、责任资源、优先级和期限。" : code === "G3" ? "需求与技术来源快照已冻结，等待独立技术评审人确认；销售主管仅查看和督办。" : code === "G4" ? "核价专业来源快照已冻结，等待财务/价格授权人确认；销售主管仅督办。" : code === "G5" ? "价格授权、投标专员形成的提交包及专业评审人的独立结论已冻结，等待主管一次性作出投/不投及提交授权决策。" : "L2.9结果事实及中标基线或未成交复盘已冻结，等待主管一次性确认。", due: "待处理", tab: "gate" as const, tone: "warning" as const, quick: code === "G1", tags: ["真实流程", code, professional ? "主管督办" : "主管审批"] }; });
  const resourceWorkItems = projects.flatMap(project => project.resources.filter(resource => resource.required && resource.status !== "已到位").map(resource => ({ id: `RESOURCE-${project.id}-${resource.id}`, type: "资源协调", project, title: `${resource.role}${resource.status === "缺失" ? "待指派" : "待本人接受"}`, fact: `${resource.person}｜${resource.status}｜要求日期 ${resource.due}`, due: project.countdown >= 0 && project.countdown <= 7 ? `${project.countdown}天后交标` : "待处理", tab: "resources" as const, tone: "danger" as const, quick: false, tags: ["D1角色指派", resource.status] })));
  const deviationWorkItems = projects.flatMap(project => project.deviations.filter(deviation => deviation.status === "待审批").map(deviation => ({ id: `DEVIATION-${project.id}-${deviation.id}`, type: "偏差审批", project, title: `${deviation.field}偏差 ${deviation.id}`, fact: `${deviation.requirement} → ${deviation.proposal}｜${deviation.impact}`, due: "待授权人处理", tab: "versions" as const, tone: "danger" as const, quick: false, tags: ["D1偏差记录", deviation.approver] })));
  const workItems = [...persistedGateItems, ...resourceWorkItems, ...deviationWorkItems];
  const metrics = [
    { id: "portfolio" as const, label: "团队项目", value: teamProjects.length, note: "主管责任范围", icon: "▣", className: "blue" },
    { id: "major" as const, label: "S级项目", value: majorProjects.length, note: "当前销售项目等级", icon: "S", className: "amber" },
    { id: "deadline" as const, label: "7日内交标", value: deadlineProjects.length, note: "按剩余天数排序", icon: "◷", className: "green" },
    { id: "todo" as const, label: "待我处理", value: workItems.length, note: "按唯一任务编号去重", icon: "办", className: "purple" },
    { id: "risk" as const, label: "重大 / 高风险", value: riskProjects.length, note: "项目风险，不重复待办", icon: "!", className: "red" },
  ];
  const projectScore = (project: SalesProject) => Math.round((project.health.relationship + project.health.resource + project.health.operation) / 3);
  const healthBand = (project: SalesProject) => projectScore(project) >= 80 ? "健康" : projectScore(project) >= 60 ? "关注" : "干预";
  const portfolioProjects = teamProjects.filter(project => (stageScope === "全部" || project.stage === stageScope) && (healthScope === "全部" || healthBand(project) === healthScope));
  const focusProjects = focus === "major" ? majorProjects : focus === "deadline" ? deadlineProjects : focus === "portfolio" ? portfolioProjects : teamProjects;
  const portfolioAverage = Math.round(teamProjects.reduce((sum, project) => sum + projectScore(project), 0) / Math.max(1, teamProjects.length));
  const healthCounts = { 健康: teamProjects.filter(project => healthBand(project) === "健康").length, 关注: teamProjects.filter(project => healthBand(project) === "关注").length, 干预: teamProjects.filter(project => healthBand(project) === "干预").length };
  const riskCounts = ["关系", "资源", "方案", "盈利", "交标"].map(category => ({ category, count: projects.reduce((sum, project) => sum + project.risks.filter(risk => risk.status !== "已关闭" && risk.category.includes(category)).length, 0) }));
  const projectLine = (project: SalesProject) => <button className="rd-project-line rd-project-line-v2" key={project.id} onClick={() => openProject(project.id)}><ProjectGrade project={project} /><span className="rd-line-project"><strong>{project.name}</strong><small>{project.id} · {project.owner} · 项目{project.projectGrade ?? project.leadGrade ?? "B"}级 / 线索{project.leadGrade ?? "未提供"}级</small></span><span className={`rd-line-stage stage-${project.stage.toLowerCase()}`}><b>{project.stage}</b>{project.stageName}</span><Tone tone={project.riskLevel === "重大" || project.riskLevel === "高" ? "danger" : project.riskLevel === "中" ? "warning" : "success"}>{project.riskLevel}风险</Tone><span className={project.countdown >= 0 && project.countdown <= 7 ? "rd-line-time danger" : "rd-line-time"}>{submissionTimingLabel(project)}</span><i>›</i></button>;
  const portfolioProjectLine = (project: SalesProject, index: number) => { const score = projectScore(project); const band = healthBand(project); return <button className="rd-project-line" key={project.id} onClick={() => openProject(project.id)}><span className="rd-line-rank">{String(index + 1).padStart(2, "0")}</span><span className="rd-line-project"><strong>{project.name}</strong><small>{project.id} · {project.owner} · 项目{project.projectGrade ?? project.leadGrade ?? "B"}级 / 线索{project.leadGrade ?? "未提供"}级</small></span><span className={`rd-line-stage stage-${project.stage.toLowerCase()}`}><b>{project.stage}</b>{project.stageName}</span><span><Tone tone={project.riskLevel === "重大" || project.riskLevel === "高" ? "danger" : project.riskLevel === "中" ? "warning" : "success"}>{project.riskLevel}风险</Tone></span><span className={`rd-line-score ${band === "健康" ? "healthy" : band === "关注" ? "attention" : "critical"}`}><strong>{score}</strong><small>{band === "健康" ? "健康" : band === "关注" ? "待关注" : "需干预"}</small></span><span className={project.countdown >= 0 && project.countdown <= 7 ? "rd-line-time danger" : "rd-line-time"}>{submissionTimingLabel(project)}</span><i>›</i></button>; };

  return <div className="role-dashboard rd-manager-home rd-manager-home-v2">
    <header className="rd-work-header manager"><div><span>项目组合与管理决策</span><h1>销售主管工作台</h1><p>线索评级只读保留；销售项目等级可在G1有依据调整；风险等级动态变化</p></div><div className="rd-grade-legend"><span><i className="importance-major">S</i>S级</span><span><i className="importance-key">A</i>A级</span><span><i className="importance-normal">B</i>B/C级</span></div></header>
    <section className="rd-manager-metrics" aria-label="主管工作视角">{metrics.map(item => <button key={item.id} className={focus === item.id ? "active" : ""} aria-pressed={focus === item.id} onClick={() => setFocus(item.id)}><i className={item.className}>{item.icon}</i><span><small>{item.label}</small><strong>{item.value}</strong><em>{item.note}</em></span><b>{focus === item.id ? "当前" : "展开"}</b></button>)}</section>
    <section className="rd-panel rd-manager-workspace">
      <header className="rd-manager-workspace-head"><div><span>{focus === "todo" ? "MY WORK QUEUE" : focus === "risk" ? "RISK EXPOSURE" : "PROJECT PORTFOLIO"}</span><h2>{focus === "todo" ? "我的全部待办" : focus === "risk" ? "项目风险全景" : focus === "major" ? "S级项目" : focus === "deadline" ? "交标红区项目" : "团队项目全景"}</h2><p>{focus === "todo" ? "按任务编号去重；风险和阻断仅作为标签。" : focus === "risk" ? "风险用于观察暴露与趋势，不复制主管待办。" : "线索评级S/A/B/C只读保留；销售项目等级默认继承并可在G1有依据调整；风险动态变化。"}</p></div><div>{focus === "todo" && <button onClick={() => onOpenWorkspace("decisions")}>进入阶段门中心 ›</button>}{focus === "risk" && <button onClick={() => onOpenWorkspace("risk-center")}>查看风险与督办 ›</button>}{(focus === "portfolio" || focus === "major" || focus === "deadline") && <button onClick={() => onShowProjects()}>查看项目组合 ›</button>}</div></header>
      <div className="rd-manager-workspace-body">
        <div className="rd-manager-primary">
          {focus === "todo" && <div className="rd-workitem-list">{workItems.map(item => <article key={item.id} className={expanded === item.id ? "expanded" : ""}>
            <div className="rd-workitem-type"><Tone tone={item.tone}>{item.type}</Tone><small>{item.id}</small></div>
            <div className="rd-workitem-main"><div><ProjectGrade project={item.project} /><span className="lead-grade">线索{item.project.leadGrade ?? item.project.projectGrade ?? "B"}级</span><strong>{item.project.name}</strong><Tone tone={item.project.riskLevel === "重大" || item.project.riskLevel === "高" ? "danger" : "warning"}>{item.project.riskLevel}风险</Tone></div><h3>{item.title}</h3><p>{item.fact}</p><div className="rd-workitem-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              {expanded === item.id && <section><strong>{item.id.startsWith("G3-") ? "主管查看并督办技术评审" : "主管需要形成明确结论"}</strong><p>{item.id.startsWith("G3-") ? "技术评审人是S2退出的专业决策人；技术负责人负责编制，主管不能代批或伪造回执。" : item.id.startsWith("G1-") ? "快速审查会打开同一G1审批抽屉，不会直接批准或产生第二个推进按钮。" : "核对事实、影响、责任和证据后处理；AI建议不自动执行。"}</p><div>{!item.id.startsWith("G1-") && <button onClick={() => item.id.startsWith("G3-") ? openProject(item.project.id, "gate", { source: "主管工作台", title: item.title, summary: "查看S2冻结快照并督办技术评审人" }) : onNotify(`${item.id}已退回补充材料，任务仍保留审计记录`)}>{item.id.startsWith("G3-") ? "查看并督办" : "退回补充"}</button>}{item.quick && <button className="approve" onClick={() => onManagerQuickDecision(item.project.id, item.type)}>快速审查</button>}<button className="approve" onClick={() => openProject(item.project.id, item.tab, { source: "主管工作台", title: item.title, summary: item.fact })}>进入项目</button></div></section>}
            </div><time className={item.due.includes("逾期") || item.due.includes("小时") ? "danger" : ""}>{item.due}</time><button onClick={() => setExpanded(expanded === item.id ? "" : item.id)}>{expanded === item.id ? "收起" : "审查"}</button>
          </article>)}</div>}
          {focus === "risk" && <div className="rd-risk-overview-v2"><div className="rd-risk-category-strip">{riskCounts.map(item => <article key={item.category}><span>{item.category}风险</span><strong>{item.count}</strong><i style={{ width: `${Math.min(100, item.count * 24)}%` }} /></article>)}</div><div className="rd-risk-projects-v2">{riskProjects.map(project => <article key={project.id}><header><ProjectGrade project={project} /><Tone tone="danger">{project.riskLevel}风险</Tone><span>{submissionTimingLabel(project)}</span></header><h3>{project.name}</h3><p>{project.risks.find(risk => risk.status !== "已关闭")?.title ?? "暂无开放风险"}</p><footer><span>{project.risks.filter(risk => risk.status !== "已关闭").length}项开放风险</span><button onClick={() => openProject(project.id, "actions")}>查看项目风险 ›</button></footer></article>)}</div></div>}
          {focus === "portfolio" && <div className="rd-portfolio-work"><section className="rd-stage-selector"><header><div><strong>S0–S6 阶段分布</strong><small>阶段使用序列色；风险和健康度另用红黄绿语义色</small></div><button className={stageScope === "全部" ? "active" : ""} onClick={() => setStageScope("全部")}>全部 {teamProjects.length}</button></header><div>{stageDefinitions.map(stage => { const count = teamProjects.filter(project => project.stage === stage.code).length; return <button key={stage.code} className={`${stageScope === stage.code ? "active" : ""} stage-${stage.code.toLowerCase()}`} onClick={() => setStageScope(stage.code)}><b>{stage.code}</b><span>{stage.name}</span><strong>{count}</strong><small>个项目</small></button>; })}</div></section><section className="rd-filtered-projects"><header><strong>{stageScope === "全部" ? "全部阶段" : `${stageScope} ${stageDefinitions.find(stage => stage.code === stageScope)?.name}`} · {healthScope === "全部" ? "全部健康状态" : healthScope === "健康" ? "健康" : healthScope === "关注" ? "待关注" : "需干预"}</strong><small>共 {focusProjects.length} 个项目，点击进入项目驾驶舱</small></header>{focusProjects.map(portfolioProjectLine)}{focusProjects.length === 0 && <div className="rd-empty-filter">当前筛选条件下没有项目。请选择其他阶段或健康状态。</div>}</section></div>}
          {(focus === "major" || focus === "deadline") && <div className="rd-project-list-v2"><div className="rd-project-list-summary"><strong>{focus === "major" ? "S级项目" : "交标红区项目"}</strong><span>{focusProjects.length}个项目</span></div><header><span>项目等级</span><span>项目 / 线索评级</span><span>当前阶段</span><span>风险等级</span><span>交标时间</span><span /></header>{focusProjects.map(projectLine)}</div>}
        </div>
        <aside className="rd-manager-context">{focus === "portfolio" ? <section className="rd-health-interactive"><header><div><span>PORTFOLIO HEALTH</span><h3>项目组合健康分层</h3></div><small>点击颜色筛选项目</small></header><div className="rd-health-summary"><div className="rd-health-ring"><strong>{portfolioAverage}</strong><span>组合均分</span></div><p><strong>{healthCounts.关注 + healthCounts.干预}</strong><span>个项目需要关注</span></p></div><div className="rd-health-buttons"><button className={healthScope === "健康" ? "active healthy" : "healthy"} onClick={() => setHealthScope(healthScope === "健康" ? "全部" : "健康")}><i /><span><strong>健康</strong><small>80分及以上</small></span><b>{healthCounts.健康}</b></button><button className={healthScope === "关注" ? "active attention" : "attention"} onClick={() => setHealthScope(healthScope === "关注" ? "全部" : "关注")}><i /><span><strong>待关注</strong><small>60–79分，需制定动作</small></span><b>{healthCounts.关注}</b></button><button className={healthScope === "干预" ? "active critical" : "critical"} onClick={() => setHealthScope(healthScope === "干预" ? "全部" : "干预")}><i /><span><strong>需干预</strong><small>60分以下，主管介入</small></span><b>{healthCounts.干预}</b></button></div><button className="rd-clear-filter" onClick={() => { setStageScope("全部"); setHealthScope("全部"); }}>清除组合筛选</button></section> : <section className="rd-agent-context"><header><span>AGENT BRIEF</span><h3>主管辅助判断</h3><Tone tone="info">AI建议 · 不自动执行</Tone></header><div className="rd-agent-focus"><i>AI</i><strong>{focus === "todo" ? workItems[0]?.title ?? "当前没有真实待办" : focus === "risk" ? riskProjects[0]?.risks.find(item => item.status !== "已关闭")?.title ?? "当前没有重大或高风险" : "项目等级与风险必须分别观察"}</strong><p>{focus === "todo" ? workItems[0]?.fact ?? "任务区只展示D1 Gate、角色指派和偏差事实。" : focus === "risk" ? "风险卡片只展示D1项目风险暴露，不复制审批或协调任务。" : "线索评级、销售项目等级和动态风险分别显示；项目等级调整不会覆盖线索评级。"}</p></div><div className="rd-agent-actions">{workItems[0] && <button onClick={() => openProject(workItems[0].project.id, workItems[0].tab)}>查看首要依据<b>›</b></button>}<button onClick={() => onNotify("判断依据：项目等级、交标时限、开放风险、角色指派和版本状态")}>查看判断口径<b>›</b></button></div></section>}</aside>
      </div>
    </section>
  </div>;
}

export default function RoleDashboard(props: RoleDashboardProps) {
  return props.role === "sales"
    ? <SalesDashboard {...props} />
    : <ManagerDashboard {...props} />;
}
