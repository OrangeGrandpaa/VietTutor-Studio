import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      recordings: {
        orderBy: { createdAt: "desc" }
      },
      speakingUnits: {
        orderBy: { orderIndex: "asc" },
        include: {
          recordings: {
            orderBy: { createdAt: "desc" },
            include: { feedback: true }
          }
        }
      }
    }
  });

  if (!assignment) return jsonError("作业不存在。", 404);
  return jsonOk(assignment);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { action?: "retry-ai"; title?: string }
    | null;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      recordings: true,
      speakingUnits: { include: { recordings: true } }
    }
  });

  if (!assignment) return jsonError("作业不存在。", 404);

  if (body?.action === "retry-ai") {
    return jsonError("口语作业已改为 TXT/RTF 本地拆句，不再调用 AI。", 400);
  }

  const title = sanitizeOptionalText(body?.title);
  if (!title) return jsonError("没有可更新的内容。");

  const updated = await prisma.assignment.update({
    where: { id },
    data: { title }
  });

  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      recordings: true,
      speakingUnits: {
        include: { recordings: true }
      }
    }
  });

  if (!assignment) return jsonError("作业不存在。", 404);

  for (const unit of assignment.speakingUnits) {
    for (const recording of unit.recordings) {
      await deleteFile(recording.filePath);
    }
  }

  for (const recording of assignment.recordings) {
    await deleteFile(recording.filePath);
  }

  await prisma.assignment.delete({ where: { id } });
  await deleteFile(assignment.originalFilePath);

  return jsonOk({ success: true });
}
