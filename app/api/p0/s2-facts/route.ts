import { FlowError, json, parseRequirementSource, requireDemoActor, saveRequirementSource } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    if (body.action === "requirement.save") return json(await saveRequirementSource(body.projectCode, parseRequirementSource(body.input), actor), 201);
    if (body.action === "technical-assessment.save") throw new FlowError("该技术评估入口已迁移到独立集成测试台，请通过受控集成事件回传。", 410);
    throw new FlowError("S2来源事实动作不合法。");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "S2来源事实保存失败" }, error instanceof FlowError ? error.status : 500);
  }
}
