import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const findSpeakingUnit = vi.fn();
const updateSpeakingUnit = vi.fn();
const refreshSpeakingAssignmentSummary = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
  callback({
    speakingUnit: {
      findFirst: findSpeakingUnit,
      update: updateSpeakingUnit
    }
  })
);

vi.mock("@/lib/auth/session", () => ({
  ensureAuthenticatedApi
}));

vi.mock("@/lib/assignment/speaking-summary", () => ({
  refreshSpeakingAssignmentSummary
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transaction
  }
}));

describe("speaking review route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce(null);
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/assignments/speaking/a1/review", {
        method: "POST",
        body: JSON.stringify({})
      }) as NextRequest,
      { params: Promise.resolve({ id: "a1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("rejects a review when the sentence has no student recording", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce({ id: "session-1" });
    findSpeakingUnit.mockResolvedValueOnce({ id: "unit-1", recordings: [] });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/assignments/speaking/assignment-1/review", {
        method: "POST",
        body: JSON.stringify({
          speakingUnitId: "unit-1",
          reviewLevel: "ACCURATE"
        })
      }) as NextRequest,
      { params: Promise.resolve({ id: "assignment-1" }) }
    );

    expect(response.status).toBe(400);
    expect(updateSpeakingUnit).not.toHaveBeenCalled();
  });

  it("updates the sentence review and refreshes assignment stats", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce({ id: "session-1" });
    findSpeakingUnit.mockResolvedValueOnce({
      id: "unit-1",
      recordings: [{ id: "recording-1" }]
    });
    refreshSpeakingAssignmentSummary.mockResolvedValueOnce({
      averageOverallScore: 10,
      reviewedUnits: 1,
      totalUnits: 1
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/assignments/speaking/assignment-1/review", {
        method: "POST",
        body: JSON.stringify({
          speakingUnitId: "unit-1",
          reviewLevel: "ACCURATE"
        })
      }) as NextRequest,
      { params: Promise.resolve({ id: "assignment-1" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateSpeakingUnit).toHaveBeenCalledWith({
      where: { id: "unit-1" },
      data: {
        reviewLevel: "ACCURATE",
        reviewScore: 10
      }
    });
    expect(refreshSpeakingAssignmentSummary).toHaveBeenCalledWith(
      expect.objectContaining({ speakingUnit: expect.any(Object) }),
      "assignment-1"
    );
    expect(payload.success).toBe(true);
    expect(payload.stats.averageOverallScore).toBe(10);
  });
});
