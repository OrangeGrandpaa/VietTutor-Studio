import Link from "next/link";
import type { Route } from "next";

import { AssignmentStatus, AssignmentType } from "@prisma/client";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getAssignmentProgressStatus } from "@/lib/assignment/progress-status";
import { getWritingQuestionCompletionStatus } from "@/lib/assignment/writing";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatPercent } from "@/lib/utils/format";
import { getPagination } from "@/lib/utils/pagination";

type WritingFilter = "all" | "reviewed" | "unreviewed";

const filterOptions: Array<{
  href: Route;
  label: string;
  value: WritingFilter;
}> = [
  { href: "/assignments/writing", label: "全部", value: "all" },
  { href: "/assignments/writing?filter=reviewed", label: "已批阅", value: "reviewed" },
  { href: "/assignments/writing?filter=unreviewed", label: "未批阅", value: "unreviewed" }
];

function normalizeFilter(value: string | undefined): WritingFilter {
  return value === "reviewed" || value === "unreviewed" ? value : "all";
}

function buildWritingHref(filter: WritingFilter, page = 1) {
  const params = new URLSearchParams();

  if (filter !== "all") {
    params.set("filter", filter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return (query ? `/assignments/writing?${query}` : "/assignments/writing") as Route;
}

export default async function WritingAssignmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ filter?: string; page?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const activeFilter = normalizeFilter(params?.filter);
  const where = {
    type: AssignmentType.WRITING,
    ...(activeFilter === "reviewed"
      ? { status: AssignmentStatus.REVIEWED }
      : activeFilter === "unreviewed"
        ? { status: { not: AssignmentStatus.REVIEWED } }
        : {})
  };
  const totalItems = await prisma.assignment.count({ where });
  const pagination = getPagination({ page: params?.page, totalItems });
  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      title: true,
      status: true,
      aiStatus: true,
      createdAt: true,
      originalFileName: true,
      accuracyScore: true,
      _count: {
        select: {
          sections: true
        }
      },
      sections: {
        select: {
          originalText: true,
          vietnameseText: true,
          feedbacks: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { score: true }
          }
        }
      }
    }
  });

  return (
    <AppShell
      title="笔头作业"
      description="支持 TXT、Markdown、RTF、DOC、DOCX 文件上传，系统会抽取文本并自动结构化题目。"
      actions={
        <Link href="/assignments/writing/new" className={buttonVariants()}>
          新建作业
        </Link>
      }
    >
      <PageShell>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const active = activeFilter === option.value;

            return (
              <Link
                key={option.value}
                href={option.href}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
                  "min-w-20"
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        {assignments.length === 0 ? (
          <EmptyState
            title={activeFilter === "all" ? "还没有上传作业" : "没有符合条件的作业"}
            description={
              activeFilter === "all"
                ? "从一份题目文件开始，系统会自动拆题并生成逐题作答、逐题批阅页面。"
                : "切换筛选条件，或上传一份新的笔头作业。"
            }
            actionHref={activeFilter === "all" ? "/assignments/writing/new" : undefined}
            actionLabel={activeFilter === "all" ? "上传第一份作业" : undefined}
          />
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment) => {
              const questionCompletionStatuses = assignment.sections.map((section) =>
                getWritingQuestionCompletionStatus(section.originalText, section.vietnameseText)
              );
              const startedQuestions = questionCompletionStatuses.filter(
                (status) => status !== "NOT_STARTED"
              ).length;
              const completedQuestions = questionCompletionStatuses.filter(
                (status) => status === "COMPLETED"
              ).length;
              const reviewedQuestions = assignment.sections.filter(
                (section) => section.feedbacks[0]?.score !== null && section.feedbacks[0]?.score !== undefined
              ).length;
              const progressStatus = getAssignmentProgressStatus({
                totalItems: assignment._count.sections,
                startedItems: startedQuestions,
                completedItems: completedQuestions,
                reviewedItems: reviewedQuestions
              });

              return (
                <Card key={assignment.id}>
                  <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-base sm:text-lg">{assignment.title}</CardTitle>
                        <AssignmentStatusBadge
                          status={assignment.status}
                          aiStatus={assignment.aiStatus}
                          progressStatus={progressStatus}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDateTime(assignment.createdAt)}</span>
                        <span>{assignment.originalFileName}</span>
                        <span>{assignment._count.sections} 题</span>
                        <span>已作答 {completedQuestions}</span>
                        <span>准确率 {formatPercent(assignment.accuracyScore)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:self-center">
                      <Link
                        href={`/assignments/writing/${assignment.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        查看
                      </Link>
                      <DeleteButton
                        endpoint={`/api/assignments/writing/${assignment.id}`}
                        size="sm"
                        className="px-3"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
            <PaginationControls
              buildHref={(page) => buildWritingHref(activeFilter, page)}
              page={pagination.page}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
            />
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
