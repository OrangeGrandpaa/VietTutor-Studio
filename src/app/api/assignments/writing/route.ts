import { AssignmentStatus, AssignmentType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildWritingFallback } from "@/lib/ai/fallback";
import { structureWritingAssignment } from "@/lib/ai/kimi";
import { flattenWritingQuestions } from "@/lib/assignment/writing";
import {
  assignmentUploadConfig,
  extractAssignmentSourceText
} from "@/lib/assignment/source-extraction";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { mapDisplayType } from "@/lib/utils/mapping";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

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

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

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

  let structured = buildWritingFallback(extracted.text);
  let aiStatus: "SUCCEEDED" | "FAILED" = "FAILED";
  let aiErrorMessage: string | null = "AI 结构化尚未执行。";

  try {
    structured = await structureWritingAssignment(extracted.text);
    aiStatus = "SUCCEEDED";
    aiErrorMessage = null;
  } catch (error) {
    aiStatus = "FAILED";
    aiErrorMessage = error instanceof Error ? error.message : "AI 结构化失败。";
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
        aiSummary: structured.ai_summary,
        aiSuggestedReviewPoints: structured.suggested_review_points as unknown as Prisma.InputJsonValue,
        aiStatus,
        aiErrorMessage,
        status: AssignmentStatus.PENDING_REVIEW
      }
    });

    if (questions.length > 0) {
      await tx.assignmentSection.createMany({
        data: questions.map((question, index) => ({
          assignmentId: created.id,
          sectionTitle: `${question.partTitle} / 第 ${question.questionNumber} 题`,
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
}
