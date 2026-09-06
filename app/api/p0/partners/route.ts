import { decidePartnerNeed, decidePartnerVerification, FlowError, json, parsePartnerContribution, parsePartnerEngagement, parsePartnerNeed, parsePartnerVerification, recordPartnerContribution, registerPartnerEngagement, requireDemoActor } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; action?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    if (body.action === "decide_need") return json(await decidePartnerNeed(body.projectCode, parsePartnerNeed(body.input), actor));
    if (body.action === "register") return json(await registerPartnerEngagement(body.projectCode, parsePartnerEngagement(body.input), actor), 201);
    if (body.action === "verify") return json(await decidePartnerVerification(body.projectCode, parsePartnerVerification(body.input), actor));
    if (body.action === "record_contribution") return json(await recordPartnerContribution(body.projectCode, parsePartnerContribution(body.input), actor), 201);
    throw new FlowError("伙伴操作不合法。");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "伙伴操作失败" }, error instanceof FlowError ? error.status : 500);
  }
}
