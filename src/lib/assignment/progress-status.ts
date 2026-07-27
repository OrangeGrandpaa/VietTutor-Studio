export type CompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type AssignmentProgressStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "UNREVIEWED"
  | "REVIEWING"
  | "REVIEWED";

export type ItemProgressStatus = Exclude<AssignmentProgressStatus, "REVIEWING">;

export function getAssignmentProgressStatus({
  totalItems,
  startedItems,
  completedItems,
  reviewedItems
}: {
  totalItems: number;
  startedItems: number;
  completedItems: number;
  reviewedItems: number;
}): AssignmentProgressStatus {
  if (totalItems > 0 && reviewedItems >= totalItems) {
    return "REVIEWED";
  }

  if (reviewedItems > 0) {
    return "REVIEWING";
  }

  if (startedItems <= 0) {
    return "NOT_STARTED";
  }

  if (completedItems < totalItems) {
    return "IN_PROGRESS";
  }

  return "UNREVIEWED";
}

export function getItemProgressStatus({
  completionStatus,
  isReviewed
}: {
  completionStatus: CompletionStatus;
  isReviewed: boolean;
}): ItemProgressStatus {
  if (isReviewed) {
    return "REVIEWED";
  }

  if (completionStatus === "COMPLETED") {
    return "UNREVIEWED";
  }

  return completionStatus;
}

export function progressStatusLabel(status: AssignmentProgressStatus | ItemProgressStatus) {
  switch (status) {
    case "NOT_STARTED":
      return "还没做";
    case "IN_PROGRESS":
      return "还没做完！";
    case "UNREVIEWED":
      return "未批阅";
    case "REVIEWING":
      return "批阅中";
    case "REVIEWED":
      return "已批阅";
    default:
      return status;
  }
}
