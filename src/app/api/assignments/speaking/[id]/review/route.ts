import { AssignmentType, RecordingKind, SpeakingReviewLevel } from "@prisma/client";
import { NextRequest } from "next/server";

import { refreshSpeakingAssignmentSummary } from "@/lib/assignment/speaking-summary";
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

  const result = await prisma.$transaction(async (tx) => {
    const unit = await tx.speakingUnit.findFirst({
      where: {
        id: body.speakingUnitId,
        assignmentId: id,
        assignment: { type: AssignmentType.SPEAKING }
      },
      select: {
        id: true,
        recordings: {
          where: { kind: RecordingKind.STUDENT },
          take: 1,
          select: { id: true }
        }
      }
    });

    if (!unit) {
      return { error: "NOT_FOUND" as const };
    }

    if (unit.recordings.length === 0) {
      return { error: "NO_RECORDING" as const };
    }

    await tx.speakingUnit.update({
      where: { id: unit.id },
      data: {
        reviewLevel,
        reviewScore: reviewScores[reviewLevel]
      }
    });

    const stats = await refreshSpeakingAssignmentSummary(tx, id);
    return { stats };
  });

  if ("error" in result && result.error === "NOT_FOUND") {
    return jsonError("朗读句子不存在。", 404);
  }

  if ("error" in result && result.error === "NO_RECORDING") {
    return jsonError("请先保存学生录音，再进行发音判断。", 400);
  }

  return jsonOk({
    success: true,
    reviewLevel,
    reviewScore: reviewScores[reviewLevel],
    stats: result.stats
  });
}
