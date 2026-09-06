import { FlowError } from "../../../_lib/p0-flow";
import { parseLeadConversionEnvelope, processLeadConversionEvent } from "../../../_lib/lead-integration-flow";

const cors = { "Access-Control-Allow-Origin": "http://127.0.0.1:3010", "Access-Control-Allow-Headers": "Content-Type, x-integration-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function authorized(request: Request) { if (request.headers.get("x-integration-key") !== "qj-local-integration-lab") throw new FlowError("集成实验室凭证无效。", 401); }
export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function POST(request: Request) {
  try { authorized(request); return Response.json(await processLeadConversionEvent(parseLeadConversionEnvelope(await request.json())), { status: 202, headers: cors }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "线索转化事件处理失败" }, { status: error instanceof FlowError ? error.status : 500, headers: cors }); }
}
