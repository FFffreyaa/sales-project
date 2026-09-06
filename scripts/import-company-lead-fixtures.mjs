import { readFile } from "node:fs/promises";

const apiBase = process.env.LEAD_IMPORT_BASE_URL ?? "http://127.0.0.1:3000";
const samples = JSON.parse(await readFile(new URL("../integration-lab/src/fixtures/lead-samples.v1.json", import.meta.url), "utf8"));

for (const sample of samples) {
  const detail = sample.sourceDetail ?? {};
  const occurredAt = new Date(`${sample.reportTime.replace(" ", "T")}+08:00`).toISOString();
  const amountYuan = Number(sample.estimatedAmountWan) * 10_000;
  const scenarioCodes = ["SCN-01-DIRECT-BID", "SCN-02-EPC-INQUIRY", "SCN-03-DIRECT-RFQ", "SCN-04-OVERSEAS-PARTNER-EPC"];
  const testScenarioCode = sample.projectName.includes("招标") ? scenarioCodes[0] : scenarioCodes[(sample.id - 1) % scenarioCodes.length];
  const envelope = {
    eventId: `COMPANY-HTML-LEAD-${sample.id}-V2`,
    eventType: "LeadQualifiedForConversion",
    sourceSystem: "LEAD_MANAGEMENT_SIMULATOR",
    environment: "demo",
    simulated: true,
    occurredAt,
    lead: {
      id: `COMPANY-HTML-LEAD-${sample.id}`,
      code: `HTML-LEAD-${String(sample.id).padStart(2, "0")}`,
      type: sample.projectName.includes("招标") ? "tender" : "demand",
      category: sample.leadCategory,
      grade: sample.grade,
      authenticityStatus: "manual_confirmed",
      authenticityBasis: sample.id === 1 ? "公司线索原型记录了客户真实性、采购逻辑性、单价要素逻辑性、竞争对手有效性和预算来源真实性五项审核，总分21/25。该结论属于原型样本，不代表生产接口已经完成外部核验。" : "来自公司线索管理原型HTML的来源样本；该条没有可归属的结构化审核明细，仅作为本Demo联调来源。",
      authenticityAssessment: sample.id === 1 ? {
        dimensions: [
          { name: "客户真实性", score: 5, maxScore: 5, conclusion: "原型说明通过企业信息核验工商状态与法律风险" },
          { name: "采购逻辑性", score: 4, maxScore: 5, conclusion: "客户行业与采购需求匹配" },
          { name: "单价要素逻辑性", score: 4, maxScore: 5, conclusion: "提报金额与数量偏差处于原型判定的合理范围" },
          { name: "竞争对手有效性", score: 4, maxScore: 5, conclusion: "原型说明已与公司竞品名录比对" },
          { name: "预算来源真实性", score: 4, maxScore: 5, conclusion: "原型说明已按信息提供者层级评估" },
        ],
        totalScore: 21, maxScore: 25, conclusion: "真实性审核通过（公司线索原型样本）", assessedAt: occurredAt, assessor: "线索管理原型",
      } : undefined,
      gradeAssessment: sample.id === 1 ? { dimensions: { projectScale: "B", industryValue: "A", customerValue: "A", regionValue: "A", productValue: "B" }, basis: "公司线索原型价值评估表；任一维度为A则汇总为A级", ruleVersion: "HTML-PROTOTYPE-V1", manuallyAdjusted: false } : sample.grade ? { dimensions: {}, basis: "公司线索原型接收跟进清单中的线索等级", ruleVersion: "HTML-PROTOTYPE-RECEIVE-LIST", manuallyAdjusted: false } : undefined,
      sourceChannel: sample.channel,
      assignedOwnerExternalId: "sales-chen",
      assignedOwnerName: "陈晨",
      submitterExternalId: `company-fixture-reporter-${sample.id}`,
      submitterName: sample.reporter,
      submittedAt: occurredAt,
    },
    opportunity: {
      projectName: sample.projectName,
      customerName: sample.clientUnit,
      finalCustomerName: detail.finalCustomerName,
      region: detail.region,
      industry: detail.industry,
      productScope: detail.product ?? sample.description,
      quantity: detail.quantity,
      amount: { type: "exact", minYuan: amountYuan, maxYuan: amountYuan, currency: "CNY" },
      procurementProgress: sample.status,
      procurementMethod: sample.projectName.includes("招标") ? "tender" : "unknown",
      requestingPartyName: sample.clientUnit,
      requestingPartyRole: "unknown",
      suggestedScenarioCode: testScenarioCode,
      sourcePlatform: "公司线索管理原型HTML",
      customerMaster: { code: `HTML-CUSTOMER-${sample.id}`, matchStatus: "temporary" },
    },
    initialRequirement: {
      originalText: sample.description,
      productRequirement: sample.description,
      knownConstraints: sample.id === 1 ? ["低损耗", "低噪音", "符合GB/T 17468标准"] : [],
      unknowns: ["客户详细技术参数待项目阶段澄清", "交付与商务约束待确认"],
      sourceRefs: [`线索管理系统 - 完整版.html#sample-${sample.id}`],
    },
    evidenceRefs: [`线索管理系统 - 完整版.html#sample-${sample.id}`],
    competitors: detail.competitors ?? [], keyRoles: detail.keyRoles ?? [], partners: detail.partners ?? [], contacts: detail.contacts ?? [], followups: detail.followups ?? [], attachments: detail.attachments ?? [], parties: detail.parties ?? [], teamCandidates: detail.teamCandidates ?? [],
    fieldProvenance: {
      fixtureId: `HTML-LEAD-${sample.id}`,
      projectName: "公司线索管理原型HTML",
      customerName: "公司线索管理原型HTML",
      productScope: "公司线索管理原型HTML",
      amount: "公司线索管理原型HTML",
      scenarioCode: "本地联调测试设定；正式接口由线索APP带入",
      initialRequirement: "公司线索管理原型HTML的项目描述",
      grade: sample.grade ? "公司线索管理原型HTML的接收跟进清单" : "原型未提供可归属等级",
      detailedFacts: sample.sourceDetail ? "公司线索管理原型HTML中可明确归属该样本的跟进详情" : "原型仅提供列表摘要",
    },
  };
  const response = await fetch(`${apiBase}/api/integration/lead/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-integration-key": "qj-local-integration-lab" },
    body: JSON.stringify(envelope),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`样本${sample.id}导入失败：${result.error ?? response.status}`);
  process.stdout.write(`${result.updated ? "已更新" : result.duplicate ? "已存在/已转化" : "已导入"} HTML-LEAD-${sample.id} ${sample.projectName}\n`);
}
