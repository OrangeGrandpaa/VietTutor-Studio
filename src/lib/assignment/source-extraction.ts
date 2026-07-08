import "server-only";

import mammoth from "mammoth";
import path from "node:path";
import WordExtractor from "word-extractor";

import { extractPlainTextFromRtf } from "@/lib/assignment/speaking-text";

const wordExtractor = new WordExtractor();

const LOCAL_TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".rtf", ".doc", ".docx"]);
const LOCAL_TEXT_MIME_TYPES = new Set(["text/markdown", "text/plain"]);
const RTF_MIME_TYPES = new Set(["text/rtf", "application/rtf", "application/x-rtf"]);

export const assignmentUploadConfig: {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
} = {
  allowedExtensions: [...LOCAL_TEXT_EXTENSIONS],
  allowedMimeTypes: [
    "text/markdown",
    "text/plain",
    "text/rtf",
    "application/rtf",
    "application/x-rtf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]
};

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function isTextMimeType(mimeType: string) {
  return LOCAL_TEXT_MIME_TYPES.has(mimeType);
}

async function extractLocalText(file: File, extension: string, mimeType: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeLineBreaks(result.value);
  }

  if (extension === ".doc") {
    const result = await wordExtractor.extract(buffer);
    return normalizeLineBreaks(result.getBody());
  }

  if (extension === ".rtf" || RTF_MIME_TYPES.has(mimeType)) {
    return normalizeLineBreaks(extractPlainTextFromRtf(buffer.toString("utf-8")));
  }

  if (LOCAL_TEXT_EXTENSIONS.has(extension) || isTextMimeType(mimeType)) {
    return normalizeLineBreaks(buffer.toString("utf-8"));
  }

  return "";
}

export async function extractAssignmentSourceText(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (extension && !LOCAL_TEXT_EXTENSIONS.has(extension)) {
    throw new Error("笔头作业现在只支持上传 TXT、Word、Markdown 或 RTF 文件。");
  }

  if (LOCAL_TEXT_EXTENSIONS.has(extension) || isTextMimeType(mimeType)) {
    const text = await extractLocalText(file, extension, mimeType);

    if (!text) {
      throw new Error("文件中没有读取到可用文本内容。");
    }

    return {
      text,
      strategy: "local-direct" as const
    };
  }

  throw new Error("笔头作业现在只支持上传 TXT、Word、Markdown 或 RTF 文件。");
}
