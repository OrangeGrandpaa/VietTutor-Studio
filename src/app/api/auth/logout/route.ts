import { logAuditEvent } from "@/lib/audit/log";
import { destroySession } from "@/lib/auth/session";
import { jsonOk } from "@/lib/utils/http";

export async function POST() {
  await destroySession();
  logAuditEvent({
    event: "auth.logout",
    status: "success"
  });
  return jsonOk({ success: true });
}
