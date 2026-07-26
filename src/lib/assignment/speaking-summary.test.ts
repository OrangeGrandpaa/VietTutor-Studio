import { AssignmentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSpeakingAssignmentSummary } from "@/lib/assignment/speaking-summary";

const findFirst = vi.fn();
const update = vi.fn();
const client = {
  assignment: {
    findFirst,
    update
  }
};

function unit(id: string, reviewScore: number | null, hasStudentRecording: boolean) {
  const now = new Date("2026-01-01T00:00:00Z");

  return {
    id,
    assignmentId: "assignment-1",
    unitType: "SENTENCE" as const,
    content: id,
    orderIndex: Number(id.at(-1)),
    reviewLevel: reviewScore === null ? null : "ACCURATE" as const,
    reviewScore,
    createdAt: now,
    updatedAt: now,
    recordings: hasStudentRecording
      ? [
          {
            id: `recording-${id}`,
            assignmentId: null,
            speakingUnitId: id,
            kind: "STUDENT" as const,
            filePath: `recordings/${id}.webm`,
            duration: 1,
            mimeType: "audio/webm",
            createdAt: now,
            updatedAt: now
          }
        ]
      : []
  };
}

describe("refreshSpeakingAssignmentSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
  });

  it("keeps an unreviewed assignment pending with no score", async () => {
    findFirst.mockResolvedValueOnce({
      speakingUnits: [unit("unit-1", null, true)]
    });

    await refreshSpeakingAssignmentSummary(client as never, "assignment-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        overallScore: null,
        status: AssignmentStatus.PENDING_REVIEW
      }
    });
  });

  it("marks a partially reviewed assignment as reviewing", async () => {
    findFirst.mockResolvedValueOnce({
      speakingUnits: [unit("unit-1", 10, true), unit("unit-2", null, true)]
    });

    await refreshSpeakingAssignmentSummary(client as never, "assignment-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        overallScore: 10,
        status: AssignmentStatus.REVIEWING
      }
    });
  });

  it("marks all reviewed units complete and averages their scores", async () => {
    findFirst.mockResolvedValueOnce({
      speakingUnits: [unit("unit-1", 10, true), unit("unit-2", 5, true)]
    });

    const stats = await refreshSpeakingAssignmentSummary(client as never, "assignment-1");

    expect(stats?.averageOverallScore).toBe(8);
    expect(update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        overallScore: 8,
        status: AssignmentStatus.REVIEWED
      }
    });
  });
});
