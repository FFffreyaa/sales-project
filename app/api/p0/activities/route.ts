import { createSpmActivity, FlowError, json, parseCreateSpmActivity, requireDemoActor } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as Record<string, unknown>;
    const projectCode = typeof body.projectCode === "string" ? body.projectCode.trim() : "";
    if (!projectCode) throw new FlowError("项目编号不能为空。");
    return json(await createSpmActivity(projectCode, parseCreateSpmActivity(body.input), actor), 201);
  } catch (error) {
    if (error instanceof FlowError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "项目活动保存失败。" }, 500);
  }
}
