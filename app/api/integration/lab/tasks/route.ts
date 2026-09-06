import { FlowError } from "../../../_lib/p0-flow";
import { listIntegrationLabState } from "../../../_lib/integration-store";

const cors = { "Access-Control-Allow-Origin": "http://127.0.0.1:3010", "Access-Control-Allow-Headers": "Content-Type, x-integration-key", "Access-Control-Allow-Methods": "GET, OPTIONS" };
function authorized(request: Request) { if (request.headers.get("x-integration-key") !== "qj-local-integration-lab") throw new FlowError("集成实验室凭证无效。", 401); }
export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function GET(request: Request) {
  try { authorized(request); return Response.json(await listIntegrationLabState(), { headers: { ...cors, "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "读取集成任务失败" }, { status: error instanceof FlowError ? error.status : 500, headers: cors }); }
}
