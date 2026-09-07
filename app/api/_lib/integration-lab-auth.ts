import { FlowError } from "./p0-flow";

const localLabOrigin = "http://127.0.0.1:3010";
const localLabKey = "qj-local-integration-lab";

export const localLabCors = {
  "Access-Control-Allow-Origin": localLabOrigin,
  "Access-Control-Allow-Headers": "Content-Type, x-integration-key",
};

export function authorizeIntegrationLab(request: Request) {
  if (request.headers.get("x-integration-key") === localLabKey) return;

  const requestOrigin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (browserOrigin === requestOrigin || fetchSite === "same-origin") return;

  throw new FlowError("集成实验室仅允许同站点公开演示页或本地测试台调用。", 401);
}
