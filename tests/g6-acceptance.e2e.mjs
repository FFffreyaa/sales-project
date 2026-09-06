import assert from "node:assert/strict";

const baseUrl = process.argv[3] ?? process.env.QJ_ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3020";
const sales = "sales-chen";
const manager = "manager-zhou";
const integrationKey = "qj-local-integration-lab";
let sequence = 0;

function eventId(label) {
  sequence += 1;
  return `G6-${sequence}-${label}-${crypto.randomUUID()}`;
}

async function request(path, { actor, body, expected = 200, integration = false } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "connection": "close",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(actor ? { "x-demo-actor-id": actor } : {}),
      ...(integration ? { "x-integration-key": integrationKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(response.status, expected, `${path} expected ${expected}, received ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function externalTasks(projectCode) {
  const state = await request("/api/integration/lab/tasks", { integration: true });
  return state.tasks.filter(task => task.project_code === projectCode);
}

async function latestTask(projectCode, taskType, status) {
  const tasks = await externalTasks(projectCode);
  const task = tasks.find(item => item.task_type === taskType && (!status || item.status === status));
  assert.ok(task, `missing ${taskType}${status ? ` (${status})` : ""} for ${projectCode}`);
  return task;
}

async function integrationEvent(task, eventType, data, evidenceRefs = [], fixedEventId) {
  const envelope = {
    eventId: fixedEventId ?? eventId(eventType),
    eventType,
    sourceSystem: task.target_system,
    environment: "demo",
    simulated: true,
    projectCode: task.project_code,
    externalTaskId: task.external_task_id,
    actorId: task.assignee_external_id,
    occurredAt: new Date().toISOString(),
    data,
    evidenceRefs,
  };
  const result = await request("/api/integration/lab/events", { body: envelope, integration: true, expected: 202 });
  return { envelope, result };
}

async function bidRoundEvent(projectCode, eventType, data, { expected = 202, fixedEventId } = {}) {
  const envelope = {
    eventId: fixedEventId ?? eventId(eventType),
    eventType,
    sourceSystem: "BID_MANAGEMENT_SIMULATOR",
    environment: "demo",
    simulated: true,
    projectCode,
    actorId: "bid-specialist-sun",
    occurredAt: new Date().toISOString(),
    data,
    evidenceRefs: data.evidenceRef ? [data.evidenceRef] : [],
  };
  return { envelope, response: await request("/api/integration/bid/events", { body: envelope, integration: true, expected }) };
}

function leadEnvelope(label) {
  const stamp = `${Date.now()}-${sequence}-${label}`;
  return {
    eventId: eventId(`LEAD-${label}`), eventType: "LeadQualifiedForConversion", sourceSystem: "LEAD_MANAGEMENT_SIMULATOR", environment: "demo", simulated: true, occurredAt: new Date().toISOString(),
    lead: { id: `LEAD-${stamp}`, code: `L-${stamp}`, type: "tender", category: "项目线索", grade: "A", authenticityStatus: "verified", sourceChannel: "验收模拟", assignedOwnerExternalId: "sales-chen", assignedOwnerName: "陈晨" },
    opportunity: { projectName: `线索验收项目-${stamp}`, customerName: `线索验收客户-${stamp}`, finalCustomerName: `线索验收最终客户-${stamp}`, productScope: "110kV变压器", amount: { type: "exact", minYuan: 1200000, currency: "CNY" }, procurementMethod: "tender", requestingPartyName: `线索验收客户-${stamp}`, requestingPartyRole: "end_customer", submissionRecipientName: `线索验收客户-${stamp}`, requestRef: `REQ-${stamp}`, requestDate: "2026-08-24", tenderNo: `TENDER-${stamp}`, lotNo: "LOT-01", deliveryLocation: "浙江省杭州市", submissionDeadline: "2026-12-31", customerMaster: { code: `CUST-${stamp}`, matchStatus: "matched" } },
    initialRequirement: { originalText: "客户拟采购110kV变压器，具体容量和交付条件待澄清", productRequirement: "110kV变压器", unknowns: ["容量待澄清", "交付条件待澄清"], knownConstraints: ["交付地点：浙江省杭州市"], sourceRefs: [`LEAD-EVIDENCE-${stamp}`] },
    evidenceRefs: [`LEAD-EVIDENCE-${stamp}`],
    competitors: [{ name: "验收竞对", relationship: "已参与前期交流", sourceRef: `COMP-${stamp}` }],
    keyRoles: [{ name: "验收决策人", position: "采购负责人", role: "商务决策人", coverageStatus: "已识别", sourceRef: `ROLE-${stamp}` }],
    partners: [{ name: "验收伙伴", partnerType: "设计院", relationship: "待核实", sourceRef: `PARTNER-${stamp}` }],
    contacts: [{ name: "验收联系人", position: "项目经理", verification: "线索侧记录" }],
    followups: [{ occurredAt: "2026-08-24", summary: "客户表示将在本季度启动采购" }],
    attachments: [{ name: "线索采购证据", type: "tender_notice", source: "LEAD_MANAGEMENT_SIMULATOR", ref: `LEAD-EVIDENCE-${stamp}` }],
    fieldProvenance: { projectName: "lead.projectName", customerName: "lead.customerName" },
  };
}

async function sendLeadEnvelope(envelope, expected = 202) {
  return request("/api/integration/lead/events", { body: envelope, integration: true, expected });
}

async function acceptTask(task) {
  return integrationEvent(task, "ExternalTaskAccepted", { accepted: true });
}

async function projectView(projectCode) {
  const response = await request("/api/p0/projects", { actor: sales, integration: true });
  const project = response.projects.find(item => item.project_code === projectCode);
  assert.ok(project, `project ${projectCode} not visible to owner`);
  return project;
}

function activityFor(project, definitionCode) {
  const activity = project.activity_records.find(item => item.definitionCode === definitionCode);
  assert.ok(activity, `missing ${definitionCode} for ${project.project_code}`);
  return activity;
}

async function createProject(label, scenarioCode = "SCN-01-DIRECT-BID", sourceCustomerOverride = "") {
  const stamp = `${label}-${Date.now()}-${sequence}`;
  const isEpcScenario = ["SCN-02-EPC-INQUIRY", "SCN-04-OVERSEAS-PARTNER-EPC"].includes(scenarioCode);
  const isOverseas = scenarioCode === "SCN-04-OVERSEAS-PARTNER-EPC";
  const created = await request("/api/p0/projects", {
    actor: sales,
    integration: true,
    expected: 201,
    body: {
      scenarioCode,
      evidence: `验收采购文件-${stamp}`,
      finalCustomer: `G6验收最终客户-${stamp}`,
      sourceCustomer: sourceCustomerOverride || (isEpcScenario ? `G6验收EPC/伙伴-${stamp}` : `G6验收最终客户-${stamp}`),
      procurementProjectName: `G6验收采购项目-${stamp}`,
      requestRef: `REQ-${stamp}`,
      requestDate: "2026-08-23",
      tenderNo: `TENDER-${stamp}`,
      lotNo: "LOT-01",
      deliveryLocation: "浙江省杭州市",
      projectCountry: isOverseas ? "印度尼西亚" : "中国",
      deliveryCountry: isOverseas ? "印度尼西亚" : "中国",
      inquiryBatch: isEpcScenario ? `BATCH-${stamp}` : "",
      target: `110kV变压器-${stamp}`,
      amount: 1200000,
      bidDate: "2026-12-31",
      projectGrade: "A",
      organization: "销售一部",
      requirementDate: "2026-09-01",
      technicalDate: "2026-09-10",
      costingDate: "2026-09-20",
      firstAction: "完成受控业务流验收",
    },
  });
  await request("/api/p0/gates/decision", { actor: manager, body: { gateId: created.gateId, action: "approve", comment: "验收立项通过", projectGrade: "A", gradeReason: "客户采购事实、预计金额和交付复杂度支持A等级。", gradeEvidence: `G1-GRADE-${created.projectCode}` } });
  const project = await projectView(created.projectCode);
  for (const code of ["ACT-SPM-02", "ACT-SPM-03", "ACT-SPM-04"]) assert.equal(activityFor(project, code).status, "in_progress");
  return created.projectCode;
}

async function verifyActivityStateMachine() {
  const projectCode = await createProject("activity-state");
  let project = await projectView(projectCode);
  let activity = project.activity_records.find(item => item.definitionCode === "ACT-SPM-05");
  assert.ok(activity, "project creation must persist ACT-SPM-05");
  assert.equal(activity.status, "planned");
  assert.equal(activity.version, 1);

  await request("/api/p0/activities/transition", {
    actor: sales,
    expected: 409,
    body: { projectCode, activityId: activity.id, input: { commandId: eventId("activity-illegal-complete"), command: "complete", expectedVersion: activity.version, reason: "不允许跳过开始", result: "错误完成", evidenceRef: "EVIDENCE-ILLEGAL" } },
  });

  const startCommandId = eventId("activity-start");
  let response = await request("/api/p0/activities/transition", {
    actor: sales,
    body: { projectCode, activityId: activity.id, input: { commandId: startCommandId, command: "start", expectedVersion: activity.version, reason: "已确认行动目标并开始执行" } },
  });
  assert.equal(response.activity.status, "in_progress");
  assert.equal(response.activity.version, 2);
  assert.ok(response.activity.actualStart);
  const duplicate = await request("/api/p0/activities/transition", {
    actor: sales,
    body: { projectCode, activityId: activity.id, input: { commandId: startCommandId, command: "start", expectedVersion: 1, reason: "已确认行动目标并开始执行" } },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.activity.version, 2);
  await request("/api/p0/activities/transition", {
    actor: sales,
    expected: 409,
    body: { projectCode, activityId: activity.id, input: { commandId: startCommandId, command: "start", expectedVersion: 1, reason: "恶意或错误复用同一命令编号" } },
  });

  response = await request("/api/p0/activities/transition", {
    actor: sales,
    body: { projectCode, activityId: activity.id, input: { commandId: eventId("activity-block"), command: "block", expectedVersion: 2, reason: "等待客户书面确认关键接口", evidenceRef: `BLOCKER-${projectCode}` } },
  });
  assert.equal(response.activity.status, "blocked");
  assert.equal(response.activity.version, 3);

  await request("/api/p0/activities/transition", {
    actor: sales,
    expected: 409,
    body: { projectCode, activityId: activity.id, input: { commandId: eventId("activity-blocked-complete"), command: "complete", expectedVersion: 3, reason: "阻塞状态不能直接完成", result: "错误完成", evidenceRef: "EVIDENCE-ILLEGAL-2" } },
  });

  response = await request("/api/p0/activities/transition", {
    actor: sales,
    body: { projectCode, activityId: activity.id, input: { commandId: eventId("activity-resume"), command: "resume", expectedVersion: 3, reason: "客户已经书面确认接口", evidenceRef: `RECOVERY-${projectCode}` } },
  });
  assert.equal(response.activity.status, "in_progress");
  assert.equal(response.activity.version, 4);

  response = await request("/api/p0/activities/transition", {
    actor: sales,
    body: { projectCode, activityId: activity.id, input: { commandId: eventId("activity-complete"), command: "complete", expectedVersion: 4, reason: "行动目标和验收条件均已达到", result: "客户关键接口已书面确认并完成项目记录", evidenceRef: `COMPLETION-${projectCode}` } },
  });
  assert.equal(response.activity.status, "completed");
  assert.equal(response.activity.version, 5);
  assert.ok(response.activity.evidenceRefs.includes(`BLOCKER-${projectCode}`));
  assert.ok(response.activity.evidenceRefs.includes(`RECOVERY-${projectCode}`));
  assert.ok(response.activity.evidenceRefs.includes(`COMPLETION-${projectCode}`));
  project = await projectView(projectCode);
  activity = project.activity_records.find(item => item.id === activity.id);
  assert.equal(activity.status, "completed");
  assert.equal(activity.version, 5);
  return projectCode;
}

async function prepareS4(label, { epcCustomers = [], scenarioCode = "SCN-01-DIRECT-BID", exerciseReviewRemediation = false, exerciseDeviationAuthorization = false, exerciseG2SourceMutation = false, exerciseG4ContextControl = false, exerciseG4RouteMutation = false } = {}) {
  const isEpc = epcCustomers.length > 0;
  const effectiveScenarioCode = isEpc && scenarioCode !== "SCN-04-OVERSEAS-PARTNER-EPC" ? "SCN-02-EPC-INQUIRY" : scenarioCode;
  const isDirectRfq = effectiveScenarioCode === "SCN-03-DIRECT-RFQ";
  const projectCode = await createProject(label, effectiveScenarioCode, isEpc ? epcCustomers[0] : "");
  const bidPreparationTask = await latestTask(projectCode, "BID_PREPARATION", "pending");
  const bidPreparationRequest = JSON.parse(bidPreparationTask.request_payload);
  await acceptTask(bidPreparationTask);
  await integrationEvent(bidPreparationTask, "BidPreparationCompleted", {
    sourceType: bidPreparationRequest.sourceType,
    sourceRef: bidPreparationRequest.sourceRef,
    sourceVersion: "V1",
    sourceHash: `SHA256-${projectCode}`,
    technicalRequirements: "110kV变压器主要技术参数、质量标准和试验要求",
    commercialRequirements: "交付日期、付款条款、质保和违约责任边界",
    evaluationCriteria: "技术、商务、交付和服务综合评审",
    qualificationRequirements: "制造资质、型式试验和类似业绩满足采购要求",
    identifiedRisks: "关键参数变更、交期压缩及竞争性低价风险",
    bidStrategy: "按采购边界组织技术与商务响应，所有对外承诺受价格授权和专业评审约束",
    workPlan: [
      { task: "完成采购文件拆解和需求缺口清单", ownerRole: "投标专员", dueDate: "2026-09-05" },
      { task: "完成需求、方案与BOM专业作业", ownerRole: "技术负责人", dueDate: "2026-09-10" },
    ],
    evidenceRef: `BID-PREP-${projectCode}`,
  }, [bidPreparationRequest.sourceRef, `BID-PREP-${projectCode}`]);
  const epcRoutes = isEpc ? ["INITIAL-EPC-ROUTE"] : [];
  for (const [index, epcCustomer] of epcCustomers.slice(1).entries()) {
    const route = await request("/api/p0/epc-routes", {
      actor: sales,
      expected: 201,
      body: { projectCode, action: "route.create", input: { epcCustomer, inquiryRef: `EPC-INQUIRY-${projectCode}-${index + 1}`, inquiryDate: "2026-08-23", evidenceRef: `EPC-EVIDENCE-${projectCode}-${index + 1}` } },
    });
    epcRoutes.push(route.routeId);
  }
  await request("/api/p0/s1-facts", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "strategy.save", input: {
      decisionPreference: "技术、交期、价格综合最优",
      objective: "在满足客户采购边界和授权条件下形成可执行的赢单方案",
      competitiveAssessment: "存在两家同类竞争方，需以技术可靠性与交付能力形成差异化",
      valueProposition: "以成熟产品方案、可验证交付能力和全生命周期服务降低客户采购风险",
      relationshipPlan: "覆盖技术评审、商务决策和高层支持三层关系，并按证据持续更新",
      resourcePlan: "先配置技术负责人，后续按场景启动商务、投标与专业评审资源",
      winPath: "先完成需求边界和关键关系确认，再形成技术基线、价格授权与受控提交",
      requirementScope: "当前已知110kV变压器技术规范、交期与商务边界；详细参数在S2澄清并基线化",
      keyRisks: "客户关键参数变化、交期压缩和竞争对手低价策略",
      nonBidConsequence: "若不投/不报，将失去本轮采购机会并影响该客户后续同类项目覆盖，但可避免无授权价格和交付风险。",
      evidenceRef: `STRATEGY-${projectCode}`,
    } },
  });
  await request("/api/p0/s1-facts", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "relationship.create", input: { layer: "技术层", name: "王工", title: "客户技术负责人", attitude: "中立", influence: "高", owner: "陈晨", evidence: `REL-${projectCode}`, lastTouch: "2026-08-22" } },
  });
  const resourceState = await projectView(projectCode);
  const existingTechnicalRequest = resourceState.resource_request_records?.some(item => item.role_name === "技术负责人" && ["pending", "assigned"].includes(item.status));
  if (!existingTechnicalRequest) {
    await request("/api/p0/resources", {
      actor: sales,
      expected: 201,
      body: { projectCode, action: "request", input: { roleName: "技术负责人", requirement: "负责需求解读、技术方案与偏差闭环", requiredBy: "2026-08-25", evidenceRef: `RESOURCE-REQUEST-${projectCode}` } },
    });
  }
  const candidate = await request("/api/p0/s1-facts", {
    actor: manager,
    expected: 201,
    body: { projectCode, action: "resource.candidate", input: { roleName: "技术负责人", candidateName: "赵工", sourceSystem: "DEMO_IDENTITY_DIRECTORY", sourceRef: "technical-zhao", capabilities: ["变压器技术方案", "需求澄清", "报价设计BOM"], loadPercent: 55, activeProjectCount: 3, availableFrom: "2026-08-25", evidenceRef: `RESOURCE-CANDIDATE-${projectCode}` } },
  });
  await request("/api/p0/s1-facts", {
    actor: manager,
    body: { projectCode, action: "resource.upsert", input: { candidateId: candidate.candidate.id, roleName: "技术负责人", assigneeName: "赵工", status: "待接受", required: true, evidenceRef: `RESOURCE-${projectCode}` } },
  });
  const technicalTask = await latestTask(projectCode, "TECHNICAL_COLLABORATION", "pending");
  await acceptTask(technicalTask);
  await integrationEvent(technicalTask, "SolutionPreparationCompleted", {
    requirementGaps: "客户需求边界已列明，无未识别缺口",
    technicalDifficulty: "常规成熟方案",
    solutionResourceNeeds: "配置一名技术负责人和一名设计工程师",
    evidenceRef: `PREP-${projectCode}`,
  }, [`PREP-${projectCode}`]);
  let g2 = await request("/api/p0/gates/g2/submission", { actor: sales, expected: 201, body: { projectCode } });
  if (exerciseG2SourceMutation) {
    await request("/api/p0/s1-facts", {
      actor: sales,
      expected: 201,
      body: { projectCode, action: "relationship.create", input: { layer: "商务决策链", name: "李经理", title: "采购决策人", attitude: "支持", influence: "高", owner: "陈晨", evidence: `REL-CHANGED-${projectCode}`, lastTouch: "2026-08-24" } },
    });
    await request("/api/p0/gates/g2/decision", { actor: manager, expected: 409, body: {
      gateId: g2.gateId,
      action: "approve",
      comment: "错误地尝试沿用已变化的来源快照。",
      investmentScope: "启动专业工作。",
      priorityAndDeadline: "A级优先。",
    } });
    await request("/api/p0/gates/g2/decision", { actor: manager, body: { gateId: g2.gateId, action: "return", comment: "客户决策关系已变化，请按当前事实重新冻结。", returnItems: "重新汇总客户决策链并重提G2。" } });
    g2 = await request("/api/p0/gates/g2/submission", { actor: sales, expected: 201, body: { projectCode } });
  }
  await request("/api/p0/gates/g2/decision", { actor: manager, body: {
    gateId: g2.gateId,
    action: "approve",
    comment: "投入启动来源齐套，同意按冻结范围进入需求与技术基线阶段。",
    investmentScope: "启动客户需求澄清、正式需求基线、技术方案和报价设计BOM专业作业。",
    priorityAndDeadline: "A级优先；按投标准备计划完成，关键技术基线最迟2026-09-10形成。",
  } });
  const afterG2 = await projectView(projectCode);
  assert.equal(activityFor(afterG2, "ACT-SPM-02").status, "completed");
  assert.equal(activityFor(afterG2, "ACT-SPM-03").status, "in_progress");
  assert.equal(activityFor(afterG2, "ACT-SPM-04").status, "completed");

  await request("/api/p0/s2-facts", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "requirement.save", input: { originalText: "110kV变压器技术规范及交期要求", sourceRef: `REQ-${projectCode}` } },
  });
  const requirementTask = await latestTask(projectCode, "REQUIREMENT_BASELINE_PREPARATION", "pending");
  const solutionTask = await latestTask(projectCode, "TECHNICAL_SOLUTION_PREPARATION", "pending");
  const bomTask = await latestTask(projectCode, "BOM_AND_CLOSURE_PREPARATION", "pending");
  await acceptTask(requirementTask);
  await acceptTask(solutionTask);
  await acceptTask(bomTask);
  const requirementBaselineEvent = await integrationEvent(requirementTask, "RequirementBaselinePrepared", {
    standardizedRequirement: "110kV变压器标准化技术要求",
    sourceRef: `REQ-BASELINE-${projectCode}`,
  }, [`REQ-BASELINE-${projectCode}`]);
  await request("/api/integration/lab/events", { integration: true, expected: 409, body: {
    ...requirementBaselineEvent.envelope,
    eventType: "TechnicalSolutionPrepared",
    occurredAt: new Date().toISOString(),
    data: { designAdoptedValue: "冲突事件不得被误判为幂等重试", criticalParameterStatus: "完整", initialTechnicalSolution: "不应写入", solutionEvidenceRef: `COLLISION-${projectCode}` },
  } });
  await integrationEvent(solutionTask, "TechnicalSolutionPrepared", {
    designAdoptedValue: "采用值与客户要求一致",
    criticalParameterStatus: "完整",
    initialTechnicalSolution: "形成满足当前需求边界的初步技术方案",
    solutionEvidenceRef: `SOLUTION-${projectCode}`,
  }, [`SOLUTION-${projectCode}`]);
  await request("/api/integration/lab/events", { integration: true, expected: 400, body: {
    eventId: eventId("BomAndClosureMissingResponsibility"), eventType: "BomAndClosureCompleted", sourceSystem: bomTask.target_system, environment: "demo", simulated: true,
    projectCode, externalTaskId: bomTask.external_task_id, actorId: bomTask.assignee_external_id, occurredAt: new Date().toISOString(), evidenceRefs: [`BOM-INVALID-${projectCode}`],
    data: { configurationSummary: "缺少问题责任闭环的无效BOM包", bomConfirmationStatus: "confirmed", bomEvidenceRef: `BOM-INVALID-${projectCode}`, clarificationQuestion: "仍需澄清", clarificationResponse: "形式答复", clarificationStatus: "resolved", deviationDescription: "未形成责任处置", deviationStatus: "none", deviationEvidenceRef: `DEVIATION-INVALID-${projectCode}` },
  } });
  await integrationEvent(bomTask, "BomAndClosureCompleted", {
    configurationSummary: "110kV主变及标准附件配置",
    bomConfirmationStatus: "confirmed",
    bomEvidenceRef: `BOM-${projectCode}`,
    clarificationQuestion: "客户要求的关键参数是否完整",
    clarificationResponse: "已根据技术规范逐项核对并确认完整",
    clarificationStatus: "resolved",
    clarificationOwnerRole: "需求/技术问题责任人",
    clarificationClosureEvidenceRef: `CLARIFICATION-CLOSE-${projectCode}`,
    deviationDescription: "当前无技术偏差",
    deviationStatus: "none",
    deviationEvidenceRef: `DEVIATION-${projectCode}`,
    deviationOwnerRole: "方案设计责任人",
    deviationDisposition: "经逐项核对，当前版本无技术偏差",
    deviationClosureEvidenceRef: `DEVIATION-CLOSE-${projectCode}`,
  }, [`SOLUTION-${projectCode}`, `BOM-${projectCode}`, `DEVIATION-${projectCode}`]);
  const g3 = await request("/api/p0/gates/g3/submission", { actor: sales, expected: 201, body: { projectCode } });
  const g3Task = await latestTask(projectCode, "G3_GATE_REVIEW", "pending");
  await integrationEvent(g3Task, "G3DecisionSubmitted", { gateId: g3.gateId, action: "approve", comment: "需求与技术方案达到可核价状态" });

  await request("/api/p0/resources", { actor: manager, expected: 201, body: { projectCode, action: "costing.request" } });
  const costingTask = await latestTask(projectCode, "COSTING_COLLABORATION", "pending");
  await acceptTask(costingTask);
  await integrationEvent(costingTask, "CostingAssessmentCompleted", {
    priceSource: "2026年8月有效采购价格库",
    priceSourceVersion: "2026-08-V1",
    snapshotDate: "2026-08-22",
    validUntil: "2027-01-31",
    currency: "CNY",
    taxBasis: "含13%增值税",
    tradeTerms: "境内含税交付至项目现场",
    priceEvidenceRef: `PRICE-${projectCode}`,
    materialCostYuan: 600000,
    laborCostYuan: 80000,
    manufacturingCostYuan: 90000,
    transportCostYuan: 30000,
    taxCostYuan: 60000,
    riskReserveYuan: 40000,
    costingSalesPriceYuan: 1100000,
    targetProfitRate: 15,
    calculationBasis: "按冻结BOM、价格快照和风险储备测算",
    deliveryAssessment: "可按客户交期交付",
    deliveryRiskConclusion: "交期风险可控",
  }, [`BOM-${projectCode}`, `PRICE-${projectCode}`]);
  const g4 = await request("/api/p0/gates/g4/submission", { actor: sales, expected: 201, body: { projectCode } });
  assert.ok(g4.readiness.pricingAuthorizationRequest.id, "G4 submission must create and freeze an independent price authorization request");
  const g4Task = await latestTask(projectCode, "G4_GATE_REVIEW", "pending");
  if (exerciseG4RouteMutation) {
    await request("/api/p0/epc-routes", { actor: sales, expected: 201, body: { projectCode, action: "route.create", input: { epcCustomer: `冻结后新增EPC-${projectCode}`, inquiryRef: `EPC-AFTER-G4-${projectCode}`, inquiryDate: "2026-08-24", evidenceRef: `EPC-AFTER-G4-EVIDENCE-${projectCode}` } } });
    await request("/api/integration/lab/events", { integration: true, expected: 409, body: {
      eventId: eventId("G4-ROUTE-MUTATED"), eventType: "G4DecisionSubmitted", sourceSystem: g4Task.target_system, environment: "demo", simulated: true, projectCode, externalTaskId: g4Task.external_task_id, actorId: g4Task.assignee_external_id, occurredAt: new Date().toISOString(),
      data: { gateId: g4.gateId, action: "approve", comment: "冻结后新增通路不得沿用旧申请", floorPriceYuan: 1000000, authorizedQuotePriceYuan: 1100000, currency: "CNY", taxBasis: "含13%增值税", tradeTerms: "境内含税交付至项目现场", exceptionConditions: "条件变化时失效", scopeAlignmentConclusion: "范围一致", amountVarianceExplanation: "差异已复核", routeScope: "ALL-EPC-ROUTES", validUntil: "2027-01-31", evidenceRef: `AUTH-ROUTE-MUTATED-${projectCode}` }, evidenceRefs: [`AUTH-ROUTE-MUTATED-${projectCode}`],
    } });
    return projectCode;
  }
  if (exerciseG4ContextControl) {
    await request("/api/integration/lab/events", { integration: true, expected: 409, body: {
      eventId: eventId("G4-CURRENCY-MISMATCH"), eventType: "G4DecisionSubmitted", sourceSystem: g4Task.target_system, environment: "demo", simulated: true, projectCode, externalTaskId: g4Task.external_task_id, actorId: g4Task.assignee_external_id, occurredAt: new Date().toISOString(),
      data: { gateId: g4.gateId, action: "approve", comment: "错误币种不应通过", floorPriceYuan: 1000000, authorizedQuotePriceYuan: 1100000, currency: "USD", taxBasis: "含13%增值税", tradeTerms: "境内含税交付至项目现场", exceptionConditions: "条件变化时失效", scopeAlignmentConclusion: "范围一致", amountVarianceExplanation: "差异已复核", routeScope: isEpc ? "ALL-EPC-ROUTES" : "DIRECT-BID-ROUTE-01", validUntil: "2027-01-31", evidenceRef: `AUTH-INVALID-${projectCode}` }, evidenceRefs: [`AUTH-INVALID-${projectCode}`],
    } });
  }
  await integrationEvent(g4Task, "G4DecisionSubmitted", {
    gateId: g4.gateId,
    action: "approve",
    comment: "核价来源完整，批准价格授权",
    floorPriceYuan: 1000000,
    authorizedQuotePriceYuan: 1100000,
    currency: "CNY",
    taxBasis: "含13%增值税",
    tradeTerms: "境内含税交付至项目现场",
    exceptionConditions: "范围、币种、税费、贸易条件、通路或有效期变化时授权失效并重提",
    scopeAlignmentConclusion: "已核对项目机会范围、需求基线与报价范围一致",
    amountVarianceExplanation: "销售预计金额与本次授权报价口径不同，已按当前数量、配置与通路完成复核",
    routeScope: isEpc ? "ALL-EPC-ROUTES" : "DIRECT-BID-ROUTE-01",
    validUntil: "2027-01-31",
    evidenceRef: `AUTH-${projectCode}`,
  }, [`AUTH-${projectCode}`]);
  if (exerciseG4ContextControl) {
    const afterG4 = await projectView(projectCode);
    assert.equal(afterG4.price_authorization_request_record.status, "decided");
    assert.equal(afterG4.g5_readiness_snapshot.pricingAuthorization.currency, "CNY");
    assert.equal(afterG4.g5_readiness_snapshot.pricingAuthorization.tax_basis, "含13%增值税");
    assert.equal(afterG4.g5_readiness_snapshot.pricingAuthorization.trade_terms, "境内含税交付至项目现场");
    assert.ok(afterG4.g5_readiness_snapshot.pricingAuthorization.exception_conditions);
  }

  const pendingBidTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "BID_PACKAGE_PREPARATION" && task.status === "pending");
  assert.equal(pendingBidTasks.length, isEpc ? epcRoutes.length : 1, "each authorized route must receive one bid-package task");
  for (const [index, bidTask] of pendingBidTasks.entries()) {
    const taskPayload = typeof bidTask.request_payload === "string" ? JSON.parse(bidTask.request_payload) : bidTask.request_payload;
    const routeId = String(taskPayload.routeId ?? "DIRECT-BID-ROUTE-01");
    await acceptTask(bidTask);
    await integrationEvent(bidTask, "BidPackagePrepared", {
      submissionType: isEpc ? "CustomerRouteQuotation" : isDirectRfq ? "DirectQuotation" : "DirectBidSubmission",
      routeId,
      quotedPriceYuan: 1100000,
      packageHash: `PKG-${projectCode.slice(-6)}-${String(index + 1).padStart(4, "0")}`,
      reviewConclusion: "approved",
      openRiskCount: 0,
      deviationConclusion: "none",
      evidenceRef: `BID-REVIEW-${projectCode}-${index + 1}`,
    }, [`BID-REVIEW-${projectCode}-${index + 1}`]);
  }
  const professionalReviewTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "BID_PACKAGE_REVIEW" && task.status === "pending");
  const fullProfessionalReview = ["SCN-01-DIRECT-BID", "SCN-04-OVERSEAS-PARTNER-EPC"].includes(effectiveScenarioCode);
  assert.equal(professionalReviewTasks.length, fullProfessionalReview ? (isEpc ? epcRoutes.length : 1) * 3 : 0, "formal bid and overseas partner/EPC packages require three independent reviews; domestic EPC/RFQ remain conditionally triggered until enterprise thresholds are confirmed");
  for (const [index, reviewTask] of professionalReviewTasks.entries()) {
    const taskPayload = typeof reviewTask.request_payload === "string" ? JSON.parse(reviewTask.request_payload) : reviewTask.request_payload;
    if (exerciseReviewRemediation && index === 0) {
      await integrationEvent(reviewTask, "BidPackageReviewSubmitted", {
        bidPackageVersionId: taskPayload.bidPackageVersionId,
        reviewType: taskPayload.reviewType,
        reviewConclusion: "rejected",
        openRiskCount: 1,
        deviationConclusion: "none",
        reviewSummary: `${taskPayload.reviewLabel}发现一项阻断问题，退回投标包责任人整改。`,
        evidenceRef: `PRO-REVIEW-REJECT-${projectCode}`,
      }, [`PRO-REVIEW-REJECT-${projectCode}`]);
      const remediationTask = await latestTask(projectCode, "BID_REVIEW_REMEDIATION", "pending");
      await acceptTask(remediationTask);
      const remediationPayload = typeof remediationTask.request_payload === "string" ? JSON.parse(remediationTask.request_payload) : remediationTask.request_payload;
      await integrationEvent(remediationTask, "BidReviewRemediationSubmitted", {
        professionalReviewId: remediationPayload.professionalReviewId,
        issueResponse: "已按原评审意见修订投标包支撑材料并完成逐项核对。",
        evidenceRef: `PRO-REVIEW-REMEDIATION-${projectCode}`,
      }, [`PRO-REVIEW-REMEDIATION-${projectCode}`]);
      const reReviewTask = await latestTask(projectCode, "BID_PACKAGE_REVIEW", "pending");
      const reReviewPayload = typeof reReviewTask.request_payload === "string" ? JSON.parse(reReviewTask.request_payload) : reReviewTask.request_payload;
      assert.ok(reReviewPayload.remediationId, "re-review task must freeze the remediation reference");
      await request("/api/integration/lab/events", { integration: true, expected: 403, body: { eventId: eventId("WRONG-REVIEWER"), eventType: "BidPackageReviewSubmitted", sourceSystem: reReviewTask.target_system, environment: "demo", simulated: true, projectCode, externalTaskId: reReviewTask.external_task_id, actorId: "professional-reviewer-wu" === reReviewTask.assignee_external_id ? "bid-technical-reviewer-qian" : "professional-reviewer-wu", occurredAt: new Date().toISOString(), data: { bidPackageVersionId: reReviewPayload.bidPackageVersionId, reviewType: reReviewPayload.reviewType, reviewConclusion: "approved", openRiskCount: 0, deviationConclusion: "none", reviewSummary: "越权复核", evidenceRef: "INVALID" }, evidenceRefs: ["INVALID"] } });
      await integrationEvent(reReviewTask, "BidPackageReviewSubmitted", {
        bidPackageVersionId: reReviewPayload.bidPackageVersionId,
        reviewType: reReviewPayload.reviewType,
        remediationId: reReviewPayload.remediationId,
        reviewConclusion: "approved",
        openRiskCount: 0,
        deviationConclusion: "none",
        reviewSummary: "原评审人已核验整改证据，问题关闭。",
        evidenceRef: `PRO-REVIEW-VERIFY-${projectCode}`,
      }, [`PRO-REVIEW-VERIFY-${projectCode}`]);
      continue;
    }
    const reportsDeviation = exerciseDeviationAuthorization && index === 0;
    await integrationEvent(reviewTask, "BidPackageReviewSubmitted", {
      bidPackageVersionId: taskPayload.bidPackageVersionId,
      reviewType: taskPayload.reviewType,
      reviewConclusion: "approved",
      openRiskCount: 0,
      deviationConclusion: reportsDeviation ? "authorized" : "none",
      reviewSummary: reportsDeviation ? `${taskPayload.reviewLabel}发现交付边界偏差；专业评审仅报告事实，须由G5决策人逐项授权。` : `${taskPayload.reviewLabel}已按冻结提交包完成独立审查，无开放问题。`,
      evidenceRef: `PRO-REVIEW-${projectCode}-${index + 1}`,
    }, [`PRO-REVIEW-${projectCode}-${index + 1}`, taskPayload.packageHash]);
  }
  assert.equal((await projectView(projectCode)).stage, "S4");
  return projectCode;
}

async function verifyG5ReviewRemediation() {
  return prepareSubmittedS5("g5-review-remediation", { exerciseReviewRemediation: true });
}

async function verifyG4PriceContextControl() {
  return prepareS4("g4-price-context", { exerciseG4ContextControl: true });
}

async function verifyG4RouteMutationInvalidation() {
  return prepareS4("g4-route-mutation", { epcCustomers: ["EPC甲", "EPC乙"], exerciseG4RouteMutation: true });
}

async function verifyG2SourceMutationInvalidation() {
  return prepareS4("g2-source-mutation", { exerciseG2SourceMutation: true });
}

async function verifyG5DeviationAuthorization() {
  const projectCode = await prepareS4("g5-deviation", { exerciseDeviationAuthorization: true });
  const before = await projectView(projectCode);
  assert.equal(before.g5_readiness_snapshot.deviationItems.length, 1, "professional review deviation must enter G5 decision snapshot");
  assert.equal(before.g5_readiness_snapshot.items.find(item => item.key === "businessDecisionContext").ready, true, "G5 decision package must contain complete business context");
  assert.ok(before.g5_readiness_snapshot.businessDecisionContext.strategyVersionId);
  assert.ok(before.g5_readiness_snapshot.businessDecisionContext.relationshipCoverage.length > 0);
  assert.ok(before.g5_readiness_snapshot.businessDecisionContext.competitiveAssessment);
  assert.ok(before.g5_readiness_snapshot.businessDecisionContext.nonBidConsequence);
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, expected: 409, body: { gateId: g5.gateId, action: "approve_submit", comment: "不能在未逐项授权偏差时批准" } });
  const deviation = g5.readiness.deviationItems[0];
  await request("/api/p0/gates/g5/decision", { actor: manager, body: {
    gateId: g5.gateId,
    action: "approve_submit",
    comment: "已核对专业偏差、适用提交包和剩余风险，批准在限定范围内投标。",
    deviationAuthorizations: [{
      deviationRef: deviation.ref,
      scope: "仅允许当前冻结提交包中的交付边界差异，不得扩大技术范围或改变授权价格。",
      risk: "客户可能要求恢复原交付边界；由销售Owner在提交前再次书面确认。",
      applicableVersionId: deviation.applicableVersionIds[0],
      validUntil: "2026-12-31",
      evidenceRef: `G5-DEVIATION-AUTH-${projectCode}`,
    }],
  } });
  const approved = await projectView(projectCode);
  assert.equal(approved.g5_readiness_snapshot.deviationAuthorizations.length, 1, "itemized deviation authorization must be readable after decision");
  assert.equal(approved.g5_readiness_snapshot.deviationAuthorizations[0].deviation_ref, deviation.ref);
  assert.equal(approved.g5_readiness_snapshot.deviationAuthorizations[0].authorized_by, manager);
  const submissionTask = await latestTask(projectCode, "G5_SUBMISSION_EXECUTION", "pending");
  assert.ok(submissionTask, "authorized deviation must allow controlled submission task creation");
  return projectCode;
}

async function verifyG5ReturnAndResubmit() {
  const projectCode = await prepareS4("g5-return-resubmit");
  const g5v1 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, expected: 400, body: { gateId: g5v1.gateId, action: "return", comment: "" } });
  const returned = await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5v1.gateId, action: "return", comment: "请补充最终提交包签章证据并确认适用报价通路后重新提交。" } });
  assert.equal(returned.gateStatus, "returned");
  assert.equal(returned.stage, "S4", "G5 return must not change the sales project stage");
  assert.equal((await projectView(projectCode)).stage, "S4");
  const g5v2 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  assert.equal(g5v2.gateId, g5v1.gateId, "G5 resubmission must reuse the same gate identity");
  assert.equal(g5v2.version, g5v1.version + 1, "G5 resubmission must create a new frozen version");
  assert.equal(g5v2.gateStatus, "pending");
  return projectCode;
}

async function prepareSubmittedS5(label, options = {}) {
  const projectCode = await prepareS4(label, options);
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5.gateId, action: "approve_submit", comment: "批准按冻结包正式提交" } });
  const submitTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "G5_SUBMISSION_EXECUTION" && task.status === "pending");
  const expectedRoutes = options.epcCustomers?.length ?? 1;
  assert.equal(submitTasks.length, expectedRoutes, "G5 must issue one controlled submission task per frozen route");
  for (const [index, submitTask] of submitTasks.entries()) {
    await acceptTask(submitTask);
    const submitPayload = typeof submitTask.request_payload === "string" ? JSON.parse(submitTask.request_payload) : submitTask.request_payload;
    await integrationEvent(submitTask, "CommercialSubmissionAccepted", {
      gateId: g5.gateId,
      packageHash: submitPayload.packageHash,
      submittedAt: new Date().toISOString(),
      receiptRef: `SUBMIT-RCPT-${projectCode}-${index + 1}`,
      receiptHash: `SUBMIT-HASH-${projectCode}-${index + 1}`,
    });
    const duringSubmission = await projectView(projectCode);
    if (index < submitTasks.length - 1) assert.equal(duringSubmission.stage, "S4", "first EPC receipt must not advance the whole project");
  }
  const project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(activityFor(project, "ACT-SPM-03").status, "completed");
  assert.equal(activityFor(project, "ACT-SPM-07").status, "in_progress");
  return projectCode;
}

async function verifyG5ResidualRiskAcceptance() {
  const projectCode = await prepareS4("g5-residual-risk");
  const created = await request("/api/p0/risks", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "create", input: { category: "交期", title: "客户最终交期窗口仍有重大不确定性", level: "高", description: "客户尚未书面冻结最终交期窗口", impact: "若窗口提前可能压缩采购与生产周期", ownerName: "陈晨", dueDate: "2026-09-30", evidenceRef: `G5-RISK-${projectCode}` } },
  });
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  assert.equal(g5.readiness.residualHighRisks.length, 1);
  assert.equal(g5.readiness.residualHighRisks[0].id, created.risk.id);
  await request("/api/p0/gates/g5/decision", { actor: manager, expected: 409, body: { gateId: g5.gateId, action: "approve_submit", comment: "拟批准提交但未显式接受风险" } });
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5.gateId, action: "approve_submit", comment: "综合客户价值和当前交期控制方案，决定继续投标", acceptResidualRisks: true, riskAcceptanceReason: "已设置采购提前锁定和生产窗口预留措施；剩余交期影响由项目Owner持续跟踪并在正式承诺前再次核实。" } });
  const project = await projectView(projectCode);
  const risk = project.project_risk_records.find(item => item.id === created.risk.id);
  assert.equal(risk.status, "open", "G5接受剩余风险不能伪造风险关闭");
  assert.equal(project.g5_readiness_snapshot.riskAcceptances.length, 1);
  assert.equal(project.g5_readiness_snapshot.riskAcceptances[0].risk_id, created.risk.id);
  return projectCode;
}

async function verifyEpcG5ControlledReopen() {
  const projectCode = await prepareS4("epc-g5-reopen", { epcCustomers: ["EPC解冻甲公司", "EPC解冻乙公司"] });
  const before = await projectView(projectCode);
  const routeToWithdraw = before.g5_readiness_snapshot.routeReadiness[1].route;
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5.gateId, action: "approve_submit", comment: "批准冻结双通路批次，尚未执行提交" } });
  let submitTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "G5_SUBMISSION_EXECUTION" && task.status === "pending");
  assert.equal(submitTasks.length, 2);
  const reopen = await request("/api/p0/epc-routes", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "g5-reopen.request", input: { changeType: "withdraw_route", routeId: routeToWithdraw.id, reason: "该EPC正式撤回本次询价，原冻结批次范围必须调整", evidenceRef: `EPC-WITHDRAW-NOTICE-${projectCode}` } },
  });
  const duplicate = await request("/api/p0/epc-routes", {
    actor: sales,
    expected: 201,
    body: { projectCode, action: "g5-reopen.request", input: { changeType: "withdraw_route", routeId: routeToWithdraw.id, reason: "重复点击", evidenceRef: `EPC-WITHDRAW-DUP-${projectCode}` } },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.requestId, reopen.requestId);
  const decision = await request("/api/p0/epc-routes", { actor: manager, body: { action: "g5-reopen.decision", requestId: reopen.requestId, decision: "approve", comment: "已核对撤回通知，当前批次尚无任何对客提交回执，同意撤销旧提交授权" } });
  assert.equal(decision.gateStatus, "returned");
  assert.equal(decision.cancelledTaskCount, 2);
  await request("/api/p0/epc-routes", {
    actor: manager,
    expected: 409,
    body: { action: "g5-reopen.decision", requestId: reopen.requestId, decision: "approve", comment: "重复审批应被拒绝" },
  });
  submitTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "G5_SUBMISSION_EXECUTION" && task.status === "cancelled");
  assert.equal(submitTasks.length, 2);
  await request("/api/p0/epc-routes", { actor: sales, body: { projectCode, action: "route.withdraw", routeId: routeToWithdraw.id, reason: "EPC已正式退出本次询价", evidenceRef: `EPC-WITHDRAW-NOTICE-${projectCode}` } });
  let project = await projectView(projectCode);
  assert.equal(project.gate_status, "returned");
  assert.equal(project.g5_reopen_request_record.status, "approved");
  assert.equal(project.g5_readiness_snapshot.routeReadiness.length, 1);
  assert.equal(project.g5_readiness_snapshot.routeReadiness[0].bidPackage.status, "prepared");
  const g5v2 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  assert.equal(g5v2.version, 2);
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5v2.gateId, action: "approve_submit", comment: "按调整后单通路批次重新授权提交" } });
  const newTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "G5_SUBMISSION_EXECUTION" && task.status === "pending");
  assert.equal(newTasks.length, 1);
  project = await projectView(projectCode);
  assert.equal(project.stage, "S4");
  return projectCode;
}

async function verifyEpcReopenBlockedAfterReceipt() {
  const projectCode = await prepareS4("epc-g5-receipt-lock", { epcCustomers: ["EPC回执甲公司", "EPC回执乙公司"] });
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5.gateId, action: "approve_submit", comment: "批准双通路提交" } });
  const submitTasks = (await externalTasks(projectCode)).filter(task => task.task_type === "G5_SUBMISSION_EXECUTION" && task.status === "pending");
  assert.equal(submitTasks.length, 2);
  await acceptTask(submitTasks[0]);
  const payload = typeof submitTasks[0].request_payload === "string" ? JSON.parse(submitTasks[0].request_payload) : submitTasks[0].request_payload;
  await integrationEvent(submitTasks[0], "CommercialSubmissionAccepted", { gateId: g5.gateId, packageHash: payload.packageHash, submittedAt: new Date().toISOString(), receiptRef: `PARTIAL-RCPT-${projectCode}`, receiptHash: `PARTIAL-HASH-${projectCode}` });
  const project = await projectView(projectCode);
  assert.equal(project.stage, "S4");
  await request("/api/p0/epc-routes", { actor: sales, expected: 409, body: { projectCode, action: "g5-reopen.request", input: { changeType: "add_route", routeId: "", reason: "收到新的EPC询价", evidenceRef: `LATE-EPC-${projectCode}` } } });
  return projectCode;
}

async function reportRouteResult(task, resultType, suffix) {
  const payload = typeof task.request_payload === "string" ? JSON.parse(task.request_payload) : task.request_payload;
  await acceptTask(task);
  await integrationEvent(task, "CommercialResultReported", {
    routeId: payload.routeId,
    resultType,
    sourceRef: `ROUTE-RESULT-${task.project_code}-${suffix}`,
    noticeDate: "2026-08-23",
    evidenceRef: `ROUTE-EVIDENCE-${task.project_code}-${suffix}`,
    awardScope: resultType === "won" ? `通路${payload.routeId}中标范围` : "",
    competitorName: resultType === "lost" ? "未披露" : "",
  });
}

async function epcResultTasks(projectCode) {
  const tasks = (await externalTasks(projectCode)).filter(task => task.task_type === "COMMERCIAL_RESULT_TRACKING" && task.status === "pending");
  assert.equal(tasks.length, 2, "two submitted EPC routes must create two result-tracking tasks");
  return tasks;
}

async function verifyEpcMixedResults() {
  const projectCode = await prepareSubmittedS5("epc-mixed", { epcCustomers: ["EPC甲公司", "EPC乙公司"] });
  const tasks = await epcResultTasks(projectCode);
  await reportRouteResult(tasks[0], "won", "MIXED-WON");
  let project = await projectView(projectCode);
  assert.equal(project.result, "pending");
  assert.equal(project.g6_readiness_snapshot.resultAggregationStatus, "pending");
  assert.equal(project.g6_readiness_snapshot.routeResults.length, 1);
  assert.equal(project.g6_readiness_snapshot.pendingRouteIds.length, 1);
  await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 409 });

  await reportRouteResult(tasks[1], "lost", "MIXED-LOST");
  project = await projectView(projectCode);
  assert.equal(project.result, "pending", "external route results cannot bypass G6 manager confirmation");
  assert.equal(project.g6_readiness_snapshot.resultAggregationStatus, "ready");
  assert.equal(project.g6_readiness_snapshot.resultType, "won");
  assert.equal(project.g6_readiness_snapshot.winningRouteIds.length, 1);
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "逐通路结果齐套，确认唯一中标通路并批准移交" } });
  project = await projectView(projectCode);
  assert.equal(project.result, "won");
  assert.equal(project.stage, "S5", "won project remains S5 until contract handover receipt");
  assert.equal(project.gate_execution_status, "executing");
  const contractTask = await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "pending");
  await acceptTask(contractTask);
  const contractPayload = typeof contractTask.request_payload === "string" ? JSON.parse(contractTask.request_payload) : contractTask.request_payload;
  const handover = await integrationEvent(contractTask, "ContractHandoverAccepted", {
    gateId: contractPayload.gateId,
    awardBaselineId: contractPayload.awardBaselineId,
    manifestHash: contractPayload.manifestHash,
    contractRef: `CONTRACT-${projectCode}`,
    receiptRef: `CONTRACT-RCPT-${projectCode}`,
    receiptHash: `CONTRACT-HASH-${projectCode}`,
    receivedAt: new Date().toISOString(),
  }, [`CONTRACT-RCPT-${projectCode}`]);
  assert.equal(handover.result.result.executionStatus, "completed");
  assert.equal(handover.result.result.stage, "S6");
  project = await projectView(projectCode);
  assert.equal(project.stage, "S6");
  assert.equal(activityFor(project, "ACT-SPM-08").status, "in_progress");
  return projectCode;
}

async function verifyEpcAllLost() {
  const projectCode = await prepareSubmittedS5("epc-all-lost", { epcCustomers: ["EPC丙公司", "EPC丁公司"] });
  const tasks = await epcResultTasks(projectCode);
  await reportRouteResult(tasks[0], "lost", "ALL-LOST-1");
  await reportRouteResult(tasks[1], "lost", "ALL-LOST-2");
  let project = await projectView(projectCode);
  assert.equal(project.g6_readiness_snapshot.resultType, "lost");
  assert.equal(project.g6_readiness_snapshot.resultAggregationStatus, "ready");
  await saveReview(projectCode, "EPC全部通路未赢");
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "全部报价通路未赢且复盘齐套，同意关闭" } });
  project = await projectView(projectCode);
  assert.equal(project.result, "lost");
  assert.equal(project.administrative_status, "Closed");
  return projectCode;
}

async function verifyEpcMultipleWinnerConflict() {
  const projectCode = await prepareSubmittedS5("epc-multi-winner", { epcCustomers: ["EPC戊公司", "EPC己公司"] });
  const tasks = await epcResultTasks(projectCode);
  await reportRouteResult(tasks[0], "won", "MULTI-WON-1");
  await reportRouteResult(tasks[1], "won", "MULTI-WON-2");
  let project = await projectView(projectCode);
  assert.equal(project.result, "pending");
  assert.equal(project.g6_readiness_snapshot.resultAggregationStatus, "conflict");
  assert.equal(project.g6_readiness_snapshot.winningRouteIds.length, 2);
  assert.equal(project.g6_readiness_snapshot.resultType, undefined);
  assert.ok(project.g6_readiness_snapshot.items.some(item => item.key === "routeResults" && item.ready === false));
  await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 409 });
  const resultToVerify = project.g6_readiness_snapshot.routeResults[1];
  const correctionRequest = await request("/api/p0/result-corrections", {
    actor: sales,
    expected: 201,
    body: { projectCode, input: { routeResultId: resultToVerify.id, reason: "平台初始公示被误读为钱江入选，申请按正式授标通知复核", evidenceRef: `CORRECTION-REQUEST-${projectCode}` } },
  });
  assert.equal(correctionRequest.routeResultId, resultToVerify.id);
  const duplicateCorrectionRequest = await request("/api/p0/result-corrections", {
    actor: sales,
    expected: 201,
    body: { projectCode, input: { routeResultId: resultToVerify.id, reason: "重复点击不应生成新任务", evidenceRef: `CORRECTION-REQUEST-DUP-${projectCode}` } },
  });
  assert.equal(duplicateCorrectionRequest.duplicate, true);
  assert.equal(duplicateCorrectionRequest.task.id, correctionRequest.task.id);
  assert.equal(duplicateCorrectionRequest.task.created, false);
  const correctionTask = await latestTask(projectCode, "COMMERCIAL_RESULT_TRACKING", "pending");
  const correctionPayload = typeof correctionTask.request_payload === "string" ? JSON.parse(correctionTask.request_payload) : correctionTask.request_payload;
  assert.equal(correctionPayload.mode, "correction");
  assert.equal(correctionPayload.priorRouteResultId, resultToVerify.id);
  await acceptTask(correctionTask);
  await integrationEvent(correctionTask, "CommercialResultReported", {
    routeId: correctionPayload.routeId,
    correctionOfResultId: correctionPayload.priorRouteResultId,
    correctionReason: "正式授标通知确认该EPC未选用钱江，纠正原公示解读",
    resultType: "lost",
    sourceRef: `CORRECTED-RESULT-${projectCode}`,
    noticeDate: "2026-08-24",
    evidenceRef: `CORRECTED-EVIDENCE-${projectCode}`,
    awardScope: "",
    competitorName: "未披露",
  });
  project = await projectView(projectCode);
  assert.equal(project.g6_readiness_snapshot.resultAggregationStatus, "ready");
  assert.equal(project.g6_readiness_snapshot.resultType, "won");
  assert.equal(project.g6_readiness_snapshot.winningRouteIds.length, 1);
  const corrected = project.g6_readiness_snapshot.routeResults.find(item => item.route_id === correctionPayload.routeId);
  assert.equal(corrected.supersedes_result_id, resultToVerify.id);
  assert.match(corrected.correction_reason, /正式授标通知/);
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  assert.equal(g6.readiness.resultType, "won");
  return projectCode;
}

async function saveReview(projectCode, label) {
  return request("/api/p0/gates/g6/review", {
    actor: sales,
    expected: 201,
    body: {
      projectCode,
      reasonCategory: label,
      reasonDetail: `${label}原因已基于正式证据复盘`,
      competitorName: label === "未中标" ? "竞争方A" : "",
      keyGap: "关键差距已识别",
      evidenceRef: `REVIEW-${projectCode}-${label}`,
      improvementAction: "更新策略模板并在下一个项目执行",
      actionOwner: "陈晨",
      dueDate: "2026-12-31",
    },
  });
}

async function verifyLostReturnResubmit() {
  const projectCode = await prepareSubmittedS5("lost");
  const resultTask = await latestTask(projectCode, "COMMERCIAL_RESULT_TRACKING", "pending");
  await acceptTask(resultTask);
  const resultEvent = await integrationEvent(resultTask, "CommercialResultReported", {
    resultType: "lost",
    sourceRef: `RESULT-NOTICE-${projectCode}`,
    noticeDate: "2026-08-22",
    evidenceRef: `RESULT-EVIDENCE-${projectCode}`,
    awardScope: "",
    competitorName: "竞争方A",
  });
  await saveReview(projectCode, "未中标");

  const first = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: first.gateId, action: "return", comment: "请补充复盘行动的可验证结果" } });
  await saveReview(projectCode, "未中标-补充");
  const second = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  assert.equal(second.gateId, first.gateId);
  assert.equal(second.version, 2);
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: second.gateId, action: "approve", comment: "复盘证据齐套，同意关闭" } });

  const duplicate = await request("/api/integration/lab/events", { body: resultEvent.envelope, integration: true, expected: 202 });
  assert.equal(duplicate.duplicate, true);
  const project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(project.result, "lost");
  assert.equal(project.administrative_status, "Closed");
  assert.equal(project.gate_status, "approved");
  assert.equal(project.gate_execution_status, "completed");
  assert.equal(activityFor(project, "ACT-SPM-07").status, "completed");
  assert.ok(project.activity_records.filter(item => ["ACT-SPM-05", "ACT-SPM-06"].includes(item.definitionCode)).every(item => item.status === "completed" || item.status === "cancelled"));
  return projectCode;
}

async function verifyTerminated() {
  const projectCode = await prepareS4("terminated");
  const g5 = await request("/api/p0/gates/g5/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g5/decision", { actor: manager, body: { gateId: g5.gateId, action: "decline", comment: "客户采购计划取消；依据客户书面通知决定不投" } });
  let project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(project.result, "terminated");
  assert.equal(project.administrative_status, "PendingClose");
  assert.equal(activityFor(project, "ACT-SPM-03").status, "completed");
  assert.equal(activityFor(project, "ACT-SPM-07").status, "in_progress");
  await saveReview(projectCode, "终止/不投");
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "终止证据和复盘行动齐套，同意关闭" } });
  project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(project.result, "terminated");
  assert.equal(project.administrative_status, "Closed");
  assert.equal(project.gate_execution_status, "completed");
  assert.equal(activityFor(project, "ACT-SPM-07").status, "completed");
  assert.ok(project.activity_records.filter(item => ["ACT-SPM-05", "ACT-SPM-06"].includes(item.definitionCode)).every(item => item.status === "completed" || item.status === "cancelled"));
  return projectCode;
}

async function verifyWonHashRejection() {
  const projectCode = await prepareSubmittedS5("won-hash");
  const resultTask = await latestTask(projectCode, "COMMERCIAL_RESULT_TRACKING", "pending");
  await acceptTask(resultTask);
  await integrationEvent(resultTask, "CommercialResultReported", {
    resultType: "won",
    sourceRef: `AWARD-NOTICE-${projectCode}`,
    noticeDate: "2026-08-22",
    evidenceRef: `AWARD-EVIDENCE-${projectCode}`,
    awardScope: "110kV主变及标准附件",
    competitorName: "",
  });
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g6/decision", { actor: manager, expected: 400, body: { gateId: g6.gateId, action: "approve", comment: "" } });
  assert.ok(g6.readiness.awardBaselineManifest.priceAuthorization.sourceVersion, "G6 must freeze the authoritative price source version");
  assert.ok(g6.readiness.awardBaselineManifest.priceAuthorization.taxBasis, "G6 must freeze tax basis");
  assert.ok(g6.readiness.awardBaselineManifest.priceAuthorization.tradeTerms, "G6 must freeze trade terms");
  assert.ok(g6.readiness.awardBaselineManifest.finalCommitment.receiptHash, "G6 must freeze the formal submission receipt hash");
  assert.ok(g6.readiness.awardBaselineManifest.finalCommitment.awardScope, "G6 must freeze the awarded scope");
  assert.ok(Array.isArray(g6.readiness.awardBaselineManifest.deviationAuthorizations), "G6 must freeze itemized deviation authorizations");
  const decision = await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "中标事实与承诺血缘齐套，批准移交" } });
  assert.equal(decision.executionStatus, "executing");
  const frozenProject = await projectView(projectCode);
  const frozenDeviations = typeof frozenProject.commercial_award_baseline_record.deviation_snapshot === "string" ? JSON.parse(frozenProject.commercial_award_baseline_record.deviation_snapshot) : frozenProject.commercial_award_baseline_record.deviation_snapshot;
  const frozenCommitment = typeof frozenProject.commercial_award_baseline_record.commitment_snapshot === "string" ? JSON.parse(frozenProject.commercial_award_baseline_record.commitment_snapshot) : frozenProject.commercial_award_baseline_record.commitment_snapshot;
  assert.ok(Array.isArray(frozenDeviations.technicalDeviations));
  assert.ok(Array.isArray(frozenDeviations.deviationAuthorizations));
  assert.equal(frozenCommitment.finalCommitment.awardScope, "110kV主变及标准附件");
  assert.equal(frozenCommitment.priceAuthorization.currency, "CNY");
  const contractTask = await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "pending");
  await acceptTask(contractTask);
  const taskPayload = typeof contractTask.request_payload === "string" ? JSON.parse(contractTask.request_payload) : contractTask.request_payload;
  const wrongHashEnvelope = {
    eventId: eventId("ContractHandoverAccepted-wrong-hash"),
    eventType: "ContractHandoverAccepted",
    sourceSystem: contractTask.target_system,
    environment: "demo",
    simulated: true,
    projectCode,
    externalTaskId: contractTask.external_task_id,
    actorId: contractTask.assignee_external_id,
    occurredAt: new Date().toISOString(),
    data: {
      gateId: taskPayload.gateId,
      awardBaselineId: taskPayload.awardBaselineId,
      manifestHash: "WRONG-MANIFEST-HASH",
      contractRef: `CONTRACT-${projectCode}`,
      receiptRef: `CONTRACT-RCPT-${projectCode}`,
      receiptHash: `CONTRACT-HASH-${projectCode}`,
      receivedAt: new Date().toISOString(),
    },
    evidenceRefs: [`CONTRACT-RCPT-${projectCode}`],
  };
  await request("/api/integration/lab/events", { body: wrongHashEnvelope, integration: true, expected: 409 });
  const accepted = structuredClone(wrongHashEnvelope);
  accepted.eventId = eventId("ContractHandoverAccepted-correct-hash");
  accepted.data.manifestHash = taskPayload.manifestHash;
  await request("/api/integration/lab/events", { body: accepted, integration: true, expected: 202 });
  const project = await projectView(projectCode);
  assert.equal(project.stage, "S6");
  assert.equal(activityFor(project, "ACT-SPM-07").status, "completed");
  assert.equal(activityFor(project, "ACT-SPM-08").status, "in_progress");
  console.log(`PASS wrong contract manifest hash rejected before S6: ${projectCode}`);
}

async function verifyContractDifferenceReturn() {
  const projectCode = await prepareSubmittedS5("contract-return");
  const resultTask = await latestTask(projectCode, "COMMERCIAL_RESULT_TRACKING", "pending");
  await acceptTask(resultTask);
  await integrationEvent(resultTask, "CommercialResultReported", { resultType: "won", sourceRef: `AWARD-${projectCode}`, noticeDate: "2026-08-22", evidenceRef: `AWARD-EVIDENCE-${projectCode}`, awardScope: "110kV主变及标准附件", competitorName: "" });
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, expected: 201, body: { projectCode } });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "中标承诺血缘齐套，批准移交合同APP校验" } });
  const contractTask = await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "pending");
  await acceptTask(contractTask);
  const taskPayload = typeof contractTask.request_payload === "string" ? JSON.parse(contractTask.request_payload) : contractTask.request_payload;
  await integrationEvent(contractTask, "ContractHandoverReturned", { gateId: taskPayload.gateId, awardBaselineId: taskPayload.awardBaselineId, manifestHash: taskPayload.manifestHash, differenceSummary: "合同草案违约责任与最终承诺基线不一致", remediationRequirement: "定位差异来源并形成新的受控基线版本后重新移交", evidenceRef: `CONTRACT-DIFF-${projectCode}` }, [`CONTRACT-DIFF-${projectCode}`]);
  let project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(project.gate_status, "returned");
  assert.equal(project.gate_execution_status, "not_required");
  assert.match(String(project.gate_comment), /合同APP退回/);
  const returnedTask = await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "returned");
  assert.equal(returnedTask.status, "returned");
  await request("/api/p0/gates/g6/submission", { actor: sales, expected: 400, body: { projectCode } });
  const resubmitted = await request("/api/p0/gates/g6/submission", { actor: sales, expected: 201, body: { projectCode, remediation: { resolutionSummary: "已按合同退回意见修正违约责任承诺引用并完成内部确认。", evidenceRef: `CONTRACT-REMEDIATION-${projectCode}` } } });
  assert.equal(resubmitted.version, 2);
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: resubmitted.gateId, action: "approve", comment: "已核对合同退回整改证据，批准新版本重新移交" } });
  const secondContractTask = await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "pending");
  await acceptTask(secondContractTask);
  const secondPayload = typeof secondContractTask.request_payload === "string" ? JSON.parse(secondContractTask.request_payload) : secondContractTask.request_payload;
  await integrationEvent(secondContractTask, "ContractHandoverAccepted", { gateId: secondPayload.gateId, awardBaselineId: secondPayload.awardBaselineId, manifestHash: secondPayload.manifestHash, contractRef: `CONTRACT-${projectCode}-V2`, receiptRef: `CONTRACT-RCPT-${projectCode}-V2`, receiptHash: `CONTRACT-HASH-${projectCode}-V2`, receivedAt: new Date().toISOString() }, [`CONTRACT-RCPT-${projectCode}-V2`]);
  project = await projectView(projectCode);
  assert.equal(project.stage, "S6");
  assert.equal((await latestTask(projectCode, "CONTRACT_HANDOVER_EXECUTION", "completed")).status, "completed");
  console.log(`PASS contract difference return requires remediation, G6 V2 and new handover receipt: ${projectCode}`);
}

async function verifyPostAwardResponsibilities() {
  const preS6ProjectCode = await createProject("g7-before-s6");
  const responsibilityInput = {
    title: "跟踪客户承诺的首批交付协调结论",
    purpose: "持续推动客户与合同团队确认首批交付窗口，不替代合同APP的合同或履约事实",
    ownerName: "陈晨",
    plannedEnd: "2026-12-31",
    evidenceRef: "客户确认邮件或合同APP协调事件引用",
    context: "post_award_responsibility",
  };
  await request("/api/p0/activities", { actor: sales, expected: 409, body: { projectCode: preS6ProjectCode, input: responsibilityInput } });

  const projectCode = await verifyEpcMixedResults();
  await request("/api/p0/activities", { actor: manager, expected: 403, body: { projectCode, input: responsibilityInput } });
  const created = await request("/api/p0/activities", { actor: sales, expected: 201, body: { projectCode, input: responsibilityInput } });
  assert.ok(created.activity.businessObjectRefs.some(item => item.objectType === "PostAwardResponsibility"));
  assert.equal(created.activity.ownerName, "陈晨");
  assert.equal(created.activity.plannedEnd, "2026-12-31");
  assert.match(created.activity.evidenceRefs.join(" "), /客户确认邮件/);

  const started = await request("/api/p0/activities/transition", { actor: sales, body: { projectCode, activityId: created.activity.id, input: { commandId: eventId("g7-responsibility-start"), command: "start", expectedVersion: created.activity.version, reason: "已与客户及合同团队发起协调" } } });
  const completed = await request("/api/p0/activities/transition", { actor: sales, body: { projectCode, activityId: created.activity.id, input: { commandId: eventId("g7-responsibility-complete"), command: "complete", expectedVersion: started.activity.version, reason: "交付窗口已获得书面确认", result: "客户与合同团队已确认首批交付窗口", evidenceRef: `POST-AWARD-CLOSE-${projectCode}` } } });
  assert.equal(completed.activity.status, "completed");
  assert.match(completed.activity.evidenceRefs.join(" "), /POST-AWARD-CLOSE/);
  const project = await projectView(projectCode);
  const persisted = project.activity_records.find(item => item.id === created.activity.id);
  assert.ok(persisted.businessObjectRefs.some(item => item.objectType === "PostAwardResponsibility"));
  assert.equal(project.stage, "S6", "closing a sales responsibility must not infer or pass G7");
  console.log(`PASS S6 post-award responsibility ownership, evidence and no implicit G7 close: ${projectCode}`);
}

async function verifyDirectRfqMainline() {
  const projectCode = await prepareSubmittedS5("direct-rfq", { scenarioCode: "SCN-03-DIRECT-RFQ" });
  let project = await projectView(projectCode);
  assert.equal(project.scenario_code, "SCN-03-DIRECT-RFQ");
  assert.equal(project.g5_readiness_snapshot.bidPackageVersions.length, 1);
  assert.equal(project.g5_readiness_snapshot.bidPackageVersions[0].submission_type, "DirectQuotation");

  const resultTask = await latestTask(projectCode, "COMMERCIAL_RESULT_TRACKING", "pending");
  await acceptTask(resultTask);
  await integrationEvent(resultTask, "CommercialResultReported", {
    resultType: "lost",
    sourceRef: `DIRECT-RFQ-RESULT-${projectCode}`,
    noticeDate: "2026-08-24",
    evidenceRef: `DIRECT-RFQ-EVIDENCE-${projectCode}`,
    awardScope: "",
    competitorName: "客户未披露最终成交方",
  });
  await saveReview(projectCode, "国内客户询价/报价未成交");
  const g6 = await request("/api/p0/gates/g6/submission", { actor: sales, body: { projectCode }, expected: 201 });
  await request("/api/p0/gates/g6/decision", { actor: manager, body: { gateId: g6.gateId, action: "approve", comment: "直接询价结果与复盘证据齐套，同意关闭" } });
  project = await projectView(projectCode);
  assert.equal(project.stage, "S5");
  assert.equal(project.result, "lost");
  assert.equal(project.administrative_status, "Closed");
  return projectCode;
}

async function verifyOverseasPartnerEpcMainline() {
  const projectCode = await prepareSubmittedS5("overseas-partner-epc", { scenarioCode: "SCN-04-OVERSEAS-PARTNER-EPC", epcCustomers: ["雅加达EPC总包商"] });
  const project = await projectView(projectCode);
  const source = JSON.parse(project.source_snapshot);
  assert.equal(project.scenario_code, "SCN-04-OVERSEAS-PARTNER-EPC");
  assert.equal(source.projectCountry, "印度尼西亚");
  assert.equal(source.deliveryCountry, "印度尼西亚");
  assert.equal(project.g5_readiness_snapshot.bidPackageVersions.length, 1);
  assert.equal(project.g5_readiness_snapshot.bidPackageVersions[0].submission_type, "CustomerRouteQuotation");
  assert.equal(Number(project.amount_cents), 120000000, "one overseas project amount must not be multiplied by quotation routes");
  return projectCode;
}

async function verifyBidRoundGovernance() {
  const projectCode = await prepareSubmittedS5("bid-round-governance");
  const initial = await bidRoundEvent(projectCode, "BidRoundRegistered", {
    externalBidId: `BID-${projectCode}-R1`,
    roundType: "initial",
    tenderDocumentRef: `TENDER-DOC-${projectCode}-R1`,
    tenderDocumentVersion: "V1",
    tenderDocumentHash: `TENDER-HASH-${projectCode}-R1`,
    bidDeadline: "2026-12-31",
    evidenceRef: `BID-ROUND-EVIDENCE-${projectCode}-R1`,
  });
  assert.equal(initial.response.result.roundNo, 1);
  assert.equal(initial.response.result.roundStatus, "submitted");
  assert.equal(initial.response.result.requiresLifecycleDecision, false);

  const rebid = await bidRoundEvent(projectCode, "BidRoundRegistered", {
    externalBidId: `BID-${projectCode}-R2`,
    roundType: "rebid",
    tenderDocumentRef: `REBID-DOC-${projectCode}-R2`,
    tenderDocumentVersion: "V2",
    tenderDocumentHash: `REBID-HASH-${projectCode}-R2`,
    bidDeadline: "2027-01-15",
    evidenceRef: `BID-ROUND-EVIDENCE-${projectCode}-R2`,
  });
  assert.equal(rebid.response.result.roundNo, 2);
  assert.equal(rebid.response.result.roundStatus, "on_hold");
  assert.equal(rebid.response.result.requiresLifecycleDecision, true);
  const duplicate = await request("/api/integration/bid/events", { body: rebid.envelope, integration: true, expected: 202 });
  assert.equal(duplicate.duplicate, true);
  await request("/api/integration/bid/events", { body: { ...rebid.envelope, eventType: "BidRoundStatusChanged", occurredAt: new Date().toISOString(), data: { externalBidId: rebid.envelope.data.externalBidId, status: "active", evidenceRef: `COLLISION-${projectCode}` } }, integration: true, expected: 409 });

  await bidRoundEvent(projectCode, "BidRoundStatusChanged", {
    externalBidId: `BID-${projectCode}-R2`,
    status: "active",
    evidenceRef: `REBID-ACTIVATION-${projectCode}-R2`,
  }, { expected: 409 });
  const project = await projectView(projectCode);
  assert.equal(project.stage, "S5", "external rebid event must not silently rewind the sales lifecycle");
  assert.equal(project.bid_round_records.length, 2);
  assert.equal(project.bid_round_records[1].status, "on_hold");
  return projectCode;
}

async function verifyLeadConversionGuards() {
  const source = leadEnvelope("human-confirmation");
  const received = await sendLeadEnvelope(source);
  assert.equal(received.autoConverted, false);
  assert.equal(received.status, "pending_confirmation");
  assert.ok(received.inboxId);
  assert.equal(received.project, undefined, "lead intake must not create a sales project before human confirmation");

  const inbox = await request("/api/p0/lead-conversions", { actor: sales });
  const pending = inbox.find(item => item.id === received.inboxId);
  assert.ok(pending, "qualified lead must appear in the assigned sales owner's conversion inbox");
  assert.equal(pending.status, "pending_confirmation");
  assert.equal(pending.business_context.competitors[0].name, "验收竞对");
  assert.equal(pending.business_context.keyRoles[0].name, "验收决策人");
  assert.equal(pending.business_context.partners[0].name, "验收伙伴");

  const conversionBody = {
    leadConversionId: received.inboxId,
    scenarioCode: "SCN-01-DIRECT-BID",
    evidence: source.evidenceRefs[0],
    finalCustomer: source.opportunity.finalCustomerName,
    sourceCustomer: source.opportunity.requestingPartyName,
    procurementProjectName: source.opportunity.projectName,
    requestRef: source.opportunity.requestRef,
    requestDate: source.opportunity.requestDate,
    tenderNo: source.opportunity.tenderNo,
    lotNo: source.opportunity.lotNo,
    deliveryLocation: source.opportunity.deliveryLocation,
    target: source.opportunity.productScope,
    amount: source.opportunity.amount.minYuan,
    bidDate: source.opportunity.submissionDeadline,
    projectGrade: source.lead.grade,
    organization: "销售一部",
    firstAction: "核实线索侧竞对、关键角色与伙伴候选事实",
    ownerUserId: sales,
    submitG1: false,
  };
  const managerDuplicateCheck = await request("/api/p0/projects/duplicate-check", { actor: manager, body: conversionBody });
  assert.equal(managerDuplicateCheck.duplicate, false, "manager must be allowed to perform pre-conversion duplicate checks");
  const converted = await request("/api/p0/projects", { actor: sales, body: conversionBody, expected: 201 });
  assert.ok(converted.projectCode);
  assert.equal(converted.stage, "S0");
  assert.equal(converted.gateStatus, "draft");
  assert.equal(converted.gateId, undefined, "S0 draft must not create a manager approval task");
  const draft = await projectView(converted.projectCode);
  assert.equal(draft.gate_id, null, "draft must not freeze a G1 snapshot");
  const submitted = await request("/api/p0/gates/g1/submission", { actor: sales, body: { projectCode: converted.projectCode }, expected: 200 });
  assert.equal(submitted.gateStatus, "pending");
  assert.ok(submitted.gateId);
  const project = await projectView(converted.projectCode);
  const detail = JSON.parse(project.detail_snapshot);
  assert.equal(detail.leadCandidateContext.businessContext.competitors[0].name, "验收竞对");
  assert.equal(detail.leadCandidateContext.businessContext.keyRoles[0].name, "验收决策人");
  assert.equal(detail.leadCandidateContext.businessContext.partners[0].name, "验收伙伴");
  assert.equal(project.project_source_link_records.length, 1, "immutable lead provenance must be linked to the project");

  const duplicate = structuredClone(source);
  duplicate.eventId = eventId("LEAD-duplicate-source-id");
  const duplicateResult = await sendLeadEnvelope(duplicate);
  assert.equal(duplicateResult.duplicate, true);
  assert.equal(duplicateResult.projectCode, converted.projectCode);

  const range = leadEnvelope("range");
  range.opportunity.amount = { type: "range", minYuan: 1000000, maxYuan: 1500000, currency: "CNY" };
  const rangeResult = await sendLeadEnvelope(range);
  assert.equal(rangeResult.status, "pending_confirmation");
  assert.equal(rangeResult.autoConverted, false);

  const missingOwner = leadEnvelope("missing-owner");
  delete missingOwner.lead.assignedOwnerExternalId;
  const ownerResult = await sendLeadEnvelope(missingOwner);
  assert.equal(ownerResult.status, "pending_confirmation");

  const missingEvidence = leadEnvelope("missing-evidence");
  missingEvidence.evidenceRefs = [];
  const evidenceResult = await sendLeadEnvelope(missingEvidence);
  assert.equal(evidenceResult.status, "pending_confirmation");

  const unmatchedCustomer = leadEnvelope("unmatched-customer");
  unmatchedCustomer.opportunity.customerMaster = { matchStatus: "unmatched" };
  const customerResult = await sendLeadEnvelope(unmatchedCustomer);
  assert.equal(customerResult.status, "pending_confirmation");
  assert.equal(customerResult.autoConverted, false);
  return converted.projectCode;
}

console.log(`G6 acceptance target: ${baseUrl}`);
if (process.argv[2] === "risk-g5") {
  const projectCode = await verifyG5ResidualRiskAcceptance();
  console.log(`PASS G5 residual high-risk explicit acceptance without false closure: ${projectCode}`);
} else if (process.argv[2] === "g4-context") {
  const projectCode = await verifyG4PriceContextControl();
  console.log(`PASS G4 source version, authorization request, currency/tax/trade context and mismatch rejection: ${projectCode}`);
} else if (process.argv[2] === "g4-route-mutation") {
  const projectCode = await verifyG4RouteMutationInvalidation();
  console.log(`PASS G4 frozen route scope invalidates after a new EPC route is added: ${projectCode}`);
} else if (process.argv[2] === "g2-source-mutation") {
  const projectCode = await verifyG2SourceMutationInvalidation();
  console.log(`PASS G2 frozen business sources invalidate after customer relationship changes: ${projectCode}`);
} else if (process.argv[2] === "g5-remediation") {
  const projectCode = await verifyG5ReviewRemediation();
  console.log(`PASS G5 rejected review remediation and original-reviewer verification: ${projectCode}`);
} else if (process.argv[2] === "g5-deviation") {
  const projectCode = await verifyG5DeviationAuthorization();
  console.log(`PASS G5 professional deviation requires itemized authorization in the same decision: ${projectCode}`);
} else if (process.argv[2] === "g5-return") {
  const projectCode = await verifyG5ReturnAndResubmit();
  console.log(`PASS G5 return requires a reason, stays in S4 and resubmits the same Gate as a new version: ${projectCode}`);
} else if (process.argv[2] === "win-hash") {
  await verifyWonHashRejection();
} else if (process.argv[2] === "contract-return") {
  await verifyContractDifferenceReturn();
} else if (process.argv[2] === "g7-responsibility") {
  await verifyPostAwardResponsibilities();
} else if (process.argv[2] === "direct-bid-lost") {
  const projectCode = await verifyLostReturnResubmit();
  console.log(`PASS direct bid lost + return/resubmit + permission + idempotency: ${projectCode}`);
} else if (process.argv[2] === "direct-bid-terminated") {
  const projectCode = await verifyTerminated();
  console.log(`PASS direct bid terminated/no-bid + administrative close: ${projectCode}`);
  await request("/api/p0/gates/g6/submission", { actor: manager, body: { projectCode }, expected: 403 });
  console.log("PASS G6 submission role boundary: manager cannot submit as project owner");
} else if (process.argv[2] === "epc") {
  const reopenProject = await verifyEpcG5ControlledReopen();
  console.log(`PASS EPC G5 controlled reopen before any formal receipt: ${reopenProject}`);
  const receiptLockedProject = await verifyEpcReopenBlockedAfterReceipt();
  console.log(`PASS EPC G5 reopen blocked after first formal receipt: ${receiptLockedProject}`);
  const mixedProject = await verifyEpcMixedResults();
  console.log(`PASS EPC mixed won/lost aggregation and G6 handover branch: ${mixedProject}`);
  const allLostProject = await verifyEpcAllLost();
  console.log(`PASS EPC all-lost aggregation and administrative close: ${allLostProject}`);
  const conflictProject = await verifyEpcMultipleWinnerConflict();
  console.log(`PASS EPC multiple-winner conflict blocks G6 and formal correction reopens it: ${conflictProject}`);
} else if (process.argv[2] === "epc-all-lost") {
  const projectCode = await verifyEpcAllLost();
  console.log(`PASS EPC all-lost aggregation and administrative close: ${projectCode}`);
} else if (process.argv[2] === "epc-conflict") {
  const projectCode = await verifyEpcMultipleWinnerConflict();
  console.log(`PASS EPC multiple-winner conflict blocks G6 and formal correction reopens it: ${projectCode}`);
} else if (process.argv[2] === "direct-rfq") {
  const projectCode = await verifyDirectRfqMainline();
  console.log(`PASS direct RFQ uses DirectQuotation and completes lost/close mainline: ${projectCode}`);
} else if (process.argv[2] === "overseas-epc") {
  const projectCode = await verifyOverseasPartnerEpcMainline();
  console.log(`PASS overseas partner/EPC preserves country facts and uses CustomerRouteQuotation: ${projectCode}`);
} else if (process.argv[2] === "bid-round") {
  const projectCode = await verifyBidRoundGovernance();
  console.log(`PASS bid round binding, idempotency and lifecycle hold: ${projectCode}`);
} else if (process.argv[2] === "lead") {
  const projectCode = await verifyLeadConversionGuards();
  console.log(`PASS lead inbox, human-confirmed conversion, provenance and duplicate guards: ${projectCode}`);
} else {
  const activityProject = await verifyActivityStateMachine();
  console.log(`PASS activity state machine + idempotency + evidence: ${activityProject}`);
  const lostProject = await verifyLostReturnResubmit();
  console.log(`PASS lost + return/resubmit + permission + idempotency: ${lostProject}`);
  const terminatedProject = await verifyTerminated();
  console.log(`PASS terminated/no-bid + administrative close: ${terminatedProject}`);
  // Keep the expected 403 last: Wrangler 4.124 on Windows can terminate its local
  // proxy after a rejected request, although the application response is correct.
  await request("/api/p0/gates/g6/submission", { actor: manager, body: { projectCode: terminatedProject }, expected: 403 });
  console.log("PASS G6 submission role boundary: manager cannot submit as project owner");
}
