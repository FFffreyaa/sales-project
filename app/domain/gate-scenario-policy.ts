import type { ProfessionalReviewInput, ScenarioType } from "./sales-project-contract";

export type GateScenarioPolicy = {
  scenarioCode: ScenarioType;
  g5ProfessionalReviews: readonly ProfessionalReviewInput["reviewType"][];
  g5ReviewRule: "always" | "conditional_pending_enterprise_rule";
  g5ReviewBasis: string;
  routeMode: "single_submission" | "multi_customer_route";
  policyStatus: "confirmed_demo_baseline" | "enterprise_rule_pending";
};

const FULL_PROFESSIONAL_REVIEW = ["business", "technical", "qualification"] as const;

/** Demo唯一场景策略表。enterprise_rule_pending 绝不能冒充已经确认的企业制度。 */
export const GATE_SCENARIO_POLICIES: Record<ScenarioType, GateScenarioPolicy> = {
  "SCN-01-DIRECT-BID": { scenarioCode: "SCN-01-DIRECT-BID", g5ProfessionalReviews: FULL_PROFESSIONAL_REVIEW, g5ReviewRule: "always", g5ReviewBasis: "正式招投标按完整商务、技术、资质三类专业评审执行。", routeMode: "single_submission", policyStatus: "confirmed_demo_baseline" },
  "SCN-02-EPC-INQUIRY": { scenarioCode: "SCN-02-EPC-INQUIRY", g5ProfessionalReviews: [], g5ReviewRule: "conditional_pending_enterprise_rule", g5ReviewBasis: "国内EPC询价应按金额、非标、偏差和风险条件触发；企业阈值未确认，Demo不擅自设定硬阈值。", routeMode: "multi_customer_route", policyStatus: "enterprise_rule_pending" },
  "SCN-03-DIRECT-RFQ": { scenarioCode: "SCN-03-DIRECT-RFQ", g5ProfessionalReviews: [], g5ReviewRule: "conditional_pending_enterprise_rule", g5ReviewBasis: "国内直接询价应按金额、非标、偏差和风险条件触发；企业阈值未确认，Demo不擅自设定硬阈值。", routeMode: "single_submission", policyStatus: "enterprise_rule_pending" },
  "SCN-04-OVERSEAS-PARTNER-EPC": { scenarioCode: "SCN-04-OVERSEAS-PARTNER-EPC", g5ProfessionalReviews: FULL_PROFESSIONAL_REVIEW, g5ReviewRule: "always", g5ReviewBasis: "海外伙伴/EPC询价按完整商务、技术、资质三类专业评审执行。", routeMode: "multi_customer_route", policyStatus: "confirmed_demo_baseline" },
};

export function gateScenarioPolicy(code: unknown): GateScenarioPolicy | undefined {
  return typeof code === "string" ? GATE_SCENARIO_POLICIES[code as ScenarioType] : undefined;
}

export function professionalReviewTypesForScenario(code: unknown): readonly ProfessionalReviewInput["reviewType"][] {
  return gateScenarioPolicy(code)?.g5ProfessionalReviews ?? [];
}
