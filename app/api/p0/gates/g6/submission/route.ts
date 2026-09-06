import { FlowError, json, requestG6, requireDemoActor } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request, "sales");
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    const remediation = body.remediation && typeof body.remediation === "object" ? body.remediation as { resolutionSummary?: unknown; evidenceRef?: unknown } : undefined;
    return json(await requestG6(body.projectCode, actor, remediation), 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "G6申请失败" }, error instanceof FlowError ? error.status : 500);
  }
}
