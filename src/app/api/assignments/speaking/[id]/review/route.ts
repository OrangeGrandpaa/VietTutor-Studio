import { AssignmentStatus, SpeakingReviewLevel } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildSpeakingReviewGroups } from "@/lib/assignment/speaking";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/utils/http";

const reviewScores: Record<SpeakingReviewLevel, number> = {
  [SpeakingReviewLevel.ACCURATE]: 10,
  [SpeakingReviewLevel.OKAY]: 5,
  [SpeakingReviewLevel.MUMBLING]: 0
};

function mapReviewLevel(value: string | undefined) {
  switch (value) {
    case SpeakingReviewLevel.ACCURATE:
      return SpeakingReviewLevel.ACCURATE;
    case SpeakingReviewLevel.OKAY:
      return SpeakingReviewLevel.OKAY;
    case SpeakingReviewLevel.MUMBLING:
      return SpeakingReviewLevel.MUMBLING;
    default:
      return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        speakingUnitId?: string;
        reviewLevel?: string;
      }
    | null;

  const reviewLevel = mapReviewLevel(body?.reviewLevel);

  if (!body?.speakingUnitId || !reviewLevel) {
    return jsonError("缺少朗读句子或批阅结果。");
  }

  const updatedUnits = await prisma.speakingUnit.updateMany({
    where: {
      id: body.speakingUnitId,
      assignmentId: id
    },
    data: {
      reviewLevel,
      reviewScore: reviewScores[reviewLevel]
    }
  });

  if (updatedUnits.count === 0) {
    return jsonError("朗读句子不存在。", 404);
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      speakingUnits: {
        include: {
          recordings: {
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!assignment) {
    return jsonError("作业不存在。", 404);
  }

  const { stats } = buildSpeakingReviewGroups(assignment.speakingUnits);
  const nextStatus =
    stats.reviewedUnits === 0
      ? AssignmentStatus.PENDING_REVIEW
      : stats.reviewedUnits >= stats.totalUnits
        ? AssignmentStatus.REVIEWED
        : AssignmentStatus.REVIEWING;

  await prisma.assignment.update({
    where: { id },
    data: {
      overallScore: stats.averageOverallScore,
      status: nextStatus
    }
  });

  return jsonOk({ success: true, reviewLevel, reviewScore: reviewScores[reviewLevel], stats });
}
