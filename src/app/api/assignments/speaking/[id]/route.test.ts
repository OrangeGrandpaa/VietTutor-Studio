import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const findAssignment = vi.fn();

vi.mock("@/lib/auth/session", () => ({ ensureAuthenticatedApi }));
vi.mock("@/lib/storage", () => ({ deleteFile: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignment: {
      findUnique: findAssignment
    }
  }
}));

describe("speaking assignment detail route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureAuthenticatedApi.mockResolvedValue({ id: "session-1" });
  });

  it("returns 404 when the id is not a speaking assignment", async () => {
    findAssignment.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost") as NextRequest, {
      params: Promise.resolve({ id: "writing-1" })
    });

    expect(response.status).toBe(404);
    expect(findAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "writing-1", type: "SPEAKING" } })
    );
  });
});
