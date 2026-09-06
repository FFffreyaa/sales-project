import { decideG1, FlowError, json, requireDemoActor } from "../../../_lib/p0-flow";
import type { G1Action } from "@/app/domain/sales-project-contract";

export async function POST(request: Request) {
  try {
    const actor = await requireDemoActor(request);
    const body = await request.json() as { gateId?: unknown; action?: unknown; comment?: unknown; projectGrade?: unknown; gradeReason?: unknown; gradeEvidence?: unknown };
    if (typeof body.gateId !== "string" || !body.gateId) throw new FlowError("缺少G1审批实例编号。");
    if (!["approve", "return", "resubmit"].includes(String(body.action))) throw new FlowError("G1动作不合法。");
    const result = await decideG1(body.gateId, body.action as G1Action, typeof body.comment === "string" ? body.comment.trim() : "", actor, {
      projectGrade: typeof body.projectGrade === "string" ? body.projectGrade : undefined,
      gradeReason: typeof body.gradeReason === "string" ? body.gradeReason : undefined,
      gradeEvidence: typeof body.gradeEvidence === "string" ? body.gradeEvidence : undefined,
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "审批失败" }, error instanceof FlowError ? error.status : 500);
  }
}
