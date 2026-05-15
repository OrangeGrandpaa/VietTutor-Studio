import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { RefreshAssignmentButton } from "@/components/assignment/refresh-assignment-button";
import { RetryAiButton } from "@/components/assignment/retry-ai-button";
import { WritingQuestionGroups } from "@/components/assignment/writing-question-groups";
import { WritingReviewPanel } from "@/components/assignment/writing-review-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildWritingReviewGroups } from "@/lib/assignment/writing";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

export default async function WritingAssignmentDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: { feedbacks: { orderBy: { updatedAt: "desc" } } }
      }
    }
  });

  if (!assignment) {
    notFound();
  }

  const { groups, stats } = buildWritingReviewGroups(assignment.sections, assignment.aiStructuredContent);

  return (
    <AppShell
      title={assignment.title}
      description={`上传于 ${formatDateTime(assignment.createdAt)}，已拆成 ${stats.totalQuestions} 道题供逐题作答和批阅。`}
      actions={
        <>
          {assignment.aiStatus === "FAILED" ? (
            <RetryAiButton
              endpoint={`/api/assignments/writing/${assignment.id}`}
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
          <Badge variant="outline">总题数 {stats.totalQuestions}</Badge>
          <Badge variant="outline">已批阅 {stats.reviewedQuestions}</Badge>
          <Badge variant="outline">整体准确率 {formatPercent(stats.accuracy)}</Badge>
        </div>

        {assignment.aiStatus === "PENDING" ? (
          <Card className="border-sky-300/70 bg-sky-50/70">
            <CardHeader>
              <CardTitle>AI 正在后台结构化</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-foreground/80">
                当前先展示基础拆分结果。AI 完成后，点击刷新状态即可看到更新后的题目结构。
              </p>
              <RefreshAssignmentButton />
            </CardContent>
          </Card>
        ) : null}

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

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>原始上传文件</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{assignment.originalFileName}</p>
                  <p>系统会从上传文件中抽取题目并按题展示，原文件请通过下载链接查看。</p>
                </div>
                <Link
                  href={`/api/files/${assignment.id}?kind=assignment&download=1`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  下载原始文件
                </Link>
              </CardContent>
            </Card>

            <WritingQuestionGroups assignmentId={assignment.id} groups={groups} />
          </div>

          <WritingReviewPanel groups={groups} stats={stats} />
        </div>
      </PageShell>
    </AppShell>
  );
}
