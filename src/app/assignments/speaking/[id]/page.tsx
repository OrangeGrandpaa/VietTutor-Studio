import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { RetryAiButton } from "@/components/assignment/retry-ai-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeakingRecorderPanel } from "@/components/speaking/speaking-recorder-panel";
import { SpeakingReviewPanel } from "@/components/speaking/speaking-review-panel";
import { buildSpeakingReviewGroups } from "@/lib/assignment/speaking";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

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
      description={`上传于 ${formatDateTime(assignment.createdAt)}，已拆成 ${stats.totalUnits} 个朗读单元供老师逐条批阅。`}
      actions={
        <>
          {assignment.aiStatus === "FAILED" ? (
            <RetryAiButton
              endpoint={`/api/assignments/speaking/${assignment.id}`}
              method="PATCH"
              body={{ action: "retry-ai" }}
            />
          ) : null}
          <Link
            href={`/api/files/${assignment.id}?kind=assignment&download=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            下载原始文件
          </Link>
        </>
      }
    >
      <PageShell>
        <div className="flex flex-wrap items-center gap-3">
          <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
          <Badge variant="outline">总单元数 {stats.totalUnits}</Badge>
          <Badge variant="outline">已录音 {stats.recordedUnits}</Badge>
          <Badge variant="outline">已批阅 {stats.reviewedUnits}</Badge>
          <Badge variant="outline">平均综合分 {formatPercent(stats.averageOverallScore)}</Badge>
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

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>学生提交内容</CardTitle>
              </CardHeader>
              <CardContent>
                <details className="group rounded-2xl border border-border/70 bg-secondary/20 p-4">
                  <summary className="cursor-pointer list-none text-sm font-medium">
                    展开查看原始 Markdown 内容
                  </summary>
                  <div className="prose prose-stone mt-4 max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{assignment.originalContent}</ReactMarkdown>
                  </div>
                </details>
              </CardContent>
            </Card>

            <SpeakingRecorderPanel assignmentId={assignment.id} units={assignment.speakingUnits} groups={groups} />
          </div>

          <SpeakingReviewPanel groups={groups} stats={stats} />
        </div>
      </PageShell>
    </AppShell>
  );
}
