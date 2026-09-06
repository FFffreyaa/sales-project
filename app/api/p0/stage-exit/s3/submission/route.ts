import { json } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  void request;
  return json({ error: "S3阶段出口接口已归并为G4核价授权门，请使用 /api/p0/gates/g4/submission。" }, 410);
}
