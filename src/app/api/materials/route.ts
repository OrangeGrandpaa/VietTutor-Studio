import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/audit/log";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile, saveUploadedFile, StorageValidationError } from "@/lib/storage";
import { getMaxUploadSizeBytes } from "@/lib/utils/env";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { inferMaterialFileType, mapMaterialCategory } from "@/lib/utils/mapping";
import { getRequestMeta } from "@/lib/utils/request";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

const supportedMaterialTypes =
  "PDF\u3001Word\u3001PPT\u3001Markdown\u3001\u56fe\u7247\u3001\u97f3\u9891\u548c\u89c6\u9891";

function formatUploadLimitMb() {
  const sizeMb = getMaxUploadSizeBytes() / 1024 / 1024;
  return Number.isInteger(sizeMb) ? `${sizeMb}` : sizeMb.toFixed(1);
}

function formatMaterialUploadError(error: unknown) {
  if (error instanceof StorageValidationError) {
    if (error.code === "FILE_TOO_LARGE") {
      return {
        status: 400,
        message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6587\u4ef6\u5927\u5c0f\u8d85\u8fc7 ${formatUploadLimitMb()} MB \u9650\u5236\u3002`
      };
    }

    if (error.code === "UNSUPPORTED_FILE_TYPE") {
      return {
        status: 400,
        message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6587\u4ef6\u7c7b\u578b\u4e0d\u53d7\u652f\u6301\uff0c\u4ec5\u652f\u6301 ${supportedMaterialTypes}\u3002`
      };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 500,
      message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6570\u636e\u5e93\u8fde\u63a5\u5931\u8d25\u3002${error.message}`
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6570\u636e\u5e93\u5b57\u6bb5\u6821\u9a8c\u5931\u8d25\u3002${error.message}`
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      status: 500,
      message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6570\u636e\u5e93\u5199\u5165\u5931\u8d25\uff08${error.code}\uff09\u3002${error.message}`
    };
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return {
        status: 401,
        message:
          "\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u8bd5\u3002"
      };
    }

    if (error.message.includes("EACCES") || error.message.includes("EPERM")) {
      return {
        status: 500,
        message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6ca1\u6709\u6743\u9650\u5199\u5165 uploads \u76ee\u5f55\u3002${error.message}`
      };
    }

    if (error.message.includes("ENOSPC")) {
      return {
        status: 500,
        message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u78c1\u76d8\u7a7a\u95f4\u4e0d\u8db3\uff0c\u65e0\u6cd5\u4fdd\u5b58\u6587\u4ef6\u3002${error.message}`
      };
    }

    if (error.message.includes("SQLITE") || error.message.toLowerCase().includes("database")) {
      return {
        status: 500,
        message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u6570\u636e\u5e93\u64cd\u4f5c\u5f02\u5e38\u3002${error.message}`
      };
    }

    return {
      status: 500,
      message: `\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a${error.message}`
    };
  }

  return {
    status: 500,
    message:
      "\u8bfe\u4ef6\u4e0a\u4f20\u5931\u8d25\uff1a\u53d1\u751f\u672a\u77e5\u9519\u8bef\uff0c\u8bf7\u67e5\u770b\u670d\u52a1\u7aef\u65e5\u5fd7\u3002"
  };
}

export async function GET() {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const materials = await prisma.courseMaterial.findMany({
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(materials);
}

export async function POST(request: NextRequest) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);
  const requestMeta = getRequestMeta(request);

  let savedRelativePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("\u8bf7\u4e0a\u4f20\u8bfe\u4ef6\u6587\u4ef6\u3002");
    }

    const saved = await saveUploadedFile({
      file,
      bucket: "materials",
      allowedExtensions: [
        ".pdf",
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".md",
        ".markdown",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".mp3",
        ".wav",
        ".m4a",
        ".mp4",
        ".mov"
      ],
      allowedMimeTypes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/markdown",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "video/mp4",
        "video/quicktime"
      ]
    });

    savedRelativePath = saved.relativePath;

    const title =
      sanitizeOptionalText(formData.get("title")?.toString()) ?? file.name.replace(/\.[^.]+$/, "");

    const material = await prisma.courseMaterial.create({
      data: {
        title,
        fileName: file.name,
        filePath: saved.relativePath,
        mimeType: saved.mimeType,
        fileType: inferMaterialFileType(file.name, saved.mimeType),
        category: mapMaterialCategory(formData.get("category")?.toString() ?? "INTEGRATED"),
        note: sanitizeOptionalText(formData.get("note")?.toString())
      }
    });

    logAuditEvent({
      event: "materials.upload",
      status: "success",
      ...requestMeta,
      resourceId: material.id
    });

    return jsonOk({ success: true, material }, 201);
  } catch (error) {
    if (savedRelativePath) {
      await deleteFile(savedRelativePath).catch((cleanupError) => {
        console.error("[materials.upload] failed to cleanup file after error", cleanupError);
      });
    }

    const formatted = formatMaterialUploadError(error);
    logAuditEvent({
      event: "materials.upload",
      status: "failure",
      ...requestMeta,
      message: formatted.message
    });
    console.error("[materials.upload] upload failed", error);
    return jsonError(formatted.message, formatted.status);
  }
}
