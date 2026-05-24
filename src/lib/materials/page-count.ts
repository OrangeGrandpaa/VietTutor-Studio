import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

function positivePageCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function countPdfPages(buffer: Buffer) {
  const content = buffer.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page\b/g);
  return positivePageCount(matches?.length ?? 0);
}

function extractXmlNumber(xml: string, tagName: "Pages" | "Slides") {
  const match = new RegExp(`<${tagName}>\\s*(\\d+)\\s*</${tagName}>`, "i").exec(xml);
  return match ? positivePageCount(Number(match[1])) : null;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function readZipEntry(buffer: Buffer, entryName: string) {
  const endOffset = findEndOfCentralDirectory(buffer);
  if (endOffset < 0) return null;

  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end && buffer.readUInt32LE(offset) === 0x02014b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === entryName && buffer.readUInt32LE(localHeaderOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      return null;
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function countOfficePages(buffer: Buffer, tagName: "Pages" | "Slides") {
  const appXml = readZipEntry(buffer, "docProps/app.xml");
  if (!appXml) return null;
  return extractXmlNumber(appXml.toString("utf8"), tagName);
}

export async function detectMaterialTotalPages(params: {
  absolutePath: string;
  fileName: string;
  mimeType: string | null;
}) {
  const extension = path.extname(params.fileName).toLowerCase();
  const mimeType = params.mimeType?.toLowerCase() ?? "";

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return null;
  }

  if (mimeType.startsWith("image/")) {
    return 1;
  }

  const buffer = await readFile(params.absolutePath);

  if (extension === ".pdf" || mimeType.includes("pdf")) {
    return countPdfPages(buffer);
  }

  if (extension === ".pptx") {
    return countOfficePages(buffer, "Slides");
  }

  if (extension === ".docx") {
    return countOfficePages(buffer, "Pages");
  }

  if ([".md", ".markdown", ".txt"].includes(extension) || mimeType.startsWith("text/")) {
    return buffer.length > 0 ? 1 : null;
  }

  return null;
}
