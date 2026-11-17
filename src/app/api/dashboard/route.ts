import { loadDashboardData } from "@/server/dashboard-data";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  return Response.json(await loadDashboardData(session.user));
}
