import { listLeadConversionsFor } from "../../_lib/lead-integration-flow";
import { FlowError, json, requireDemoActor } from "../../_lib/p0-flow";

export async function GET(request: Request) {
  try { return json(await listLeadConversionsFor(await requireDemoActor(request))); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "读取线索转化队列失败" }, error instanceof FlowError ? error.status : 500); }
}
