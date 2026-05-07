import { AssignmentType, ProgressStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

function calculateStreak(dateKeys: string[]) {
  const uniqueKeys = Array.from(new Set(dateKeys)).sort().reverse();
  let streak = 0;
  const cursor = new Date();

  for (let offset = 0; offset < uniqueKeys.length; offset += 1) {
    const expected = new Date(cursor);
    expected.setDate(cursor.getDate() - offset);
    const key = expected.toISOString().slice(0, 10);

    if (uniqueKeys.includes(key)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export async function getDashboardData() {
  const [assignments, recentAssignments, materials, recordingsCount] = await Promise.all([
    prisma.assignment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
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
        title: true,
        type: true,
        status: true,
        accuracyScore: true,
        overallScore: true,
        createdAt: true
      }
    }),
    prisma.courseMaterial.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        progressStatus: true,
        progressPercent: true,
        createdAt: true,
        category: true
      }
    }),
    prisma.recording.count()
  ]);

  const reviewedAssignments = assignments.filter((item) => item.accuracyScore !== null);
  const writingAssignments = assignments.filter((item) => item.type === AssignmentType.WRITING);
  const speakingAssignments = assignments.filter((item) => item.type === AssignmentType.SPEAKING);

  const averageAccuracy =
    reviewedAssignments.length > 0
      ? Math.round(
          reviewedAssignments.reduce((sum, item) => sum + (item.accuracyScore ?? 0), 0) /
            reviewedAssignments.length
        )
      : 0;

  const writingAverage =
    writingAssignments.filter((item) => item.accuracyScore !== null).length > 0
      ? Math.round(
          writingAssignments.reduce((sum, item) => sum + (item.accuracyScore ?? 0), 0) /
            writingAssignments.filter((item) => item.accuracyScore !== null).length
        )
      : 0;

  const speakingAverage =
    speakingAssignments.filter((item) => item.overallScore !== null).length > 0
      ? Math.round(
          speakingAssignments.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) /
            speakingAssignments.filter((item) => item.overallScore !== null).length
        )
      : 0;

  const trend = recentAssignments
    .slice()
    .reverse()
    .map((item) => ({
      date: item.createdAt.toISOString().slice(5, 10),
      accuracy: item.type === AssignmentType.WRITING ? item.accuracyScore ?? 0 : item.overallScore ?? 0
    }));

  const activityDates = [
    ...assignments.map((item) => item.createdAt.toISOString().slice(0, 10)),
    ...materials.map((item) => item.createdAt.toISOString().slice(0, 10))
  ];

  return {
    overview: {
      totalAssignments: assignments.length,
      pendingAssignments: assignments.filter((item) => item.status !== "REVIEWED").length,
      completedAssignments: assignments.filter((item) => item.status === "REVIEWED").length,
      averageAccuracy
    },
    scores: {
      writingAverage,
      speakingAverage
    },
    recentWriting: recentAssignments.filter((item) => item.type === AssignmentType.WRITING).slice(0, 5),
    recentSpeaking: recentAssignments.filter((item) => item.type === AssignmentType.SPEAKING).slice(0, 5),
    trend,
    materials: {
      inProgress: materials.filter((item) => item.progressStatus === ProgressStatus.IN_PROGRESS).length,
      completed: materials.filter((item) => item.progressStatus === ProgressStatus.COMPLETED).length,
      needsReview: materials.filter((item) => item.progressStatus === ProgressStatus.NEEDS_REVIEW).length,
      averageProgress:
        materials.length > 0
          ? Math.round(materials.reduce((sum, item) => sum + item.progressPercent, 0) / materials.length)
          : 0
    },
    achievements: {
      streakDays: calculateStreak(activityDates),
      recordingsCount,
      completedMaterials: materials.filter((item) => item.progressStatus === ProgressStatus.COMPLETED).length,
      bestAccuracy: Math.max(0, ...reviewedAssignments.map((item) => item.accuracyScore ?? 0))
    }
  };
}
