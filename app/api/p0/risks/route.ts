import { commandProjectRisk, createProjectRisk, FlowError, json, parseCreateProjectRisk, parseProjectRiskCommand, requireDemoActor } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; action?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    if (body.action === "create") return json(await createProjectRisk(body.projectCode, parseCreateProjectRisk(body.input), actor), 201);
    if (body.action === "transition") return json(await commandProjectRisk(body.projectCode, parseProjectRiskCommand(body.input), actor));
    throw new FlowError("风险操作不合法。");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "风险操作失败" }, error instanceof FlowError ? error.status : 500);
  }
}
