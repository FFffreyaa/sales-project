import { FlowError, json, requireDemoActor, submitG1Draft } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode.trim()) throw new FlowError("缺少销售项目编号。");
    return json(await submitG1Draft(body.projectCode.trim(), actor));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G1提交失败" }, error instanceof FlowError ? error.status : 500);
  }
}
