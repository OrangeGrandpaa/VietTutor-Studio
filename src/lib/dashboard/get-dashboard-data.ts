import { AssignmentStatus, AssignmentType, MaterialFileType } from "@prisma/client";

import { getAssignmentProgressStatus } from "@/lib/assignment/progress-status";
import { getWritingQuestionCompletionStatus } from "@/lib/assignment/writing";
import { prisma } from "@/lib/db/prisma";

function roundMetric(value: number | null | undefined) {
  return typeof value === "number" ? Math.round(value) : 0;
}

function normalizeSpeakingScore(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return value > 10 ? Math.round(value / 10) : Math.round(value);
}

function speakingScoreToPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return 0;
  }

  return value > 10 ? Math.round(value) : Math.round(value * 10);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function calculateStreak(dateKeys: string[]) {
  const uniqueKeys = Array.from(new Set(dateKeys)).sort().reverse();
  const keySet = new Set(uniqueKeys);
  let streak = 0;
  const cursor = new Date();

  for (let offset = 0; offset < uniqueKeys.length; offset += 1) {
    const expected = new Date(cursor);
    expected.setDate(cursor.getDate() - offset);
    const key = expected.toISOString().slice(0, 10);

    if (keySet.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export async function getDashboardData() {
  const activityStart = new Date();
  activityStart.setDate(activityStart.getDate() - 366);

  const [
    totalAssignments,
    pendingAssignments,
    completedAssignments,
    reviewedAccuracy,
    writingAccuracy,
    speakingAssignmentsForScore,
    recentWriting,
    recentSpeaking,
    trendAssignments,
    totalMaterials,
    materialTypeGroups,
    materialActivityDates,
    assignmentActivityDates,
    recordingsCount
  ] = await Promise.all([
    prisma.assignment.count(),
    prisma.assignment.count({ where: { status: { not: AssignmentStatus.REVIEWED } } }),
    prisma.assignment.count({ where: { status: AssignmentStatus.REVIEWED } }),
    prisma.assignment.aggregate({
      where: { accuracyScore: { not: null } },
      _avg: { accuracyScore: true },
      _max: { accuracyScore: true }
    }),
    prisma.assignment.aggregate({
      where: { type: AssignmentType.WRITING, accuracyScore: { not: null } },
      _avg: { accuracyScore: true }
    }),
    prisma.assignment.findMany({
      where: { type: AssignmentType.SPEAKING, overallScore: { not: null } },
      select: { overallScore: true }
    }),
    prisma.assignment.findMany({
      where: { type: AssignmentType.WRITING },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        aiStatus: true,
        accuracyScore: true,
        overallScore: true,
        createdAt: true,
        sections: {
          select: {
            originalText: true,
            vietnameseText: true,
            feedbacks: {
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: { score: true }
            }
          }
        }
      }
    }),
    prisma.assignment.findMany({
      where: { type: AssignmentType.SPEAKING },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        aiStatus: true,
        accuracyScore: true,
        overallScore: true,
        createdAt: true,
        speakingUnits: {
          select: {
            reviewScore: true,
            recordings: {
              where: { kind: "STUDENT" },
              take: 1,
              select: { id: true }
            }
          }
        }
      }
    }),
    prisma.assignment.findMany({
      where: {
        OR: [
          { type: AssignmentType.WRITING, accuracyScore: { not: null } },
          { type: AssignmentType.SPEAKING, overallScore: { not: null } }
        ]
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        accuracyScore: true,
        overallScore: true,
        createdAt: true
      }
    }),
    prisma.courseMaterial.count(),
    prisma.courseMaterial.groupBy({
      by: ["fileType"],
      _count: { _all: true }
    }),
    prisma.courseMaterial.findMany({
      where: { createdAt: { gte: activityStart } },
      select: { createdAt: true }
    }),
    prisma.assignment.findMany({
      where: { createdAt: { gte: activityStart } },
      select: { createdAt: true }
    }),
    prisma.recording.count()
  ]);

  const materialCountByType = new Map(
    materialTypeGroups.map((item) => [item.fileType, item._count._all])
  );
  const mediaMaterials =
    (materialCountByType.get(MaterialFileType.IMAGE) ?? 0) +
    (materialCountByType.get(MaterialFileType.AUDIO) ?? 0) +
    (materialCountByType.get(MaterialFileType.VIDEO) ?? 0);

  const trend = trendAssignments
    .slice()
    .reverse()
    .map((item) => ({
      date: item.createdAt.toISOString().slice(5, 10),
      writingAccuracy:
        item.type === AssignmentType.WRITING ? item.accuracyScore : null,
      speakingScore:
        item.type === AssignmentType.SPEAKING
          ? speakingScoreToPercent(item.overallScore)
          : null
    }));
  const speakingScores = speakingAssignmentsForScore.flatMap((item) => {
    const normalized = normalizeSpeakingScore(item.overallScore);
    return normalized === null ? [] : [normalized];
  });

  const activityDates = [
    ...assignmentActivityDates.map((item) => item.createdAt.toISOString().slice(0, 10)),
    ...materialActivityDates.map((item) => item.createdAt.toISOString().slice(0, 10))
  ];
  const recentWritingWithProgress = recentWriting.map((assignment) => {
    const questionCompletionStatuses = assignment.sections.map((section) =>
      getWritingQuestionCompletionStatus(section.originalText, section.vietnameseText)
    );
    const startedQuestions = questionCompletionStatuses.filter((status) => status !== "NOT_STARTED").length;
    const completedQuestions = questionCompletionStatuses.filter((status) => status === "COMPLETED").length;
    const reviewedQuestions = assignment.sections.filter(
      (section) => section.feedbacks[0]?.score !== null && section.feedbacks[0]?.score !== undefined
    ).length;
    const { sections, ...item } = assignment;

    return {
      ...item,
      progressStatus: getAssignmentProgressStatus({
        totalItems: sections.length,
        startedItems: startedQuestions,
        completedItems: completedQuestions,
        reviewedItems: reviewedQuestions
      })
    };
  });
  const recentSpeakingWithProgress = recentSpeaking.map((assignment) => {
    const recordedUnits = assignment.speakingUnits.filter((unit) => unit.recordings.length > 0).length;
    const reviewedUnits = assignment.speakingUnits.filter(
      (unit) => unit.reviewScore !== null && unit.reviewScore !== undefined
    ).length;
    const { speakingUnits, ...item } = assignment;

    return {
      ...item,
      progressStatus: getAssignmentProgressStatus({
        totalItems: speakingUnits.length,
        startedItems: recordedUnits,
        completedItems: recordedUnits,
        reviewedItems: reviewedUnits
      })
    };
  });

  return {
    overview: {
      totalAssignments,
      pendingAssignments,
      completedAssignments,
      averageAccuracy: roundMetric(reviewedAccuracy._avg.accuracyScore)
    },
    scores: {
      writingAverage: roundMetric(writingAccuracy._avg.accuracyScore),
      speakingAverage: average(speakingScores)
    },
    recentWriting: recentWritingWithProgress,
    recentSpeaking: recentSpeakingWithProgress,
    trend,
    materials: {
      total: totalMaterials,
      pdf: materialCountByType.get(MaterialFileType.PDF) ?? 0,
      word: materialCountByType.get(MaterialFileType.WORD) ?? 0,
      powerpoint: materialCountByType.get(MaterialFileType.POWERPOINT) ?? 0,
      media: mediaMaterials
    },
    achievements: {
      streakDays: calculateStreak(activityDates),
      recordingsCount,
      materialsCount: totalMaterials,
      bestAccuracy: reviewedAccuracy._max.accuracyScore ?? 0
    }
  };
}
