import { ProgressStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

const TEXT = {
  notFound: "\u8bfe\u4ef6\u4e0d\u5b58\u5728\u3002",
  emptyUpdate: "\u66f4\u65b0\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a\u3002"
} as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const material = await prisma.courseMaterial.findUnique({ where: { id } });
  if (!material) return jsonError(TEXT.notFound, 404);
  return jsonOk(material);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        note?: string;
        progressStatus?: keyof typeof ProgressStatus;
        progressPercent?: number;
        currentPage?: number | null;
      }
    | null;

  if (!body) return jsonError(TEXT.emptyUpdate);

  const material = await prisma.courseMaterial.update({
    where: { id },
    data: {
      title: sanitizeOptionalText(body.title) ?? undefined,
      note: sanitizeOptionalText(body.note) ?? undefined,
      progressStatus: body.progressStatus ? ProgressStatus[body.progressStatus] : undefined,
      progressPercent:
        typeof body.progressPercent === "number"
          ? Math.max(0, Math.min(100, body.progressPercent))
          : undefined,
      currentPage:
        body.currentPage === null
          ? null
          : typeof body.currentPage === "number"
            ? Math.max(0, Math.round(body.currentPage))
            : undefined
    }
  });

  return jsonOk({ success: true, material });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const material = await prisma.courseMaterial.findUnique({ where: { id } });

  if (!material) return jsonError(TEXT.notFound, 404);

  await prisma.courseMaterial.delete({ where: { id } });
  await deleteFile(material.filePath);

  return jsonOk({ success: true });
}
