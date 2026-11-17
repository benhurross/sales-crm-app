import { loadDashboardData } from "@/server/dashboard-data";
import { getSession } from "@/server/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await loadDashboardData(session.user));
}
