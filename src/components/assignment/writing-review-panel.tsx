"use client";

import Link from "next/link";

import { getWritingPartAnchor } from "@/components/assignment/writing-question-groups";
import type { WritingPartReviewGroup, WritingReviewStats } from "@/lib/assignment/writing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/format";

function getGroupStatus(group: WritingPartReviewGroup) {
  if (group.totalQuestions > 0 && group.reviewedQuestions >= group.totalQuestions) {
    return {
      label: "已批完",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
      badgeClassName: "border-emerald-300 bg-emerald-100 text-emerald-800"
    };
  }

  if (group.reviewedQuestions > 0) {
    return {
      label: "批阅中",
      className: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100",
      badgeClassName: "border-amber-300 bg-amber-100 text-amber-800"
    };
  }

  return {
    label: "未批阅",
    className: "border-red-200 bg-red-50 text-red-950 hover:bg-red-100",
    badgeClassName: "border-red-300 bg-red-100 text-red-800"
  };
}

export function WritingReviewPanel({
  groups,
  stats
}: {
  groups: WritingPartReviewGroup[];
  stats: WritingReviewStats;
}) {
  return (
    <div className="space-y-6">
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>总体批阅</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">总题数</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalQuestions}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">已批阅</p>
              <p className="mt-2 text-3xl font-semibold">{stats.reviewedQuestions}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">整体准确率</p>
              <p className="mt-2 text-3xl font-semibold">{formatPercent(stats.accuracy)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">批阅进度</span>
              <span>
                {stats.reviewedQuestions}/{stats.totalQuestions}
              </span>
            </div>
            <Progress value={stats.totalQuestions ? (stats.reviewedQuestions / stats.totalQuestions) * 100 : 0} />
          </div>

          <div className="space-y-3">
            {groups.map((group) => {
              const status = getGroupStatus(group);

              return (
              <Link
                key={`${group.partIndex}-${group.partTitle}`}
                href={`#${getWritingPartAnchor(group.partIndex)}`}
                className={cn(
                  "block rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status.className
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{group.partTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.reviewedQuestions}/{group.totalQuestions} 题已批阅
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={status.badgeClassName}>
                      {status.label}
                    </Badge>
                    <Badge variant="outline">{formatPercent(group.accuracy)}</Badge>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
