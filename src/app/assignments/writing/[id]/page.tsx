import Link from "next/link";
import type { Route } from "next";
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
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ wrongOnly?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const wrongOnly = (await searchParams)?.wrongOnly === "1";
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
  const shouldShowQuestions = assignment.aiStatus === "SUCCEEDED";
  const wrongQuestionCount = groups.reduce(
    (total, group) => total + group.questions.filter((question) => question.isCorrect === false).length,
    0
  );
  const wrongOnlyHref = (wrongOnly
    ? `/assignments/writing/${assignment.id}`
    : `/assignments/writing/${assignment.id}?wrongOnly=1`) as Route;

  return (
    <AppShell
      title={assignment.title}
      description={
        shouldShowQuestions
          ? `上传于 ${formatDateTime(assignment.createdAt)}，已拆成 ${stats.totalQuestions} 道题供逐题作答和批阅。`
          : `上传于 ${formatDateTime(assignment.createdAt)}，AI 正在结构化题目，完成后会显示逐题作答和批阅区域。`
      }
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
            {shouldShowQuestions ? (
              <>
                <Badge variant="outline">总题数 {stats.totalQuestions}</Badge>
                <Badge variant="outline">已批阅 {stats.reviewedQuestions}</Badge>
                <Badge variant="outline">整体准确率 {formatPercent(stats.accuracy)}</Badge>
                <Badge variant="outline">错题 {wrongQuestionCount}</Badge>
              </>
            ) : null}
          </div>
          {shouldShowQuestions ? (
            <Link href={wrongOnlyHref} className={buttonVariants({ variant: wrongOnly ? "default" : "outline" })}>
              {wrongOnly ? "显示全部" : "只看错题"}
            </Link>
          ) : null}
        </div>

        {assignment.aiStatus === "PENDING" ? (
          <Card className="border-sky-300/70 bg-sky-50/70">
            <CardHeader>
              <CardTitle>AI 正在后台结构化</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-foreground/80">
                为避免基础拆分误导，当前暂不展示题目。AI 完成结构化后，点击刷新状态即可看到逐题作答和批阅区域。
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
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground/80">{assignment.aiErrorMessage}</pre>
            </CardContent>
          </Card>
        ) : null}

        {shouldShowQuestions ? (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <WritingQuestionGroups assignmentId={assignment.id} groups={groups} wrongOnly={wrongOnly} />
            </div>

            <WritingReviewPanel groups={groups} stats={stats} />
          </div>
        ) : null}
      </PageShell>
    </AppShell>
  );
}
