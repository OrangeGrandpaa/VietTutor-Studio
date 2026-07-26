import { AssignmentStatus, AssignmentType, Prisma } from "@prisma/client";

import { buildSpeakingReviewGroups } from "@/lib/assignment/speaking";

type SpeakingSummaryClient = Pick<Prisma.TransactionClient, "assignment">;

export async function refreshSpeakingAssignmentSummary(
  client: SpeakingSummaryClient,
  assignmentId: string
) {
  const assignment = await client.assignment.findFirst({
    where: {
      id: assignmentId,
      type: AssignmentType.SPEAKING
    },
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
    return null;
  }

  const { stats } = buildSpeakingReviewGroups(assignment.speakingUnits);
  const status =
    stats.reviewedUnits === 0
      ? AssignmentStatus.PENDING_REVIEW
      : stats.reviewedUnits >= stats.totalUnits
        ? AssignmentStatus.REVIEWED
        : AssignmentStatus.REVIEWING;

  await client.assignment.update({
    where: { id: assignmentId },
    data: {
      overallScore: stats.averageOverallScore,
      status
    }
  });

  return stats;
}
