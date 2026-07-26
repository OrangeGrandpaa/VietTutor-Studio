import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const structureWritingAssignment = vi.fn();
const flattenWritingQuestions = vi.fn();
const repairTextMojibake = vi.fn();
const deleteFile = vi.fn();
const findAssignment = vi.fn();
const updateManyAssignments = vi.fn();
const updateAssignment = vi.fn();
const deleteAssignment = vi.fn();
const transaction = vi.fn();
const txFindAssignment = vi.fn();
const txUpdateAssignment = vi.fn();
const deleteFeedbacks = vi.fn();
const deleteSections = vi.fn();
const createSections = vi.fn();

const tx = {
  assignment: {
    findUnique: txFindAssignment,
    update: txUpdateAssignment
  },
  teacherFeedback: {
    deleteMany: deleteFeedbacks
  },
  assignmentSection: {
    deleteMany: deleteSections,
    createMany: createSections
  }
};

vi.mock("@/lib/auth/session", () => ({ ensureAuthenticatedApi }));
vi.mock("@/lib/ai/kimi", () => ({ structureWritingAssignment }));
vi.mock("@/lib/assignment/writing", () => ({ flattenWritingQuestions }));
vi.mock("@/lib/assignment/text-encoding", () => ({ repairTextMojibake }));
vi.mock("@/lib/storage", () => ({ deleteFile }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignment: {
      findUnique: findAssignment,
      updateMany: updateManyAssignments,
      update: updateAssignment,
      delete: deleteAssignment
    },
    $transaction: transaction
  }
}));

const baseAssignment = {
  id: "writing-1",
  title: "Writing",
  type: "WRITING",
  originalContent: "Question source",
  originalFilePath: null,
  aiStatus: "FAILED",
  aiErrorMessage: "Previous failure",
  sections: [],
  feedbacks: []
};

function patchRequest() {
  return new Request("http://localhost/api/assignments/writing/writing-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "retry-ai" })
  }) as NextRequest;
}

describe("writing assignment detail route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureAuthenticatedApi.mockResolvedValue({ id: "session-1" });
    repairTextMojibake.mockImplementation((value) => value);
    transaction.mockImplementation((callback) => callback(tx));
  });

  it("returns 404 when the id is not a writing assignment", async () => {
    findAssignment.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost") as NextRequest, {
      params: Promise.resolve({ id: "speaking-1" })
    });

    expect(response.status).toBe(404);
    expect(findAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "speaking-1", type: "WRITING" } })
    );
  });

  it("does not start another retry while AI is pending", async () => {
    findAssignment.mockResolvedValueOnce({ ...baseAssignment, aiStatus: "PENDING" });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(409);
    expect(updateManyAssignments).not.toHaveBeenCalled();
    expect(structureWritingAssignment).not.toHaveBeenCalled();
  });

  it.each([
    {
      sections: [{ vietnameseText: "Student answer" }],
      feedbacks: []
    },
    {
      sections: [{ vietnameseText: null }],
      feedbacks: [{ id: "feedback-1" }]
    }
  ])("protects existing answers or feedback before retry", async ({ sections, feedbacks }) => {
    findAssignment.mockResolvedValueOnce({
      ...baseAssignment,
      sections,
      feedbacks
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(409);
    expect(structureWritingAssignment).not.toHaveBeenCalled();
    expect(deleteSections).not.toHaveBeenCalled();
    expect(deleteFeedbacks).not.toHaveBeenCalled();
  });

  it("uses an atomic pending claim to reject a concurrent retry", async () => {
    findAssignment.mockResolvedValueOnce(baseAssignment);
    updateManyAssignments.mockResolvedValueOnce({ count: 0 });
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(409);
    expect(updateManyAssignments).toHaveBeenCalledWith({
      where: {
        id: "writing-1",
        type: "WRITING",
        aiStatus: { not: "PENDING" }
      },
      data: {
        aiStatus: "PENDING",
        aiErrorMessage: null
      }
    });
    expect(structureWritingAssignment).not.toHaveBeenCalled();
  });

  it("fails without deleting sections when AI returns zero questions", async () => {
    findAssignment.mockResolvedValueOnce(baseAssignment);
    updateManyAssignments.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    structureWritingAssignment.mockResolvedValueOnce({ title: "Empty", parts: [] });
    flattenWritingQuestions.mockReturnValueOnce([]);
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(500);
    expect(transaction).not.toHaveBeenCalled();
    expect(deleteSections).not.toHaveBeenCalled();
    expect(deleteFeedbacks).not.toHaveBeenCalled();
    expect(updateManyAssignments).toHaveBeenLastCalledWith({
      where: { id: "writing-1", type: "WRITING", aiStatus: "PENDING" },
      data: {
        aiStatus: "FAILED",
        aiErrorMessage: "Error: AI 结构化没有识别到可展示题目。"
      }
    });
  });

  it("rechecks for user work before replacing sections", async () => {
    findAssignment.mockResolvedValueOnce(baseAssignment);
    updateManyAssignments.mockResolvedValueOnce({ count: 1 });
    structureWritingAssignment.mockResolvedValueOnce({ title: "Structured", parts: [] });
    flattenWritingQuestions.mockReturnValueOnce([
      {
        partTitle: "Part 1",
        questionNumber: 1,
        prompt: "Question",
        detectedLevel: "A1",
        displayType: "sentence"
      }
    ]);
    txFindAssignment.mockResolvedValueOnce({
      ...baseAssignment,
      aiStatus: "PENDING",
      sections: [{ vietnameseText: "Answer added during retry" }]
    });
    txUpdateAssignment.mockResolvedValueOnce({});
    const { PATCH } = await import("./route");

    const response = await PATCH(patchRequest(), {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(409);
    expect(txUpdateAssignment).toHaveBeenCalledWith({
      where: { id: "writing-1", type: "WRITING" },
      data: {
        aiStatus: "FAILED",
        aiErrorMessage: "Previous failure"
      }
    });
    expect(deleteSections).not.toHaveBeenCalled();
    expect(deleteFeedbacks).not.toHaveBeenCalled();
    expect(createSections).not.toHaveBeenCalled();
  });
});
