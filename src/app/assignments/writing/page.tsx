import Link from "next/link";
import type { Route } from "next";

import { AssignmentStatus, AssignmentType } from "@prisma/client";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

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

export default async function WritingAssignmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  await requireAuth();
  const activeFilter = normalizeFilter((await searchParams)?.filter);
  const assignments = await prisma.assignment.findMany({
    where: {
      type: AssignmentType.WRITING,
      ...(activeFilter === "reviewed"
        ? { status: AssignmentStatus.REVIEWED }
        : activeFilter === "unreviewed"
          ? { status: { not: AssignmentStatus.REVIEWED } }
          : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          sections: true
        }
      }
    }
  });

  return (
    <AppShell
      title="笔头作业"
      description="支持 Markdown、DOC、DOCX 直读，以及 PDF、PPT、Excel 等复杂文档的自动抽取。"
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
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-base sm:text-lg">{assignment.title}</CardTitle>
                      <AssignmentStatusBadge status={assignment.status} aiStatus={assignment.aiStatus} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatDateTime(assignment.createdAt)}</span>
                      <span>{assignment.originalFileName}</span>
                      <span>{assignment._count.sections} 题</span>
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
            ))}
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
