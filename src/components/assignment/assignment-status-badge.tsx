import { AiProcessStatus, AssignmentStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { assignmentStatusLabel } from "@/lib/utils/format";

export function AssignmentStatusBadge({
  status,
  aiStatus
}: {
  status: AssignmentStatus;
  aiStatus?: AiProcessStatus;
}) {
  if (aiStatus === "PENDING") {
    return <Badge variant="warning">AI结构化中</Badge>;
  }

  if (aiStatus === "FAILED") {
    return <Badge variant="warning">AI 待重试</Badge>;
  }

  if (status === "REVIEWED") {
    return <Badge variant="success">{assignmentStatusLabel(status)}</Badge>;
  }

  if (status === "REVIEWING") {
    return <Badge variant="default">{assignmentStatusLabel(status)}</Badge>;
  }

  return <Badge variant="outline">{assignmentStatusLabel(status)}</Badge>;
}
