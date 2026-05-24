import { ProgressStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

const TEXT = {
  notFound: "\u8bfe\u4ef6\u4e0d\u5b58\u5728\u3002",
  emptyUpdate: "\u66f4\u65b0\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a\u3002",
  invalidCurrentPage:
    "\u5f53\u524d\u9875\u6570\u4e0d\u80fd\u8d85\u8fc7\u8bfe\u4ef6\u603b\u9875\u6570\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002"
} as const;

function calculateProgressPercent(currentPage: number | null | undefined, totalPages: number | null) {
  if (typeof currentPage !== "number" || typeof totalPages !== "number" || totalPages <= 0) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round((currentPage / totalPages) * 100)));
}

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
        currentPage?: number | null;
      }
    | null;

  if (!body) return jsonError(TEXT.emptyUpdate);
  const existing = await prisma.courseMaterial.findUnique({ where: { id } });
  if (!existing) return jsonError(TEXT.notFound, 404);

  const currentPage =
    body.currentPage === null
      ? null
      : typeof body.currentPage === "number"
        ? Math.max(0, Math.round(body.currentPage))
        : undefined;

  if (
    typeof currentPage === "number" &&
    typeof existing.totalPages === "number" &&
    existing.totalPages > 0 &&
    currentPage > existing.totalPages
  ) {
    return jsonError(TEXT.invalidCurrentPage);
  }

  const material = await prisma.courseMaterial.update({
    where: { id },
    data: {
      title: sanitizeOptionalText(body.title) ?? undefined,
      note: sanitizeOptionalText(body.note) ?? undefined,
      progressStatus: body.progressStatus ? ProgressStatus[body.progressStatus] : undefined,
      progressPercent:
        currentPage === null ? 0 : calculateProgressPercent(currentPage, existing.totalPages),
      currentPage
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
