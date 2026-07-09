import { AiProcessStatus, AssignmentStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  progressStatusLabel,
  type AssignmentProgressStatus
} from "@/lib/assignment/progress-status";
import { assignmentStatusLabel } from "@/lib/utils/format";

export function AssignmentStatusBadge({
  status,
  aiStatus,
  progressStatus
}: {
  status: AssignmentStatus;
  aiStatus?: AiProcessStatus;
  progressStatus?: AssignmentProgressStatus;
}) {
  if (aiStatus === "PENDING") {
    return <Badge variant="warning">AI结构化中</Badge>;
  }

  if (aiStatus === "FAILED") {
    return <Badge variant="warning">AI 待重试</Badge>;
  }

  if (progressStatus) {
    switch (progressStatus) {
      case "REVIEWED":
        return <Badge variant="success">{progressStatusLabel(progressStatus)}</Badge>;
      case "REVIEWING":
        return <Badge variant="default">{progressStatusLabel(progressStatus)}</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="warning">{progressStatusLabel(progressStatus)}</Badge>;
      case "NOT_STARTED":
        return <Badge variant="destructive">{progressStatusLabel(progressStatus)}</Badge>;
      case "UNREVIEWED":
        return <Badge variant="outline">{progressStatusLabel(progressStatus)}</Badge>;
      default:
        return <Badge variant="outline">{progressStatusLabel(progressStatus)}</Badge>;
    }
  }

  if (status === "REVIEWED") {
    return <Badge variant="success">{assignmentStatusLabel(status)}</Badge>;
  }

  if (status === "REVIEWING") {
    return <Badge variant="default">{assignmentStatusLabel(status)}</Badge>;
  }

  return <Badge variant="outline">{assignmentStatusLabel(status)}</Badge>;
}
