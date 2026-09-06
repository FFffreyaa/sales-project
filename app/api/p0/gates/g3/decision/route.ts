import { json } from "../../../../_lib/p0-flow";

export async function POST(request: Request) {
  void request;
  return json({ error: "G3专业结论必须由受控技术协同事件回传，销售项目系统不提供代审批入口。" }, 410);
}
