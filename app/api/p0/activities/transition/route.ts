import { commandSpmActivity, FlowError, json, parseActivityCommand, requireDemoActor } from "../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as Record<string, unknown>;
    const projectCode = typeof body.projectCode === "string" ? body.projectCode.trim() : "";
    const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
    if (!projectCode) throw new FlowError("项目编号不能为空。");
    if (!activityId) throw new FlowError("活动编号不能为空。");
    return json(await commandSpmActivity(projectCode, activityId, parseActivityCommand(body.input), actor));
  } catch (error) {
    if (error instanceof FlowError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "项目活动流转失败。" }, 500);
  }
}
