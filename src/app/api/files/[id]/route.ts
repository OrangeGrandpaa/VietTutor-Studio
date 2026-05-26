import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getProtectedFileAccelRedirectPath, getProtectedFileMetadata } from "@/lib/storage";
import { jsonError } from "@/lib/utils/http";

type FileRecord = {
  fileName: string;
  filePath: string | null;
  mimeType: string | null;
};

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return "invalid" as const;
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart && !rawEnd) {
    return "invalid" as const;
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return "invalid" as const;
    }

    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1
    };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return "invalid" as const;
  }

  return {
    start,
    end: Math.min(end, size - 1)
  };
}

function streamFile(absolutePath: string, range: { start: number; end: number } | null) {
  const nodeStream = range
    ? createReadStream(absolutePath, { start: range.start, end: range.end })
    : createReadStream(absolutePath);

  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

async function findFileRecord(kind: string, id: string): Promise<FileRecord | null> {
  if (kind === "material") {
    const material = await prisma.courseMaterial.findUnique({
      where: { id },
      select: {
        fileName: true,
        filePath: true,
        mimeType: true
      }
    });

    return material;
  }

  if (kind === "recording") {
    const recording = await prisma.recording.findUnique({
      where: { id },
      select: {
        filePath: true,
        mimeType: true
      }
    });

    return recording
      ? {
          fileName: `${id}.bin`,
          filePath: recording.filePath,
          mimeType: recording.mimeType
        }
      : null;
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: {
      originalFileName: true,
      originalFilePath: true,
      originalMimeType: true
    }
  });

  return assignment
    ? {
        fileName: assignment.originalFileName,
        filePath: assignment.originalFilePath,
        mimeType: assignment.originalMimeType
      }
    : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind");
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!kind || !["assignment", "material", "recording"].includes(kind)) {
    return jsonError("缺少文件类型。");
  }

  const record = await findFileRecord(kind, id);
  if (!record) {
    return jsonError("文件不存在。", 404);
  }

  if (!record.filePath) {
    return jsonError("文件路径不存在。", 404);
  }

  const file = await getProtectedFileMetadata(record.filePath);
  const range = parseRange(request.headers.get("range"), file.size);
  const mimeType = record.mimeType || "application/octet-stream";
  const disposition = `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(record.fileName)}"`;
  const etag = `"${file.size}-${file.mtimeMs}"`;
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": disposition,
    "Content-Type": mimeType,
    "ETag": etag,
    "Last-Modified": file.lastModified
  };
  const accelRedirectPath = getProtectedFileAccelRedirectPath(record.filePath);

  if (!range && request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: baseHeaders
    });
  }

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes */${file.size}`
      }
    });
  }

  if (accelRedirectPath) {
    return new Response(null, {
      headers: {
        ...baseHeaders,
        "X-Accel-Redirect": accelRedirectPath
      }
    });
  }

  if (range) {
    const length = range.end - range.start + 1;
    return new Response(streamFile(file.absolutePath, range), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(length),
        "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`
      }
    });
  }

  return new Response(streamFile(file.absolutePath, null), {
    headers: {
      ...baseHeaders,
      "Content-Length": String(file.size)
    }
  });
}
