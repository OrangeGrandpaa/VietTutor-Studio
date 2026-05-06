import Link from "next/link";
import type { Route } from "next";
import { AiProcessStatus, AssignmentStatus, AssignmentType } from "@prisma/client";

import { AssignmentStatusBadge } from "@/components/assignment/assignment-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

type RecentItem = {
  id: string;
  title: string;
  type: AssignmentType;
  status: AssignmentStatus;
  accuracyScore: number | null;
  pronunciationScore?: number | null;
  overallScore?: number | null;
  createdAt: Date;
  aiStatus?: AiProcessStatus;
};

export function RecentAssignmentList({
  title,
  items,
  detailBasePath
}: {
  title: string;
  items: RecentItem[];
  detailBasePath: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有记录。</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`${detailBasePath}/${item.id}` as Route}
              className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 transition hover:bg-accent/30"
            >
              <div className="space-y-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium">
                  {item.type === "WRITING"
                    ? formatPercent(item.accuracyScore)
                    : formatPercent(item.overallScore ?? item.pronunciationScore ?? null)}
                </p>
                <AssignmentStatusBadge status={item.status} aiStatus={item.aiStatus} />
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
