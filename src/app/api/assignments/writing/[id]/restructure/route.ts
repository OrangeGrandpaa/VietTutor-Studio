import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const url = new URL(request.url);
  url.pathname = `/api/assignments/writing/${id}`;

  return fetch(url, {
    method: "PATCH",
    headers: request.headers,
    body: JSON.stringify({ action: "retry-ai" })
  });
}
