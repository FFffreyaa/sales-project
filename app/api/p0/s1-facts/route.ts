import { FlowError, json, parseCompetitorFact, parseRelationshipFact, parseResourceCandidate, parseRoleAssignment, parseStrategyFact, requireDemoActor, saveCompetitorFact, saveRelationshipFact, saveResourceCandidate, saveRoleAssignment, saveStrategyFact } from "../../_lib/p0-flow";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { projectCode?: unknown; action?: unknown; input?: unknown };
    if (typeof body.projectCode !== "string" || !body.projectCode) throw new FlowError("缺少销售项目编号。");
    if (body.action === "strategy.save") return json(await saveStrategyFact(body.projectCode, parseStrategyFact(body.input), actor), 201);
    if (body.action === "relationship.create") return json(await saveRelationshipFact(body.projectCode, parseRelationshipFact(body.input), actor), 201);
    if (body.action === "competitor.create") return json(await saveCompetitorFact(body.projectCode, parseCompetitorFact(body.input), actor), 201);
    if (body.action === "resource.candidate") return json(await saveResourceCandidate(body.projectCode, parseResourceCandidate(body.input), actor), 201);
    if (body.action === "resource.upsert") return json(await saveRoleAssignment(body.projectCode, parseRoleAssignment(body.input), actor));
    if (body.action === "solution-preparation.record") throw new FlowError("该技术作业入口已迁移到独立集成测试台，请通过受控集成事件回传。", 410);
    throw new FlowError("S1来源记录动作不合法。");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "S1来源记录保存失败" }, error instanceof FlowError ? error.status : 500);
  }
}
