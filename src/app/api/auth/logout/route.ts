import { destroySession } from "@/lib/auth/session";
import { jsonOk } from "@/lib/utils/http";

export async function POST() {
  await destroySession();
  return jsonOk({ success: true });
}
