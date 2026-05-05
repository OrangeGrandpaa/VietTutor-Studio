import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function GET() {
  const session = await ensureAuthenticatedApi();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  return jsonOk(await getDashboardData());
}
