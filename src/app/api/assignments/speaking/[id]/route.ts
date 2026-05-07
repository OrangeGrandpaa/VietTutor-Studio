import { AssignmentStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { structureSpeakingAssignment } from "@/lib/ai/kimi";
import { ensureAuthenticatedApi } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { deleteFile } from "@/lib/storage";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { mapSpeakingUnitType } from "@/lib/utils/mapping";
import { sanitizeOptionalText } from "@/lib/utils/sanitize";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      speakingUnits: {
        orderBy: { orderIndex: "asc" },
        include: {
          recordings: {
            orderBy: { createdAt: "desc" },
            include: { feedback: true }
          }
        }
      }
    }
  });

  if (!assignment) return jsonError("作业不存在。", 404);
  return jsonOk(assignment);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { action?: "retry-ai"; title?: string }
    | null;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { speakingUnits: { include: { recordings: true } } }
  });

  if (!assignment) return jsonError("作业不存在。", 404);

  if (body?.action === "retry-ai") {
    try {
      const structured = await structureSpeakingAssignment(assignment.originalContent);

      for (const unit of assignment.speakingUnits) {
        for (const recording of unit.recordings) {
          await deleteFile(recording.filePath);
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.speakingFeedback.deleteMany({
          where: {
            recording: {
              speakingUnit: {
                assignmentId: id
              }
            }
          }
        });
        await tx.recording.deleteMany({
          where: {
            speakingUnit: {
              assignmentId: id
            }
          }
        });
        await tx.speakingUnit.deleteMany({ where: { assignmentId: id } });

        await tx.assignment.update({
          where: { id },
          data: {
            title: structured.title || assignment.title,
            aiStructuredContent: structured as unknown as Prisma.InputJsonValue,
            aiStatus: "SUCCEEDED",
            aiErrorMessage: null,
            overallScore: null,
            status: AssignmentStatus.PENDING_REVIEW
          }
        });

        await tx.speakingUnit.createMany({
          data: structured.units.map((unit, index) => ({
            assignmentId: id,
            unitType: mapSpeakingUnitType(unit.unit_type),
            content: unit.content,
            orderIndex: index + 1
          }))
        });
      });

      return jsonOk({ success: true, message: "AI 结构化已重新生成。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 结构化失败。";

      await prisma.assignment.update({
        where: { id },
        data: {
          aiStatus: "FAILED",
          aiErrorMessage: message
        }
      });

      return jsonError(message, 500);
    }
  }

  const title = sanitizeOptionalText(body?.title);
  if (!title) return jsonError("没有可更新的内容。");

  const updated = await prisma.assignment.update({
    where: { id },
    data: { title }
  });

  return jsonOk(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await ensureAuthenticatedApi();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      speakingUnits: {
        include: { recordings: true }
      }
    }
  });

  if (!assignment) return jsonError("作业不存在。", 404);

  for (const unit of assignment.speakingUnits) {
    for (const recording of unit.recordings) {
      await deleteFile(recording.filePath);
    }
  }

  await prisma.assignment.delete({ where: { id } });
  await deleteFile(assignment.originalFilePath);

  return jsonOk({ success: true });
}
