import { authorizeIntegrationLab, localLabCors } from "../../../_lib/integration-lab-auth";
import { FlowError } from "../../../_lib/p0-flow";
import { listIntegrationLabState } from "../../../_lib/integration-store";

const cors = { ...localLabCors, "Access-Control-Allow-Methods": "GET, OPTIONS" };
export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function GET(request: Request) {
  try { authorizeIntegrationLab(request); return Response.json(await listIntegrationLabState(), { headers: { ...cors, "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "读取集成任务失败" }, { status: error instanceof FlowError ? error.status : 500, headers: cors }); }
}
