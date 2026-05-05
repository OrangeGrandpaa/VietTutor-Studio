"use client";

import type { WritingPartReviewGroup, WritingReviewStats } from "@/lib/assignment/writing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/utils/format";

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
            {groups.map((group) => (
              <div key={group.partTitle} className="rounded-2xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{group.partTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.reviewedQuestions}/{group.totalQuestions} 题已批阅
                    </p>
                  </div>
                  <Badge variant="outline">{formatPercent(group.accuracy)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
