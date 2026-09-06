import { decideG2, FlowError, json, requireDemoActor } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request, "manager");
    const body = await request.json() as { gateId?: unknown; action?: unknown; comment?: unknown; investmentScope?: unknown; priorityAndDeadline?: unknown; returnItems?: unknown };
    if (typeof body.gateId !== "string" || !body.gateId) throw new FlowError("缺少G2审批实例编号。");
    if (!['approve', 'return'].includes(String(body.action))) throw new FlowError("G2动作不合法。");
    return json(await decideG2(body.gateId, body.action as "approve" | "return", typeof body.comment === "string" ? body.comment.trim() : "", actor, {
      investmentScope: typeof body.investmentScope === "string" ? body.investmentScope.trim() : "",
      priorityAndDeadline: typeof body.priorityAndDeadline === "string" ? body.priorityAndDeadline.trim() : "",
      returnItems: typeof body.returnItems === "string" ? body.returnItems.trim() : "",
    }));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G2审批失败" }, error instanceof FlowError ? error.status : 500);
  }
}
