import { decideG6, FlowError, json, requireDemoActor } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request, "manager");
    const body = await request.json() as Record<string, unknown>;
    const gateId = typeof body.gateId === "string" ? body.gateId : "";
    const action = body.action;
    if (!gateId) throw new FlowError("缺少G6实例编号。");
    if (action !== "approve" && action !== "return") throw new FlowError("G6决策动作不合法。");
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    return json(await decideG6(gateId, action, comment, actor));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G6决策失败" }, error instanceof FlowError ? error.status : 500);
  }
}
