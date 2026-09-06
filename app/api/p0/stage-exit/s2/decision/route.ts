import { json } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  void request;
  return json({ error: "S2阶段出口接口已归并为G3；专业结论通过受控集成事件回传。" }, 410);
}
