import { AssignmentStatus, AssignmentType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildWritingFallback } from "@/lib/ai/fallback";
import { structureWritingAssignment } from "@/lib/ai/kimi";
import { flattenWritingQuestions } from "@/lib/assignment/writing";
import {
  assignmentUploadConfig,
  extractAssignmentSourceText
} from "@/lib/assignment/source-extraction";
import { logAuditEvent } from "@/lib/audit/log";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile, saveUploadedFile, StorageValidationError } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { logger } from "@/lib/utils/logger";
import { mapDisplayType } from "@/lib/utils/mapping";
import { getRequestMeta } from "@/lib/utils/request";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

function formatWritingUploadError(error: unknown) {
  if (error instanceof StorageValidationError) {
    if (error.code === "FILE_TOO_LARGE") {
      return {
        status: 400,
        message: "作业上传失败：文件大小超过限制。"
      };
    }

    if (error.code === "UNSUPPORTED_FILE_TYPE") {
      return {
        status: 400,
        message: "作业上传失败：当前文件类型不受支持。"
      };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 500,
      message: `作业上传失败：数据库连接异常。${error.message}`
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      message: `作业上传失败：数据库字段校验失败。${error.message}`
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      status: 500,
      message: `作业上传失败：数据库写入失败（${error.code}）。${error.message}`
    };
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return {
        status: 401,
        message: "作业上传失败：登录状态已失效，请重新登录后再试。"
      };
    }

    if (error.message.includes("Missing environment variable")) {
      return {
        status: 500,
        message: `作业上传失败：服务器环境变量配置不完整。${error.message}`
      };
    }

    return {
      status: 500,
      message: `作业上传失败：${error.message}`
    };
  }

  return {
    status: 500,
    message: "作业上传失败：发生未知错误，请查看服务端日志。"
  };
}

export async function GET() {
  const session = await ensureAuthenticatedApi();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const assignments = await prisma.assignment.findMany({
    where: { type: AssignmentType.WRITING },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(assignments);
}

export async function POST(request: NextRequest) {
  const session = await ensureAuthenticatedApi();
  const requestMeta = getRequestMeta(request);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  let savedRelativePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const customTitle = sanitizeOptionalText(formData.get("title")?.toString());

    if (!(file instanceof File)) {
      return jsonError("请上传作业文件。");
    }

    const extracted = await extractAssignmentSourceText(file);
    const savedFile = await saveUploadedFile({
      file,
      bucket: "assignments/writing",
      ...assignmentUploadConfig
    });
    savedRelativePath = savedFile.relativePath;

    let structured = buildWritingFallback(extracted.text);
    let aiStatus: "SUCCEEDED" | "FAILED" = "FAILED";
    let aiErrorMessage: string | null = "AI structure generation has not run.";

    try {
      structured = await structureWritingAssignment(extracted.text);
      aiStatus = "SUCCEEDED";
      aiErrorMessage = null;
    } catch (error) {
      aiStatus = "FAILED";
      aiErrorMessage = error instanceof Error ? error.message : "AI structure generation failed.";
    }

    const questions = flattenWritingQuestions(structured);
    const title = customTitle ?? structured.title ?? file.name.replace(/\.[^.]+$/, "");

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          title,
          type: AssignmentType.WRITING,
          originalFileName: file.name,
          originalFilePath: savedFile.relativePath,
          originalMimeType: savedFile.mimeType,
          originalContent: extracted.text,
          aiStructuredContent: structured as unknown as Prisma.InputJsonValue,
          aiStatus,
          aiErrorMessage,
          status: AssignmentStatus.PENDING_REVIEW
        }
      });

      if (questions.length > 0) {
        await tx.assignmentSection.createMany({
          data: questions.map((question, index) => ({
            assignmentId: created.id,
            sectionTitle: `${question.partTitle} / Question ${question.questionNumber}`,
            originalText: question.prompt,
            vietnameseText: null,
            chineseTranslation: null,
            detectedLevel: question.detectedLevel,
            displayType: mapDisplayType(question.displayType),
            orderIndex: index + 1
          }))
        });
      }

      return created;
    });

    logAuditEvent({
      event: "assignments.writing.upload",
      status: "success",
      ...requestMeta,
      resourceId: assignment.id
    });

    return jsonOk(
      {
        success: true,
        id: assignment.id,
        aiStatus,
        sourceStrategy: extracted.strategy,
        message:
          aiStatus === "SUCCEEDED"
            ? "笔头作业已上传并完成按题结构化。"
            : "作业已上传，但 AI 结构化失败，可稍后重试。"
      },
      201
    );
  } catch (error) {
    if (savedRelativePath) {
      await deleteFile(savedRelativePath).catch((cleanupError) => {
        logger.error("assignments.writing.upload.cleanup_failed", { cleanupError });
      });
    }

    const formatted = formatWritingUploadError(error);

    logAuditEvent({
      event: "assignments.writing.upload",
      status: "failure",
      ...requestMeta,
      message: formatted.message
    });

    logger.error("assignments.writing.upload.failed", { error });

    return jsonError(formatted.message, formatted.status);
  }
}
