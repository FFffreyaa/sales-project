"use client";

import { useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  client: string;
  owner: string;
  stage: string;
  stageIndex: number;
  amount: number;
  probability: number;
  days: number;
  level: "重大" | "重点" | "常规";
  health: "健康" | "关注" | "风险";
  next: string;
  location: string;
  source: string;
  product: string;
};

const stages = ["待立项", "立项与策略", "需求与方案", "核价评审", "定价与投标", "结果与移交"];

const projects: Project[] = [
  { id: "SP-260817-023", name: "华东智造园 110kV 变电站", client: "杭州华东智造有限公司", owner: "周宁", stage: "定价与投标", stageIndex: 4, amount: 2860, probability: 72, days: 2, level: "重大", health: "风险", next: "完成价格授权与商务偏差审批", location: "浙江·杭州", source: "公开招标", product: "110kV 电力变压器 × 4" },
  { id: "SP-260812-018", name: "临港数据中心二期扩容", client: "临港云算科技有限公司", owner: "陈峰", stage: "核价评审", stageIndex: 3, amount: 1680, probability: 64, days: 7, level: "重点", health: "关注", next: "确认铜材询价与交期风险储备", location: "上海·临港", source: "客户 RFQ", product: "干式变压器 × 12" },
  { id: "SP-260731-041", name: "西南新能源升压站项目", client: "川能清洁能源集团", owner: "李想", stage: "需求与方案", stageIndex: 2, amount: 4230, probability: 55, days: 15, level: "重大", health: "关注", next: "冻结客户需求 V3.1", location: "四川·凉山", source: "渠道机会", product: "220kV 主变 × 2" },
  { id: "SP-260806-012", name: "滨海化工园配电改造", client: "滨海新材料股份有限公司", owner: "王一凡", stage: "立项与策略", stageIndex: 1, amount: 920, probability: 38, days: 24, level: "常规", health: "健康", next: "补齐客户决策链与高层伙伴", location: "江苏·盐城", source: "增购", product: "油浸式变压器 × 6" },
  { id: "SP-260711-036", name: "北方轨交牵引供电升级", client: "北方城市轨道交通集团", owner: "徐静", stage: "结果与移交", stageIndex: 5, amount: 3520, probability: 90, days: 0, level: "重大", health: "健康", next: "确认中标基线移交接收", location: "河北·石家庄", source: "公开招标", product: "牵引整流变压器 × 8" },
];

const initialTasks = [
  { id: 1, title: "提交价格授权申请", meta: "华东智造园 · 今天 16:00", owner: "我", urgent: true, done: false },
  { id: 2, title: "关闭技术偏差 DEV-018", meta: "华东智造园 · 今天", owner: "赵工", urgent: true, done: false },
  { id: 3, title: "补充客户信用结论", meta: "临港数据中心 · 明天", owner: "我", urgent: false, done: false },
  { id: 4, title: "确认渠道伙伴合规状态", meta: "西南新能源 · 8月20日", owner: "刘敏", urgent: false, done: true },
];

const nav = [
  { id: "overview", label: "项目工作台", icon: "⌂" },
  { id: "projects", label: "销售项目", icon: "▦" },
  { id: "approvals", label: "阶段门审批", icon: "✓" },
  { id: "risks", label: "风险与督办", icon: "!" },
  { id: "versions", label: "方案与版本", icon: "≋" },
  { id: "relationships", label: "客户关系", icon: "◎" },
];

function formatMoney(value: number) {
  return `¥${(value / 1000).toFixed(1)}亿`;
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("overview");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("全部阶段");
  const [selected, setSelected] = useState(projects[0]);
  const [tasks, setTasks] = useState(initialTasks);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState("销售主管");
  const [showCreate, setShowCreate] = useState(false);

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const matchText = `${project.name}${project.client}${project.owner}${project.id}`.includes(query.trim());
    const matchStage = stageFilter === "全部阶段" || project.stage === stageFilter;
    return matchText && matchStage;
  }), [query, stageFilter]);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <span><b>钱江电气</b><small>销售项目管理</small></span>
        </div>

        <nav className="primary-nav" aria-label="主要导航">
          <p className="nav-caption">工作空间</p>
          {nav.map((item) => (
            <button key={item.id} className={activeNav === item.id ? "active" : ""} onClick={() => { setActiveNav(item.id); toast(`已切换至${item.label}`); }}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "approvals" && <em>3</em>}
            </button>
          ))}
          <p className="nav-caption nav-gap">管理分析</p>
          <button onClick={() => toast("组合分析将在下一迭代开放")}><span className="nav-icon">⌁</span>项目组合</button>
          <button onClick={() => toast("报表中心将在下一迭代开放")}><span className="nav-icon">▤</span>经营分析</button>
        </nav>

        <div className="sidebar-foot">
          <button className="assistant-entry" onClick={() => toast("AI 已完成今日项目风险扫描") }>
            <span className="ai-orb">AI</span>
            <span><b>项目助手</b><small>2 项风险待确认</small></span>
            <i>→</i>
          </button>
          <div className="user-card">
            <span className="avatar">周</span>
            <span><b>周宁</b><small>{role}</small></span>
            <button aria-label="切换角色" onClick={() => setRole((value) => value === "销售主管" ? "项目 Owner" : "销售主管")}>⌄</button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">2026年8月17日 · 周一</span>
            <h1>早上好，周宁</h1>
            <p>今天有 <b>2 个关键节点</b>临近，建议优先处理华东智造园项目。</p>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、客户或负责人" aria-label="搜索项目" />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="通知" onClick={() => toast("你有 3 条未读通知")}>♢<span>3</span></button>
            <button className="primary-button" onClick={() => setShowCreate(true)}><b>＋</b> 新建销售项目</button>
          </div>
        </header>

        <div className="content">
          <section className="priority-banner">
            <div className="priority-icon">!</div>
            <div>
              <span className="section-kicker">今日优先</span>
              <h2>华东智造园项目距交标仅剩 2 天</h2>
              <p>价格授权与 1 项商务偏差尚未完成，预计突破内部封标时间 6 小时。</p>
            </div>
            <div className="banner-actions">
              <button onClick={() => { setSelected(projects[0]); document.getElementById("project-detail")?.scrollIntoView({ behavior: "smooth" }); }}>查看项目</button>
              <button className="solid" onClick={() => toast("督办任务已创建，并通知价格授权人")}>发起督办 →</button>
            </div>
          </section>

          <section className="metrics-grid" aria-label="项目指标">
            <article className="metric-card">
              <div className="metric-top"><span>在跟项目</span><i className="metric-symbol blue">▦</i></div>
              <strong>24</strong><small><b>+3</b> 较上月</small>
              <div className="mini-bars"><i/><i/><i/><i/><i/><i/></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>项目金额</span><i className="metric-symbol cyan">¥</i></div>
              <strong>¥2.86亿</strong><small><b>+12.4%</b> 较上月</small>
              <svg className="spark" viewBox="0 0 160 42" role="img" aria-label="项目金额呈上升趋势"><path d="M2 35 C24 35,25 23,45 27 S72 36,91 18 S122 21,158 4"/><path className="fill" d="M2 35 C24 35,25 23,45 27 S72 36,91 18 S122 21,158 4 L158 42 L2 42Z"/></svg>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>加权预测</span><i className="metric-symbol green">↗</i></div>
              <strong>¥1.47亿</strong><small><b>+8.2%</b> 较上月</small>
              <div className="progress-track"><i style={{ width: "68%" }}/></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>待我处理</span><i className="metric-symbol amber">✓</i></div>
              <strong>{tasks.filter((task) => !task.done).length + 5}</strong><small><span className="danger-text">2 项已逾期</span></small>
              <div className="task-dots"><i/><i/><i/><i/><i/></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>重大风险</span><i className="metric-symbol red">!</i></div>
              <strong>3</strong><small><span className="danger-text">需今日介入</span></small>
              <div className="risk-lines"><i/><i/><i/></div>
            </article>
          </section>

          <section className="stage-panel">
            <div className="section-heading">
              <div><span className="section-kicker">项目漏斗</span><h2>销售项目阶段分布</h2></div>
              <button className="text-button" onClick={() => toast("已进入全量项目组合视图")}>查看全部项目 →</button>
            </div>
            <div className="stage-flow">
              {[
                ["待立项", 3, "¥0.18亿", "#93a4b8"], ["立项与策略", 5, "¥0.42亿", "#5879ad"], ["需求与方案", 6, "¥0.71亿", "#2f65ad"],
                ["核价评审", 4, "¥0.55亿", "#266f89"], ["定价与投标", 4, "¥0.66亿", "#b77922"], ["结果与移交", 2, "¥0.34亿", "#2a8060"],
              ].map(([label, count, amount, color], index) => (
                <button key={String(label)} className="stage-step" onClick={() => setStageFilter(String(label))} style={{ "--stage-color": color } as React.CSSProperties}>
                  <span>{index + 1}</span><b>{label}</b><strong>{count}</strong><small>{amount}</small>
                </button>
              ))}
            </div>
          </section>

          <div className="main-grid">
            <section className="project-panel">
              <div className="section-heading">
                <div><span className="section-kicker">PROJECT PORTFOLIO</span><h2>重点项目</h2></div>
                <div className="filters">
                  <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="按阶段筛选">
                    <option>全部阶段</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}
                  </select>
                  <button aria-label="更多筛选" onClick={() => toast("当前已按重点项目范围筛选")}>☷</button>
                </div>
              </div>
              <div className="project-table">
                <div className="table-row table-head"><span>项目 / 客户</span><span>阶段</span><span>金额</span><span>赢率</span><span>交标</span><span>健康度</span></div>
                {filteredProjects.map((project) => (
                  <button className={`table-row ${selected.id === project.id ? "selected" : ""}`} key={project.id} onClick={() => setSelected(project)}>
                    <span className="project-name"><b>{project.name}</b><small>{project.client} · {project.owner}</small></span>
                    <span><em className={`status-dot s${project.stageIndex}`}/>{project.stage}</span>
                    <span><b>¥{project.amount.toLocaleString()}万</b></span>
                    <span><b>{project.probability}%</b><i className="row-progress"><u style={{ width: `${project.probability}%` }}/></i></span>
                    <span className={project.days <= 2 ? "urgent" : ""}>{project.days === 0 ? "已提交" : `${project.days} 天`}</span>
                    <span><em className={`health ${project.health}`}>{project.health}</em></span>
                  </button>
                ))}
                {filteredProjects.length === 0 && <div className="empty-state">没有匹配的项目，请调整搜索或阶段筛选。</div>}
              </div>
            </section>

            <aside className="todo-panel">
              <div className="section-heading"><div><span className="section-kicker">MY TASKS</span><h2>我的待办</h2></div><button className="count-badge">{tasks.filter((task) => !task.done).length}</button></div>
              <div className="todo-list">
                {tasks.map((task) => (
                  <label className={task.done ? "done" : ""} key={task.id}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <span className="checkmark">✓</span>
                    <span className="todo-copy"><b>{task.title}</b><small className={task.urgent && !task.done ? "urgent" : ""}>{task.meta}</small></span>
                    <em>{task.owner}</em>
                  </label>
                ))}
              </div>
              <button className="full-link" onClick={() => toast("已打开全部待办视图")}>查看全部待办 <span>→</span></button>
            </aside>
          </div>

          <section className="detail-panel" id="project-detail">
            <div className="detail-top">
              <div>
                <span className="section-kicker">{selected.id}</span>
                <h2>{selected.name}</h2>
                <p>{selected.client} · {selected.location} · {selected.product}</p>
              </div>
              <div className="detail-value"><span>预计金额</span><strong>¥{selected.amount.toLocaleString()}万</strong><small>{selected.level}项目</small></div>
            </div>
            <div className="detail-stage">
              {stages.map((stage, index) => <div key={stage} className={index < selected.stageIndex ? "complete" : index === selected.stageIndex ? "current" : ""}><i>{index < selected.stageIndex ? "✓" : index + 1}</i><span>{stage}</span></div>)}
            </div>
            <div className="detail-columns">
              <div className="health-score">
                <div className="subheading"><h3>项目健康度</h3><span>阶段化评估</span></div>
                <div className="score-row"><span>客户关系</span><b>58</b><i><u style={{ width: "58%" }}/></i><em className="warn">待加强</em></div>
                <div className="score-row"><span>关键资源</span><b>75</b><i><u style={{ width: "75%" }}/></i><em>良好</em></div>
                <div className="score-row"><span>项目运作</span><b>63</b><i><u style={{ width: "63%" }}/></i><em>正常</em></div>
              </div>
              <div className="version-chain">
                <div className="subheading"><h3>标的物版本链</h3><span>最新一致性检查</span></div>
                <div className="version-flow">
                  <button onClick={() => toast("客户需求 V3.1 已冻结")}><small>客户需求</small><b>V3.1</b><em>已冻结</em></button><i>→</i>
                  <button onClick={() => toast("核价方案 V2.4 已批准")}><small>核价方案</small><b>V2.4</b><em>已批准</em></button><i>→</i>
                  <button className="version-warning" onClick={() => toast("投标方案存在 1 项待批偏差")}><small>投标方案</small><b>V1.8</b><em>待评审</em></button>
                </div>
                <div className="consistency"><span><b>12</b> 项一致</span><span className="warning"><b>1</b> 项待授权偏差</span><button onClick={() => toast("已打开三版本一致性矩阵")}>查看一致性矩阵 →</button></div>
              </div>
              <div className="next-action">
                <div className="subheading"><h3>关键下一步</h3><span className="danger-text">距交标 2 天</span></div>
                <b>{selected.next}</b>
                <p>Owner：{selected.owner} · 来源：{selected.source}</p>
                <button onClick={() => toast("行动状态已更新，相关人员将收到提醒")}>更新行动状态</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setShowCreate(false)} aria-label="关闭">×</button>
            <span className="section-kicker">NEW SALES PROJECT</span>
            <h2 id="create-title">建立销售项目</h2>
            <p>从一笔明确采购意向开始，系统将继承线索上下文并检查重复项目。</p>
            <div className="wizard-steps"><b>1 采购意向</b><span>2 基本信息</span><span>3 标的物</span><span>4 资源计划</span><span>5 提交审批</span></div>
            <label>采购意向类型<select defaultValue="客户 RFQ"><option>客户 RFQ</option><option>正式标书</option><option>直接谈判</option><option>渠道机会</option><option>增购</option></select></label>
            <label>客户名称<input placeholder="输入客户名称，系统将匹配客户主数据" /></label>
            <label>采购意向证据<textarea placeholder="填写客户联系人、需求描述，或上传标书/RFQ 作为证据" rows={3}/></label>
            <div className="modal-actions"><button onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" onClick={() => { setShowCreate(false); toast("采购意向已校验，可继续填写项目基本信息"); }}>校验并继续 →</button></div>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
