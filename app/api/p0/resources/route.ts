import { FlowError, json, parseResourceRequest, requestCostingCollaboration, requestProjectResource, requireDemoActor } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; action?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    if (body.action === "request") return json(await requestProjectResource(body.projectCode, parseResourceRequest(body.input), actor), 201);
    if (body.action === "costing.request") return json(await requestCostingCollaboration(body.projectCode, actor), 201);
    throw new FlowError("资源操作不合法。");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "资源操作失败" }, error instanceof FlowError ? error.status : 500);
  }
}
