import { NextRequest } from "next/server";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const formData = await request.formData();
  const audio = formData.get("audio");
  const speakingUnitId = formData.get("speakingUnitId")?.toString();
  const duration = Number(formData.get("duration")?.toString() ?? "0");

  if (!(audio instanceof File) || !speakingUnitId) {
    return jsonError("缺少录音文件或朗读单元。");
  }

  const saved = await saveUploadedFile({
    file: audio,
    bucket: "recordings",
    allowedExtensions: [".webm", ".wav", ".mp3", ".ogg", ".m4a"],
    allowedMimeTypes: [
      "audio/webm",
      "audio/wav",
      "audio/mpeg",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a"
    ]
  });

  const recording = await prisma.recording.create({
    data: {
      speakingUnitId,
      filePath: saved.relativePath,
      duration: Number.isFinite(duration) ? duration : null,
      mimeType: saved.mimeType
    }
  });

  return jsonOk({ success: true, recording }, 201);
}
