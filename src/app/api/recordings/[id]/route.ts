import { RecordingKind } from "@prisma/client";
import { NextRequest } from "next/server";

import { refreshSpeakingAssignmentSummary } from "@/lib/assignment/speaking-summary";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const recording = await prisma.recording.findUnique({
    where: { id },
    include: {
      speakingUnit: {
        select: { assignmentId: true }
      }
    }
  });

  if (!recording) {
    return jsonError("录音不存在。", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.recording.delete({ where: { id } });

    if (
      recording.kind === RecordingKind.STUDENT &&
      recording.speakingUnitId &&
      recording.speakingUnit
    ) {
      await tx.speakingUnit.update({
        where: { id: recording.speakingUnitId },
        data: {
          reviewLevel: null,
          reviewScore: null
        }
      });
      await refreshSpeakingAssignmentSummary(tx, recording.speakingUnit.assignmentId);
    }
  });
  await deleteFile(recording.filePath);

  return jsonOk({ success: true });
}
