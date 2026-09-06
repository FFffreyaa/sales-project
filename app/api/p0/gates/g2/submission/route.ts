import { FlowError, json, requireDemoActor, submitG2 } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request, "sales");
    const body = await request.json() as { projectCode?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    return json(await submitG2(body.projectCode, actor), 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G2提交失败" }, error instanceof FlowError ? error.status : 500);
  }
}
