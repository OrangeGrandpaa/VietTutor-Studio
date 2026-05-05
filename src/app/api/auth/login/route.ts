import { NextRequest } from "next/server";

import { createSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { getRequestMeta } from "@/lib/utils/request";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();

  if (!password) {
    return jsonError("请输入访问密码。");
  }

  const result = await createSession({
    password,
    ...getRequestMeta(request)
  });

  if (!result.ok) {
    return jsonError(result.message, 401);
  }

  return jsonOk({ success: true });
}
