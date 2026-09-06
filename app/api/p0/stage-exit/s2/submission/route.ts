import { json } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  void request;
  return json({ error: "S2阶段出口接口已归并为G3需求方案基线门，请使用 /api/p0/gates/g3/submission。" }, 410);
}
