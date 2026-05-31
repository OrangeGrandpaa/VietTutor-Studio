import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeakingReviewPanel } from "@/components/speaking/speaking-review-panel";
import { SpeakingSentencePractice } from "@/components/speaking/speaking-sentence-practice";
import { buildSpeakingReviewGroups } from "@/lib/assignment/speaking";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatScore } from "@/lib/utils/format";

export default async function SpeakingAssignmentDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      recordings: {
        orderBy: { createdAt: "desc" }
      },
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

  if (!assignment) {
    notFound();
  }

  const { groups, stats } = buildSpeakingReviewGroups(assignment.speakingUnits);

  return (
    <AppShell
      title={assignment.title}
      description={`上传于 ${formatDateTime(assignment.createdAt)}，已拆成 ${stats.totalUnits} 句朗读文本供逐句录音和判断。`}
      actions={
        <Link
          href={`/api/files/${assignment.id}?kind=assignment&download=1`}
          className={buttonVariants({ variant: "outline" })}
        >
          下载原始 TXT
        </Link>
      }
    >
      <PageShell>
        <div className="flex flex-wrap items-center gap-3">
          <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
          <Badge variant="outline">总句数 {stats.totalUnits}</Badge>
          <Badge variant="outline">已录音句子 {stats.recordedUnits}</Badge>
          <Badge variant="outline">已批阅 {stats.reviewedUnits}</Badge>
          <Badge variant="outline">平均综合分 {formatScore(stats.averageOverallScore)}</Badge>
        </div>

        {assignment.aiStatus === "FAILED" && assignment.aiErrorMessage ? (
          <Card className="border-amber-300/70 bg-amber-50/70">
            <CardHeader>
              <CardTitle>AI 结构化失败原因</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground/80">{assignment.aiErrorMessage}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-6">
          <SpeakingSentencePractice
            assignmentId={assignment.id}
            fullRecordings={assignment.recordings}
            units={assignment.speakingUnits}
          />
          <SpeakingReviewPanel groups={groups} stats={stats} />
        </div>
      </PageShell>
    </AppShell>
  );
}
