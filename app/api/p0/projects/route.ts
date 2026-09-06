import { createIntentProjectAndG1, FlowError, json, listProjectsFor, parseCreateInput, requireDemoActor } from "../../_lib/p0-flow";

export async function GET(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const includeAcceptanceData = request.headers.get("x-integration-key") === "qj-local-integration-lab";
    return json({ projects: await listProjectsFor(actor, includeAcceptanceData) });
  }
  catch (error) { return json({ error: error instanceof Error ? error.message : "读取失败" }, error instanceof FlowError ? error.status : 500); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    if (actor.role !== "sales" && actor.role !== "manager") throw new FlowError("只有销售员或销售主管可以确认线索转化。", 403);
    const input = parseCreateInput(await request.json());
    const acceptanceBypass = request.headers.get("x-integration-key") === "qj-local-integration-lab";
    if (!input.leadConversionId && !acceptanceBypass) throw new FlowError("销售项目只能由待转化线索生成，不能脱离线索人工新建。", 400);
    const created = await createIntentProjectAndG1(input, actor);
    return json(created, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "创建失败" }, error instanceof FlowError ? error.status : 500);
  }
}
