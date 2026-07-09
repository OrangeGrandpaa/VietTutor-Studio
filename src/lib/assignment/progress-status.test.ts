import { describe, expect, it } from "vitest";

import {
  getAssignmentProgressStatus,
  getItemProgressStatus,
  progressStatusLabel
} from "@/lib/assignment/progress-status";

describe("assignment progress status helpers", () => {
  it("labels assignment progress from student work and review counts", () => {
    expect(
      getAssignmentProgressStatus({
        totalItems: 4,
        startedItems: 0,
        completedItems: 0,
        reviewedItems: 0
      })
    ).toBe("NOT_STARTED");
    expect(
      getAssignmentProgressStatus({
        totalItems: 4,
        startedItems: 2,
        completedItems: 1,
        reviewedItems: 0
      })
    ).toBe("IN_PROGRESS");
    expect(
      getAssignmentProgressStatus({
        totalItems: 4,
        startedItems: 4,
        completedItems: 4,
        reviewedItems: 0
      })
    ).toBe("UNREVIEWED");
    expect(
      getAssignmentProgressStatus({
        totalItems: 4,
        startedItems: 4,
        completedItems: 4,
        reviewedItems: 2
      })
    ).toBe("REVIEWING");
    expect(
      getAssignmentProgressStatus({
        totalItems: 4,
        startedItems: 4,
        completedItems: 4,
        reviewedItems: 4
      })
    ).toBe("REVIEWED");
  });

  it("labels single-item progress", () => {
    expect(getItemProgressStatus({ completionStatus: "NOT_STARTED", isReviewed: false })).toBe("NOT_STARTED");
    expect(getItemProgressStatus({ completionStatus: "IN_PROGRESS", isReviewed: false })).toBe("IN_PROGRESS");
    expect(getItemProgressStatus({ completionStatus: "COMPLETED", isReviewed: false })).toBe("UNREVIEWED");
    expect(getItemProgressStatus({ completionStatus: "NOT_STARTED", isReviewed: true })).toBe("REVIEWED");
  });

  it("uses the requested Chinese labels", () => {
    expect(progressStatusLabel("NOT_STARTED")).toBe("还没做:3");
    expect(progressStatusLabel("IN_PROGRESS")).toBe("还没做完！");
    expect(progressStatusLabel("UNREVIEWED")).toBe("未批阅");
    expect(progressStatusLabel("REVIEWING")).toBe("批阅中");
    expect(progressStatusLabel("REVIEWED")).toBe("已批阅");
  });
});
