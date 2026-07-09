"use client";

import {
  getWritingPartAnchor,
  getWritingQuestionAnchor
} from "@/components/assignment/writing-question-groups";
import type {
  WritingExerciseReviewGroup,
  WritingPartReviewGroup,
  WritingReviewStats
} from "@/lib/assignment/writing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { progressStatusLabel } from "@/lib/assignment/progress-status";
import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/format";

function getGroupStatus(group: WritingPartReviewGroup) {
  if (group.totalQuestions > 0 && group.reviewedQuestions >= group.totalQuestions) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
    };
  }

  if (group.reviewedQuestions > 0) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
    };
  }

  return {
    className: "border-red-200 bg-red-50 text-red-950 hover:bg-red-100"
  };
}

function getExerciseStatus(group: WritingExerciseReviewGroup) {
  if (group.totalQuestions > 0 && group.reviewedQuestions >= group.totalQuestions) {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
    };
  }

  if (group.reviewedQuestions > 0) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
    };
  }

  return {
    className: "border-red-200 bg-red-50 text-red-950 hover:bg-red-100"
  };
}

function getReviewNavigationItems(groups: WritingPartReviewGroup[]) {
  const exerciseItems = groups.flatMap((group) => group.exerciseGroups);

  if (exerciseItems.length > 0) {
    return exerciseItems.map((group) => ({
      key: group.key,
      title: group.title,
      href: `#${getWritingQuestionAnchor(group.firstQuestionId)}`,
      reviewedQuestions: group.reviewedQuestions,
      completedQuestions: group.completedQuestions,
      totalQuestions: group.totalQuestions,
      accuracy: group.accuracy,
      progressStatus: group.progressStatus,
      className: getExerciseStatus(group).className
    }));
  }

  return groups.map((group) => ({
    key: `${group.partIndex}-${group.partTitle}`,
    title: group.partTitle,
    href: `#${getWritingPartAnchor(group.partIndex)}`,
    reviewedQuestions: group.reviewedQuestions,
    completedQuestions: group.completedQuestions,
    totalQuestions: group.totalQuestions,
    accuracy: group.accuracy,
    progressStatus: group.progressStatus,
    className: getGroupStatus(group).className
  }));
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

          <div className="max-h-[calc(100vh-23rem)] min-h-0 space-y-3 overflow-y-auto pr-2">
            {getReviewNavigationItems(groups).map((group) => (
                <a
                  key={group.key}
                  href={group.href}
                  className={cn(
                    "block rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    group.className
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{group.title}</p>
                      <p className="text-sm text-muted-foreground">
                        已作答 {group.completedQuestions}/{group.totalQuestions}，已批阅 {group.reviewedQuestions}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">{progressStatusLabel(group.progressStatus)}</Badge>
                      <Badge variant="outline">{formatPercent(group.accuracy)}</Badge>
                    </div>
                  </div>
                </a>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
