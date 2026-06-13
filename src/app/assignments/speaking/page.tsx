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
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatScore } from "@/lib/utils/format";
import { getPagination } from "@/lib/utils/pagination";

type SpeakingFilter = "all" | "reviewed" | "unreviewed";

const filterOptions: Array<{
  href: Route;
  label: string;
  value: SpeakingFilter;
}> = [
  { href: "/assignments/speaking", label: "全部", value: "all" },
  { href: "/assignments/speaking?filter=reviewed", label: "已批阅", value: "reviewed" },
  { href: "/assignments/speaking?filter=unreviewed", label: "未批阅", value: "unreviewed" }
];

function normalizeFilter(value: string | undefined): SpeakingFilter {
  return value === "reviewed" || value === "unreviewed" ? value : "all";
}

function buildSpeakingHref(filter: SpeakingFilter, page = 1) {
  const params = new URLSearchParams();

  if (filter !== "all") {
    params.set("filter", filter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return (query ? `/assignments/speaking?${query}` : "/assignments/speaking") as Route;
}

export default async function SpeakingAssignmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ filter?: string; page?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const activeFilter = normalizeFilter(params?.filter);
  const where = {
    type: AssignmentType.SPEAKING,
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
      overallScore: true,
      _count: {
        select: {
          speakingUnits: true
        }
      }
    }
  });

  return (
    <AppShell
      title="口语作业"
      description="上传 TXT 或 RTF 文本后按句拆分，学生逐句录音，教师可录制标准音并给出三档判断。"
      actions={
        <Link href="/assignments/speaking/new" className={buttonVariants()}>
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
            title={activeFilter === "all" ? "还没有口语作业" : "没有符合条件的作业"}
            description={
              activeFilter === "all"
                ? "上传一份 TXT 或 RTF 朗读文本，系统会自动拆成适合逐句录音和批阅的句子。"
                : "切换筛选条件，或上传一份新的口语作业。"
            }
            actionHref={activeFilter === "all" ? "/assignments/speaking/new" : undefined}
            actionLabel={activeFilter === "all" ? "上传第一份口语作业" : undefined}
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
                      <span>{assignment._count.speakingUnits} 句</span>
                      <span>综合分 {formatScore(assignment.overallScore)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:self-center">
                    <Link
                      href={`/assignments/speaking/${assignment.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      查看
                    </Link>
                    <DeleteButton
                      endpoint={`/api/assignments/speaking/${assignment.id}`}
                      size="sm"
                      className="px-3"
                    />
                  </div>
                </div>
              </Card>
            ))}
            <PaginationControls
              buildHref={(page) => buildSpeakingHref(activeFilter, page)}
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
