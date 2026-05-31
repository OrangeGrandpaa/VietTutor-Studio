import { NextRequest } from "next/server";
import { AssignmentType, RecordingKind } from "@prisma/client";

import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const formData = await request.formData();
  const audio = formData.get("audio");
  const assignmentId = formData.get("assignmentId")?.toString();
  const speakingUnitId = formData.get("speakingUnitId")?.toString();
  const duration = Number(formData.get("duration")?.toString() ?? "0");
  const rawKind = formData.get("kind")?.toString();
  const kind =
    rawKind === RecordingKind.TEACHER_STANDARD ? RecordingKind.TEACHER_STANDARD : RecordingKind.STUDENT;

  if (!(audio instanceof File) || (!assignmentId && !speakingUnitId)) {
    return jsonError("缺少录音文件或录音对象。");
  }

  if (assignmentId && speakingUnitId) {
    return jsonError("录音对象不能同时是全文和句子。");
  }

  if (assignmentId) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { type: true }
    });

    if (!assignment || assignment.type !== AssignmentType.SPEAKING) {
      return jsonError("口语作业不存在。", 404);
    }
  }

  if (speakingUnitId) {
    const unit = await prisma.speakingUnit.findUnique({
      where: { id: speakingUnitId },
      select: { id: true }
    });

    if (!unit) {
      return jsonError("朗读句子不存在。", 404);
    }
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
      assignmentId: assignmentId ?? null,
      speakingUnitId: speakingUnitId ?? null,
      kind,
      filePath: saved.relativePath,
      duration: Number.isFinite(duration) ? duration : null,
      mimeType: saved.mimeType
    }
  });

  return jsonOk({ success: true, recording }, 201);
}
