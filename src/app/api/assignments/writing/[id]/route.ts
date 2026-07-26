import { AiProcessStatus, AssignmentStatus, AssignmentType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { structureWritingAssignment } from "@/lib/ai/kimi";
import { repairTextMojibake } from "@/lib/assignment/text-encoding";
import { flattenWritingQuestions } from "@/lib/assignment/writing";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { formatErrorForDisplay } from "@/lib/utils/error";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { mapDisplayType } from "@/lib/utils/mapping";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

function hasWritingUserWork(assignment: {
  sections: Array<{ vietnameseText: string | null }>;
  feedbacks: Array<{ id: string }>;
}) {
  return (
    assignment.sections.some((section) => Boolean(section.vietnameseText?.trim())) ||
    assignment.feedbacks.length > 0
  );
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id, type: AssignmentType.WRITING },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: { feedbacks: { orderBy: { createdAt: "desc" } } }
      },
      feedbacks: {
        where: { sectionId: null },
        orderBy: { createdAt: "desc" }
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
    where: { id, type: AssignmentType.WRITING },
    include: {
      sections: {
        select: { vietnameseText: true }
      },
      feedbacks: {
        select: { id: true }
      }
    }
  });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  if (body?.action === "retry-ai") {
    if (assignment.aiStatus === AiProcessStatus.PENDING) {
      return jsonError("AI 正在结构化，请勿重复提交。", 409);
    }

    if (hasWritingUserWork(assignment)) {
      return jsonError("题目已有答案或批阅，无法重新结构化，以免覆盖现有内容。", 409);
    }

    const previousAiStatus = assignment.aiStatus;
    const previousAiErrorMessage = assignment.aiErrorMessage;
    const claim = await prisma.assignment.updateMany({
      where: {
        id,
        type: AssignmentType.WRITING,
        aiStatus: { not: AiProcessStatus.PENDING }
      },
      data: {
        aiStatus: AiProcessStatus.PENDING,
        aiErrorMessage: null
      }
    });

    if (claim.count === 0) {
      return jsonError("AI 正在结构化，请勿重复提交。", 409);
    }

    try {
      const sourceText = repairTextMojibake(assignment.originalContent);
      const structured = await structureWritingAssignment(sourceText);
      const questions = flattenWritingQuestions(structured);

      if (questions.length === 0) {
        throw new Error("AI 结构化没有识别到可展示题目。");
      }

      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.assignment.findUnique({
          where: { id, type: AssignmentType.WRITING },
          include: {
            sections: {
              select: { vietnameseText: true }
            },
            feedbacks: {
              select: { id: true }
            }
          }
        });

        if (!current) {
          return "missing" as const;
        }

        if (hasWritingUserWork(current)) {
          await tx.assignment.update({
            where: { id, type: AssignmentType.WRITING },
            data: {
              aiStatus: previousAiStatus,
              aiErrorMessage: previousAiErrorMessage
            }
          });
          return "protected" as const;
        }

        await tx.teacherFeedback.deleteMany({ where: { assignmentId: id } });
        await tx.assignmentSection.deleteMany({ where: { assignmentId: id } });

        await tx.assignment.update({
          where: { id, type: AssignmentType.WRITING },
          data: {
            title: structured.title || assignment.title,
            originalContent: sourceText,
            aiStructuredContent: structured as unknown as Prisma.InputJsonValue,
            aiStatus: "SUCCEEDED",
            aiErrorMessage: null,
            accuracyScore: null,
            status: AssignmentStatus.PENDING_REVIEW
          }
        });

        await tx.assignmentSection.createMany({
          data: questions.map((question, index) => ({
            assignmentId: id,
            sectionTitle: `${question.partTitle} / 第 ${question.questionNumber} 题`,
            originalText: question.prompt,
            vietnameseText: null,
            chineseTranslation: null,
            detectedLevel: question.detectedLevel,
            displayType: mapDisplayType(question.displayType),
            orderIndex: index + 1
          }))
        });

        return "updated" as const;
      });

      if (result === "missing") {
        return jsonError("作业不存在。", 404);
      }

      if (result === "protected") {
        return jsonError("重试期间题目已产生答案或批阅，已保留现有内容。", 409);
      }

      return jsonOk({ success: true, message: "AI 结构化已重新生成。" });
    } catch (error) {
      const message = formatErrorForDisplay(error);

      await prisma.assignment.updateMany({
        where: {
          id,
          type: AssignmentType.WRITING,
          aiStatus: AiProcessStatus.PENDING
        },
        data: {
          aiStatus: AiProcessStatus.FAILED,
          aiErrorMessage: message
        }
      });

      return jsonError(message, 500);
    }
  }

  const title = sanitizeOptionalText(body?.title);

  if (!title) {
    return jsonError("没有可更新的内容。");
  }

  const updated = await prisma.assignment.update({
    where: { id, type: AssignmentType.WRITING },
    data: { title }
  });

  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id, type: AssignmentType.WRITING }
  });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  await prisma.assignment.delete({ where: { id, type: AssignmentType.WRITING } });
  await deleteFile(assignment.originalFilePath);

  return jsonOk({ success: true });
}
