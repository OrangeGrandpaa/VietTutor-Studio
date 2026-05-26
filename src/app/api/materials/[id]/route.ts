import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";

const TEXT = {
  notFound: "\u8bfe\u4ef6\u4e0d\u5b58\u5728\u3002"
} as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const material = await prisma.courseMaterial.findUnique({ where: { id } });
  if (!material) return jsonError(TEXT.notFound, 404);
  return jsonOk(material);
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
