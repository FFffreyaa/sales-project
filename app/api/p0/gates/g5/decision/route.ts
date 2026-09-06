import { decideG5, FlowError, json, parseG5DeviationAuthorizations, requireDemoActor } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request, "manager");
    const body = await request.json() as Record<string, unknown>;
    const gateId = typeof body.gateId === "string" ? body.gateId : "";
    const action = body.action;
    if (!gateId) throw new FlowError("缺少G5实例编号。");
    if (action !== "approve_submit" && action !== "return" && action !== "decline") throw new FlowError("G5决策动作不合法。");
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const riskAcceptance = { accepted: body.acceptResidualRisks === true, reason: typeof body.riskAcceptanceReason === "string" ? body.riskAcceptanceReason.trim() : "" };
    return json(await decideG5(gateId, action, comment, actor, riskAcceptance, parseG5DeviationAuthorizations(body.deviationAuthorizations)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G5决策失败" }, error instanceof FlowError ? error.status : 500);
  }
}
