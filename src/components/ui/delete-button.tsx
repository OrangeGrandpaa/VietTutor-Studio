"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteButton({
  endpoint,
  label = "删除"
}: {
  endpoint: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={loading}
      onClick={async () => {
        if (!window.confirm("确认删除？此操作无法撤销。")) {
          return;
        }

        setLoading(true);
        try {
          const response = await fetch(endpoint, { method: "DELETE" });
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;

          if (!response.ok) {
            throw new Error(payload?.message ?? "删除失败。");
          }

          toast.success("已删除。");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "删除失败。");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "处理中..." : label}
    </Button>
  );
}
