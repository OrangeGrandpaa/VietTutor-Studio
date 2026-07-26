import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureAuthenticatedApi = vi.fn();
const findMaterial = vi.fn();
const getProtectedFileMetadata = vi.fn();
const getProtectedFileAccelRedirectPath = vi.fn();

vi.mock("@/lib/auth/session", () => ({ ensureAuthenticatedApi }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    courseMaterial: { findUnique: findMaterial }
  }
}));
vi.mock("@/lib/storage", () => ({
  getProtectedFileMetadata,
  getProtectedFileAccelRedirectPath
}));

describe("protected file route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureAuthenticatedApi.mockResolvedValue({ id: "session-1" });
    getProtectedFileMetadata.mockResolvedValue({
      size: 10,
      mtimeMs: 1,
      lastModified: "Thu, 01 Jan 1970 00:00:00 GMT",
      absolutePath: "/tmp/not-read"
    });
    getProtectedFileAccelRedirectPath.mockReturnValue("/_protected/materials/file");
  });

  it("forces unsafe stored content types to download and disables sniffing", async () => {
    findMaterial.mockResolvedValueOnce({
      fileName: "payload.pdf",
      filePath: "materials/payload.pdf",
      mimeType: "text/html"
    });
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/files/material-1?kind=material"),
      { params: Promise.resolve({ id: "material-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("keeps explicit preview-safe types inline", async () => {
    findMaterial.mockResolvedValueOnce({
      fileName: "lesson.pdf",
      filePath: "materials/lesson.pdf",
      mimeType: "application/pdf"
    });
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/files/material-1?kind=material"),
      { params: Promise.resolve({ id: "material-1" }) }
    );

    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
