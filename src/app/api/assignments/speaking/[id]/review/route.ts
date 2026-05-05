import { AssignmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { buildSpeakingReviewGroups } from "@/lib/assignment/speaking";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        recordingId?: string;
        teacherSuggestion?: string;
        overallScore?: number;
      }
    | null;

  if (!body?.recordingId) {
    return jsonError("缺少录音 ID。");
  }

  const feedback = await prisma.speakingFeedback.upsert({
    where: { recordingId: body.recordingId },
    update: {
      pronunciationIssue: null,
      toneIssue: null,
      fluencyComment: null,
      speedComment: null,
      repeatWords: null,
      teacherSuggestion: sanitizeOptionalText(body.teacherSuggestion),
      pronunciationScore: null,
      fluencyScore: null,
      toneScore: null,
      overallScore: body.overallScore ?? null
    },
    create: {
      recordingId: body.recordingId,
      pronunciationIssue: null,
      toneIssue: null,
      fluencyComment: null,
      speedComment: null,
      repeatWords: null,
      teacherSuggestion: sanitizeOptionalText(body.teacherSuggestion),
      pronunciationScore: null,
      fluencyScore: null,
      toneScore: null,
      overallScore: body.overallScore ?? null
    }
  });

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      speakingUnits: {
        include: {
          recordings: {
            include: { feedback: true },
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
  const latestReviewedRecordings = assignment.speakingUnits
    .map((unit) => unit.recordings[0]?.feedback)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const pronunciationScores = latestReviewedRecordings.flatMap((item) =>
    item.pronunciationScore === null ? [] : [item.pronunciationScore]
  );
  const fluencyScores = latestReviewedRecordings.flatMap((item) =>
    item.fluencyScore === null ? [] : [item.fluencyScore]
  );
  const toneScores = latestReviewedRecordings.flatMap((item) =>
    item.toneScore === null ? [] : [item.toneScore]
  );

  const nextStatus =
    stats.reviewedUnits === 0
      ? AssignmentStatus.PENDING_REVIEW
      : stats.reviewedUnits >= stats.totalUnits
        ? AssignmentStatus.REVIEWED
        : AssignmentStatus.REVIEWING;

  await prisma.assignment.update({
    where: { id },
    data: {
      pronunciationScore: average(pronunciationScores),
      fluencyScore: average(fluencyScores),
      toneScore: average(toneScores),
      overallScore: stats.averageOverallScore,
      teacherSummary: null,
      status: nextStatus
    }
  });

  return jsonOk({ success: true, feedback, stats });
}
