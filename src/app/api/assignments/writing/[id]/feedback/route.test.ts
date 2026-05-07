import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const findSection = vi.fn();
const findExistingFeedback = vi.fn();
const updateFeedback = vi.fn();
const createFeedback = vi.fn();
const findAssignment = vi.fn();
const updateAssignment = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  ensureAuthenticatedApi
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignmentSection: {
      findFirst: findSection
    },
    teacherFeedback: {
      findFirst: findExistingFeedback,
      update: updateFeedback,
      create: createFeedback
    },
    assignment: {
      findUnique: findAssignment,
      update: updateAssignment
    }
  }
}));

describe("writing feedback route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce(null);
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/assignments/writing/a1/feedback", {
        method: "POST",
        body: JSON.stringify({})
      }) as NextRequest,
      { params: Promise.resolve({ id: "a1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("creates feedback and updates assignment stats", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce({ id: "session-1" });
    findSection.mockResolvedValueOnce({
      id: "section-1",
      assignmentId: "assignment-1",
      originalText: "Question"
    });
    findExistingFeedback.mockResolvedValueOnce(null);
    createFeedback.mockResolvedValueOnce({
      id: "feedback-1"
    });
    findAssignment.mockResolvedValueOnce({
      id: "assignment-1",
      aiStructuredContent: {
        title: "Demo",
        assignment_type: "writing",
        parts: [
          {
            part_title: "Part 1",
            instruction: "",
            questions: [
              {
                question_number: 1,
                prompt: "Question",
                answer: "Answer",
                detected_level: "A1",
                suggested_display_type: "sentence"
              }
            ]
          }
        ]
      },
      sections: [
        {
          id: "section-1",
          assignmentId: "assignment-1",
          sectionTitle: "Q1",
          originalText: "Question",
          vietnameseText: "Answer",
          chineseTranslation: null,
          detectedLevel: "A1",
          displayType: "SENTENCE",
          orderIndex: 1,
          createdAt: new Date("2026-05-07T00:00:00.000Z"),
          updatedAt: new Date("2026-05-07T00:00:00.000Z"),
          feedbacks: [
            {
              id: "feedback-1",
              assignmentId: "assignment-1",
              sectionId: "section-1",
              explanation: "Correct",
              score: 100,
              createdAt: new Date("2026-05-07T00:00:00.000Z"),
              updatedAt: new Date("2026-05-07T00:00:00.000Z")
            }
          ]
        }
      ]
    });
    updateAssignment.mockResolvedValueOnce({});

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/assignments/writing/assignment-1/feedback", {
        method: "POST",
        body: JSON.stringify({
          sectionId: "section-1",
          isCorrect: true,
          note: "Correct"
        })
      }) as NextRequest,
      { params: Promise.resolve({ id: "assignment-1" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createFeedback).toHaveBeenCalledWith({
      data: {
        assignmentId: "assignment-1",
        sectionId: "section-1",
        explanation: "Correct",
        score: 100
      }
    });
    expect(updateAssignment).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        accuracyScore: 100,
        status: "REVIEWED"
      }
    });
    expect(payload.success).toBe(true);
    expect(payload.stats.accuracy).toBe(100);
  });
});
