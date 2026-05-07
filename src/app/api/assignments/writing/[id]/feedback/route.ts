import { AssignmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildWritingReviewGroups } from "@/lib/assignment/writing";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        sectionId?: string;
        isCorrect?: boolean;
        note?: string;
      }
    | null;

  if (!body?.sectionId || typeof body.isCorrect !== "boolean") {
    return jsonError("缺少题目或判定结果。");
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

  const note = sanitizeOptionalText(body.note) ?? null;
  const score = body.isCorrect ? 100 : 0;

  const existing = await prisma.teacherFeedback.findFirst({
    where: {
      assignmentId: id,
      sectionId: body.sectionId
    },
    orderBy: { updatedAt: "desc" }
  });

  if (existing) {
    await prisma.teacherFeedback.update({
      where: { id: existing.id },
      data: {
        explanation: note,
        score
      }
    });
  } else {
    await prisma.teacherFeedback.create({
      data: {
        assignmentId: id,
        sectionId: body.sectionId,
        explanation: note,
        score
      }
    });
  }

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
    message: body.isCorrect ? "已标记为正确。" : "已标记为错误。",
    stats
  });
}
