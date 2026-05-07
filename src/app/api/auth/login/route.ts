import { NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/audit/log";
import { createSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { getRequestMeta } from "@/lib/utils/request";

export async function POST(request: NextRequest) {
  const requestMeta = getRequestMeta(request);
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();

  if (!password) {
    return jsonError("请输入访问密码。");
  }

  const result = await createSession({
    password,
    ...requestMeta
  });

  if (!result.ok) {
    logAuditEvent({
      event: "auth.login",
      status: "failure",
      ...requestMeta,
      message: result.message
    });
    return jsonError(result.message, 401);
  }

  logAuditEvent({
    event: "auth.login",
    status: "success",
    ...requestMeta
  });

  return jsonOk({ success: true });
}
