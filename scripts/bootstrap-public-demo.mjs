const baseUrl = process.env.PUBLIC_DEMO_BASE_URL;
if (!baseUrl?.startsWith("https://")) throw new Error("PUBLIC_DEMO_BASE_URL 必须是 HTTPS 站点。");

const today = new Date().toISOString();
const requestDate = today.slice(0, 10);
const daysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const samples = [
  { id: "DIRECT-BID", scenarioCode: "SCN-01-DIRECT-BID", grade: "A", projectName: "公开演示｜110kV主变采购", customer: "华东某省电网公司", finalCustomer: "华东某省电网公司", target: "110kV主变压器2台", amount: 8_500_000, requestRef: "DEMO-TENDER-001", tenderNo: "DEMO-TENDER-001", deliveryLocation: "华东地区项目现场", bidDate: daysFromNow(28) },
  { id: "EPC-INQUIRY", scenarioCode: "SCN-02-EPC-INQUIRY", grade: "S", projectName: "公开演示｜新能源升压站设备询价", customer: "某工程设计院EPC项目部", finalCustomer: "华北某新能源项目业主", target: "220kV升压变压器及配套设备", amount: 12_000_000, requestRef: "DEMO-EPC-RFQ-001", inquiryBatch: "DEMO-EPC-BATCH-001", deliveryLocation: "华北地区项目现场", bidDate: daysFromNow(35) },
  { id: "DIRECT-RFQ", scenarioCode: "SCN-03-DIRECT-RFQ", grade: "B", projectName: "公开演示｜园区配电变压器询价", customer: "华南某制造企业", finalCustomer: "华南某制造企业", target: "10kV干式变压器及配套柜体", amount: 4_200_000, requestRef: "DEMO-DIRECT-RFQ-001", deliveryLocation: "华南某工业园区", bidDate: daysFromNow(21) },
  { id: "OVERSEAS-EPC", scenarioCode: "SCN-04-OVERSEAS-PARTNER-EPC", grade: "A", projectName: "公开演示｜海外电力项目EPC询价", customer: "某国际工程EPC项目部", finalCustomer: "东南亚某电力项目业主", target: "海外变电站主变及属地服务", amount: 18_000_000, requestRef: "DEMO-OVERSEAS-EPC-001", inquiryBatch: "DEMO-OVERSEAS-BATCH-001", deliveryLocation: "印度尼西亚某项目现场", projectCountry: "印度尼西亚", deliveryCountry: "印度尼西亚", bidDate: daysFromNow(45) },
];

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${path}: 线上版本尚未提供该 API（HTTP ${response.status}）`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${body.error ?? response.status}`);
  return body;
}

for (const sample of samples) {
  const eventId = `PUBLIC-DEMO-SEED-V1-${sample.id}`;
  const leadResult = await request("/api/integration/lead/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-integration-key": "qj-local-integration-lab" },
    body: JSON.stringify({
      eventId,
      eventType: "LeadQualifiedForConversion",
      sourceSystem: "LEAD_MANAGEMENT_SIMULATOR",
      environment: "demo",
      simulated: true,
      occurredAt: today,
      lead: {
        id: eventId,
        code: `DEMO-LEAD-${sample.id}`,
        type: sample.scenarioCode === "SCN-01-DIRECT-BID" ? "tender" : "demand",
        category: "项目线索",
        grade: sample.grade,
        score: 80,
        authenticityStatus: "manual_confirmed",
        authenticityBasis: "公开演示专用脱敏样本，不代表真实客户或真实商机。",
        sourceChannel: "public_demo_seed",
        assignedOwnerExternalId: "sales-chen",
        assignedOwnerName: "陈晨",
        submitterExternalId: "public-demo-seed",
        submitterName: "公开演示初始化",
        submittedAt: today,
      },
      opportunity: {
        projectName: sample.projectName,
        customerName: sample.customer,
        finalCustomerName: sample.finalCustomer,
        projectCountry: sample.projectCountry ?? "中国",
        deliveryCountry: sample.deliveryCountry ?? "中国",
        productScope: sample.target,
        amount: { type: "exact", minYuan: sample.amount, maxYuan: sample.amount, currency: "CNY" },
        procurementProgress: "公开演示待人工转化",
        procurementMethod: sample.scenarioCode === "SCN-01-DIRECT-BID" ? "tender" : sample.scenarioCode.includes("EPC") ? "epc_inquiry" : "direct_rfq",
        requestingPartyName: sample.customer,
        requestingPartyRole: sample.scenarioCode.includes("EPC") ? "epc" : "end_customer",
        submissionRecipientName: sample.customer,
        suggestedScenarioCode: sample.scenarioCode,
        requestRef: sample.requestRef,
        requestDate,
        tenderNo: sample.tenderNo,
        deliveryLocation: sample.deliveryLocation,
        submissionDeadline: sample.bidDate,
        sourcePlatform: "公开演示初始化",
        customerMaster: { code: `DEMO-CUSTOMER-${sample.id}`, matchStatus: "temporary" },
      },
      initialRequirement: {
        originalText: `${sample.target}；详细参数与商务边界待项目阶段澄清。`,
        productRequirement: sample.target,
        knownConstraints: [sample.deliveryLocation],
        unknowns: ["正式技术参数待澄清", "最终交付与商务条件待确认"],
        sourceRefs: [`${eventId}:INITIAL-REQUIREMENT`],
      },
      evidenceRefs: [`${eventId}:SOURCE`],
      competitors: [], keyRoles: [], partners: [], contacts: [], followups: [], attachments: [], teamCandidates: [], parties: [],
      fieldProvenance: { dataClass: "PUBLIC_ANONYMIZED_DEMO", disclosure: "非真实客户、非真实商机、非生产接口数据" },
    }),
  });

  if (leadResult.projectCode) {
    process.stdout.write(`已存在 ${leadResult.projectCode}\n`);
    continue;
  }

  const project = await request("/api/p0/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-actor-id": "sales-chen" },
    body: JSON.stringify({
      scenarioCode: sample.scenarioCode,
      evidence: `${eventId}:SOURCE`,
      finalCustomer: sample.finalCustomer,
      sourceCustomer: sample.customer,
      target: sample.target,
      amount: sample.amount,
      procurementProjectName: sample.projectName,
      requestRef: sample.requestRef,
      requestDate,
      tenderNo: sample.tenderNo,
      deliveryLocation: sample.deliveryLocation,
      projectCountry: sample.projectCountry ?? "中国",
      deliveryCountry: sample.deliveryCountry ?? "中国",
      inquiryBatch: sample.inquiryBatch,
      bidDate: sample.bidDate,
      leadGrade: sample.grade,
      organization: "公开演示组织",
      firstAction: "核对线索快照并准备G1立项材料",
      ownerUserId: "sales-chen",
      leadConversionId: leadResult.inboxId,
      submitG1: true,
    }),
  });
  process.stdout.write(`已创建 ${project.projectCode} ${sample.projectName}\n`);
}
