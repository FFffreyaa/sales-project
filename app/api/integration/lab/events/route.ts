import { authorizeIntegrationLab, localLabCors } from "../../../_lib/integration-lab-auth";
import { FlowError } from "../../../_lib/p0-flow";
import { parseIntegrationEnvelope, processIntegrationEvent } from "../../../_lib/integration-flow";

const cors = { ...localLabCors, "Access-Control-Allow-Methods": "POST, OPTIONS" };
export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function POST(request: Request) {
  try { authorizeIntegrationLab(request); return Response.json(await processIntegrationEvent(parseIntegrationEnvelope(await request.json())), { status: 202, headers: cors }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "集成事件处理失败" }, { status: error instanceof FlowError ? error.status : 500, headers: cors }); }
}
