"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RefreshAssignmentButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={refreshing}
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        window.setTimeout(() => setRefreshing(false), 800);
      }}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      {refreshing ? "刷新中..." : "刷新状态"}
    </Button>
  );
}
