import { checkOpportunityDuplicate, FlowError, json, parseCreateInput, requireDemoActor } from "../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    if (actor.role !== "sales" && actor.role !== "manager") throw new FlowError("只有销售员或销售主管可以执行采购机会查重。", 403);
    return json(await checkOpportunityDuplicate(parseCreateInput(await request.json())));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "查重失败" }, error instanceof FlowError ? error.status : 500);
  }
}
