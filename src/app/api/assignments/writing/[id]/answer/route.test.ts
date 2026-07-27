import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const findSection = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  ensureAuthenticatedApi
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignmentSection: {
      findFirst: findSection
    },
    $transaction: transaction
  }
}));

describe("writing answer route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps feedback when the normalized answer has not changed", async () => {
    ensureAuthenticatedApi.mockResolvedValueOnce({ id: "session-1" });
    findSection.mockResolvedValueOnce({
      id: "section-1",
      assignmentId: "assignment-1",
      vietnameseText: "Xin chào"
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/assignments/writing/assignment-1/answer", {
        method: "PATCH",
        body: JSON.stringify({
          sectionId: "section-1",
          answer: "  Xin chào  "
        })
      }) as NextRequest,
      { params: Promise.resolve({ id: "assignment-1" }) }
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.unchanged).toBe(true);
    expect(transaction).not.toHaveBeenCalled();
  });
});
