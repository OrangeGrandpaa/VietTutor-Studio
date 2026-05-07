import { AssignmentStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { structureWritingAssignment } from "@/lib/ai/kimi";
import { flattenWritingQuestions } from "@/lib/assignment/writing";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { mapDisplayType } from "@/lib/utils/mapping";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
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

  const assignment = await prisma.assignment.findUnique({ where: { id } });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  if (body?.action === "retry-ai") {
    try {
      const structured = await structureWritingAssignment(assignment.originalContent);
      const questions = flattenWritingQuestions(structured);

      await prisma.$transaction(async (tx) => {
        await tx.teacherFeedback.deleteMany({ where: { assignmentId: id } });
        await tx.assignmentSection.deleteMany({ where: { assignmentId: id } });

        await tx.assignment.update({
          where: { id },
          data: {
            title: structured.title || assignment.title,
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
      });

      return jsonOk({ success: true, message: "AI 结构化已重新生成。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 结构化失败。";

      await prisma.assignment.update({
        where: { id },
        data: {
          aiStatus: "FAILED",
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
    where: { id },
    data: { title }
  });

  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({ where: { id } });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  await prisma.assignment.delete({ where: { id } });
  await deleteFile(assignment.originalFilePath);

  return jsonOk({ success: true });
}
