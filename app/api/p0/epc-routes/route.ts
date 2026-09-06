import { createEpcQuotationRoute, decideEpcPriceException, decideG5Reopen, FlowError, json, parseEpcPriceException, parseEpcQuotationRoute, parseG5ReopenRequest, requestEpcPriceException, requestG5Reopen, requireDemoActor, withdrawEpcQuotationRoute } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; action?: unknown; exceptionId?: unknown; requestId?: unknown; routeId?: unknown; decision?: unknown; comment?: unknown; reason?: unknown; evidenceRef?: unknown; input?: unknown };
    if (body.action === "exception.decision") {
      if (typeof body.exceptionId !== "string" || !body.exceptionId) throw new FlowError("缺少价格例外编号。", 400);
      if (body.decision !== "approve" && body.decision !== "return" && body.decision !== "reject") throw new FlowError("价格例外决策动作不合法。", 400);
      return json(await decideEpcPriceException(body.exceptionId, body.decision, String(body.comment ?? ""), actor));
    }
    if (body.action === "g5-reopen.decision") {
      if (typeof body.requestId !== "string" || !body.requestId) throw new FlowError("缺少G5解冻申请编号。", 400);
      if (body.decision !== "approve" && body.decision !== "return" && body.decision !== "reject") throw new FlowError("G5解冻决策动作不合法。", 400);
      return json(await decideG5Reopen(body.requestId, body.decision, String(body.comment ?? ""), actor));
    }
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。", 400);
    if (body.action === "route.create") return json(await createEpcQuotationRoute(body.projectCode, parseEpcQuotationRoute(body.input), actor), 201);
    if (body.action === "route.withdraw") {
      if (typeof body.routeId !== "string" || !body.routeId) throw new FlowError("缺少EPC报价通路编号。", 400);
      return json(await withdrawEpcQuotationRoute(body.projectCode, body.routeId, String(body.reason ?? ""), String(body.evidenceRef ?? ""), actor));
    }
    if (body.action === "g5-reopen.request") return json(await requestG5Reopen(body.projectCode, parseG5ReopenRequest(body.input), actor), 201);
    if (body.action === "exception.request") return json(await requestEpcPriceException(body.projectCode, parseEpcPriceException(body.input), actor), 201);
    throw new FlowError("EPC报价通路动作不合法。", 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "EPC报价通路处理失败" }, error instanceof FlowError ? error.status : 500);
  }
}
