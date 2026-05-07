import { AssignmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildWritingReviewGroups } from "@/lib/assignment/writing";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        sectionId?: string;
        answer?: string;
      }
    | null;

  if (!body?.sectionId) {
    return jsonError("缺少题目。");
  }

  const section = await prisma.assignmentSection.findFirst({
    where: {
      id: body.sectionId,
      assignmentId: id
    }
  });

  if (!section) {
    return jsonError("题目不存在。", 404);
  }

  const nextAnswer = sanitizeOptionalText(body.answer) ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.assignmentSection.update({
      where: { id: body.sectionId },
      data: {
        vietnameseText: nextAnswer
      }
    });

    await tx.teacherFeedback.deleteMany({
      where: {
        assignmentId: id,
        sectionId: body.sectionId
      }
    });
  });

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: {
          feedbacks: {
            orderBy: { updatedAt: "desc" }
          }
        }
      }
    }
  });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  const { stats } = buildWritingReviewGroups(assignment.sections, assignment.aiStructuredContent);
  const nextStatus =
    stats.reviewedQuestions === 0
      ? AssignmentStatus.PENDING_REVIEW
      : stats.reviewedQuestions >= stats.totalQuestions
        ? AssignmentStatus.REVIEWED
        : AssignmentStatus.REVIEWING;

  await prisma.assignment.update({
    where: { id },
    data: {
      accuracyScore: stats.accuracy,
      status: nextStatus
    }
  });

  return jsonOk({
    success: true,
    message: "学生答案已保存，相关批阅结果已重置。",
    stats
  });
}
