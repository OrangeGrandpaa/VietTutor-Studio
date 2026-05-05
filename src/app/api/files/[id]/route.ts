import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getProtectedFile } from "@/lib/storage";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind");
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!kind || !["assignment", "material", "recording"].includes(kind)) {
    return jsonError("缺少文件类型。");
  }

  const record =
    kind === "material"
      ? await prisma.courseMaterial.findUnique({ where: { id } })
      : kind === "recording"
        ? await prisma.recording.findUnique({ where: { id } })
        : await prisma.assignment.findUnique({ where: { id } });

  if (!record) {
    return jsonError("文件不存在。", 404);
  }

  const filePath = "filePath" in record ? record.filePath : record.originalFilePath;

  if (!filePath) {
    return jsonError("文件路径不存在。", 404);
  }

  const file = await getProtectedFile(filePath);
  const fileName =
    "fileName" in record
      ? record.fileName
      : "originalFileName" in record
        ? record.originalFileName
        : `${id}.bin`;
  const mimeType =
    "mimeType" in record
      ? record.mimeType
      : "originalMimeType" in record
        ? record.originalMimeType
        : "application/octet-stream";

  return new Response(file.buffer, {
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
