import { AssignmentStatus, AssignmentType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildSpeakingTextAssignment, extractPlainTextFromRtf } from "@/lib/assignment/speaking-text";
import { logAuditEvent } from "@/lib/audit/log";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { getRequestMeta } from "@/lib/utils/request";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";
import type { SpeakingStructuredContent } from "@/types/assignment";

const speakingUploadConfig = {
  allowedExtensions: [".txt", ".rtf"],
  allowedMimeTypes: ["application/rtf", "application/x-rtf", "text/plain", "text/rtf"]
};

function getSpeakingFileType(fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".txt")) return "txt";
  if (lowerName.endsWith(".rtf")) return "rtf";
  return null;
}

export async function GET() {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const assignments = await prisma.assignment.findMany({
    where: { type: AssignmentType.SPEAKING },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(assignments);
}

export async function POST(request: NextRequest) {
  const session = await ensureAuthenticatedApi();
  const requestMeta = getRequestMeta(request);
  if (!session) return jsonError("Unauthorized", 401);

  const formData = await request.formData();
  const file = formData.get("file");
  const customTitle = sanitizeOptionalText(formData.get("title")?.toString());

  if (!(file instanceof File)) {
    return jsonError("请上传练习文件。");
  }

  const fileType = getSpeakingFileType(file.name);
  if (!fileType) {
    return jsonError("口语作业现在只支持上传 .txt 或 .rtf 文件。");
  }

  const rawText = await file.text();
  const sourceText = (fileType === "rtf" ? extractPlainTextFromRtf(rawText) : rawText).trim();
  if (!sourceText) {
    return jsonError("文件内容为空或无法读取。");
  }

  const title = customTitle ?? file.name.replace(/\.[^.]+$/, "");
  let structured: SpeakingStructuredContent;

  try {
    structured = buildSpeakingTextAssignment({ text: sourceText, title });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "文本拆句失败。");
  }

  const savedFile = await saveUploadedFile({
    file,
    bucket: "assignments/speaking",
    ...speakingUploadConfig
  });

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        title,
        type: AssignmentType.SPEAKING,
        originalFileName: file.name,
        originalFilePath: savedFile.relativePath,
        originalMimeType: savedFile.mimeType,
        originalContent: sourceText,
        aiStructuredContent: structured as unknown as Prisma.InputJsonValue,
        aiStatus: "SUCCEEDED",
        aiErrorMessage: null,
        status: AssignmentStatus.PENDING_REVIEW
      }
    });

    await tx.speakingUnit.createMany({
      data: structured.units.map((unit, index) => ({
        assignmentId: created.id,
        unitType: "SENTENCE",
        content: unit.content,
        orderIndex: index + 1
      }))
    });

    return created;
  });

  logAuditEvent({
    event: "assignments.speaking.upload",
    status: "success",
    ...requestMeta,
    resourceId: assignment.id
  });

  return jsonOk(
    {
      success: true,
      id: assignment.id,
      aiStatus: "SUCCEEDED",
      sourceStrategy: `${fileType}-sentence-split`,
      message: "口语作业已上传，并按句子拆分完成。"
    },
    201
  );
}
