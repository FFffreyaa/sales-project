import { FlowError, json, requestCommercialResultCorrection, requireDemoActor } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。", 400);
    return json(await requestCommercialResultCorrection(body.projectCode, body.input, actor), 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "结果核实请求处理失败" }, error instanceof FlowError ? error.status : 500);
  }
}
