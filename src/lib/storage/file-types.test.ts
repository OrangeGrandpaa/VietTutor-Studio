import { describe, expect, it } from "vitest";

import {
  getFileDispositionType,
  getSafeResponseMimeType,
  resolveValidatedFileMimeType,
  validateFileType
} from "@/lib/storage/file-types";

const documentOptions = {
  allowedExtensions: [".pdf", ".docx", ".txt", ".rtf"],
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/rtf"
  ]
};

describe("file type validation", () => {
  it("requires the extension and MIME to be an allowed pair", () => {
    expect(validateFileType("lesson.pdf", "application/pdf", documentOptions)).toBe(true);
    expect(validateFileType("lesson.pdf", "text/plain", documentOptions)).toBe(false);
    expect(validateFileType("lesson.html", "application/pdf", documentOptions)).toBe(false);
    expect(validateFileType("lesson.pdf", "text/html", documentOptions)).toBe(false);
  });

  it("normalizes MIME parameters", () => {
    expect(
      resolveValidatedFileMimeType("recording.webm", "audio/webm;codecs=opus", {
        allowedExtensions: [".webm"],
        allowedMimeTypes: ["audio/webm"]
      })
    ).toBe("audio/webm");
  });

  it("derives a configured MIME only when the browser leaves it empty", () => {
    expect(resolveValidatedFileMimeType("lesson.txt", "", documentOptions)).toBe("text/plain");
    expect(resolveValidatedFileMimeType("lesson.pdf", "application/octet-stream", documentOptions)).toBeNull();
  });
});

describe("protected file response metadata", () => {
  it("allows inline rendering only for explicit safe types", () => {
    expect(getFileDispositionType("application/pdf", false)).toBe("inline");
    expect(getFileDispositionType("image/png", false)).toBe("inline");
    expect(getFileDispositionType("text/html", false)).toBe("attachment");
    expect(getFileDispositionType("image/svg+xml", false)).toBe("attachment");
    expect(getFileDispositionType("application/pdf", true)).toBe("attachment");
  });

  it("falls back for malformed stored MIME values", () => {
    expect(getSafeResponseMimeType("text/html\r\nX-Test: injected")).toBe("application/octet-stream");
  });
});
