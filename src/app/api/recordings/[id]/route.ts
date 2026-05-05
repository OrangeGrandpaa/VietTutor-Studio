import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const recording = await prisma.recording.findUnique({ where: { id } });

  if (!recording) {
    return jsonError("录音不存在。", 404);
  }

  await prisma.recording.delete({ where: { id } });
  await deleteFile(recording.filePath);

  return jsonOk({ success: true });
}
