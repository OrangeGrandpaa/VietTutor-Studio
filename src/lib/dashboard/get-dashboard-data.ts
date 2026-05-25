import { AssignmentStatus, AssignmentType, ProgressStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

function roundMetric(value: number | null | undefined) {
  return typeof value === "number" ? Math.round(value) : 0;
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
    speakingScore,
    recentWriting,
    recentSpeaking,
    trendAssignments,
    materialStatusGroups,
    materialProgress,
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
    prisma.assignment.aggregate({
      where: { type: AssignmentType.SPEAKING, overallScore: { not: null } },
      _avg: { overallScore: true }
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
        createdAt: true
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
        createdAt: true
      }
    }),
    prisma.assignment.findMany({
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
    prisma.courseMaterial.groupBy({
      by: ["progressStatus"],
      _count: { _all: true }
    }),
    prisma.courseMaterial.aggregate({
      _avg: { progressPercent: true }
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

  const materialCountByStatus = new Map(
    materialStatusGroups.map((item) => [item.progressStatus, item._count._all])
  );

  const trend = trendAssignments
    .slice()
    .reverse()
    .map((item) => ({
      date: item.createdAt.toISOString().slice(5, 10),
      accuracy: item.type === AssignmentType.WRITING ? item.accuracyScore ?? 0 : item.overallScore ?? 0
    }));

  const activityDates = [
    ...assignmentActivityDates.map((item) => item.createdAt.toISOString().slice(0, 10)),
    ...materialActivityDates.map((item) => item.createdAt.toISOString().slice(0, 10))
  ];

  return {
    overview: {
      totalAssignments,
      pendingAssignments,
      completedAssignments,
      averageAccuracy: roundMetric(reviewedAccuracy._avg.accuracyScore)
    },
    scores: {
      writingAverage: roundMetric(writingAccuracy._avg.accuracyScore),
      speakingAverage: roundMetric(speakingScore._avg.overallScore)
    },
    recentWriting,
    recentSpeaking,
    trend,
    materials: {
      inProgress: materialCountByStatus.get(ProgressStatus.IN_PROGRESS) ?? 0,
      completed: materialCountByStatus.get(ProgressStatus.COMPLETED) ?? 0,
      needsReview: materialCountByStatus.get(ProgressStatus.NEEDS_REVIEW) ?? 0,
      averageProgress: roundMetric(materialProgress._avg.progressPercent)
    },
    achievements: {
      streakDays: calculateStreak(activityDates),
      recordingsCount,
      completedMaterials: materialCountByStatus.get(ProgressStatus.COMPLETED) ?? 0,
      bestAccuracy: reviewedAccuracy._max.accuracyScore ?? 0
    }
  };
}
