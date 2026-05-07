import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const upsertFeedback = vi.fn();
const findAssignment = vi.fn();
const updateAssignment = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  ensureAuthenticatedApi
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    speakingFeedback: {
      upsert: upsertFeedback
    },
    assignment: {
      findUnique: findAssignment,
      update: updateAssignment
    }
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

  it("upserts feedback and updates assignment score", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce({ id: "session-1" });
    upsertFeedback.mockResolvedValueOnce({
      id: "feedback-1",
      recordingId: "recording-1",
      teacherSuggestion: "Slow down",
      overallScore: 80
    });
    findAssignment.mockResolvedValueOnce({
      id: "assignment-1",
      speakingUnits: [
        {
          id: "unit-1",
          assignmentId: "assignment-1",
          unitType: "SENTENCE",
          content: "Xin chao",
          orderIndex: 1,
          createdAt: new Date("2026-05-07T00:00:00.000Z"),
          updatedAt: new Date("2026-05-07T00:00:00.000Z"),
          recordings: [
            {
              id: "recording-1",
              speakingUnitId: "unit-1",
              filePath: "uploads/recording-1.webm",
              duration: 3,
              mimeType: "audio/webm",
              createdAt: new Date("2026-05-07T00:00:00.000Z"),
              updatedAt: new Date("2026-05-07T00:00:00.000Z"),
              feedback: {
                id: "feedback-1",
                recordingId: "recording-1",
                teacherSuggestion: "Slow down",
                overallScore: 80,
                createdAt: new Date("2026-05-07T00:00:00.000Z"),
                updatedAt: new Date("2026-05-07T00:00:00.000Z")
              }
            }
          ]
        }
      ]
    });
    updateAssignment.mockResolvedValueOnce({});

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/assignments/speaking/assignment-1/review", {
        method: "POST",
        body: JSON.stringify({
          recordingId: "recording-1",
          teacherSuggestion: "Slow down",
          overallScore: 80
        })
      }) as NextRequest,
      { params: Promise.resolve({ id: "assignment-1" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upsertFeedback).toHaveBeenCalledWith({
      where: { recordingId: "recording-1" },
      update: {
        teacherSuggestion: "Slow down",
        overallScore: 80
      },
      create: {
        recordingId: "recording-1",
        teacherSuggestion: "Slow down",
        overallScore: 80
      }
    });
    expect(updateAssignment).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        overallScore: 80,
        status: "REVIEWED"
      }
    });
    expect(payload.success).toBe(true);
    expect(payload.stats.averageOverallScore).toBe(80);
  });
});
