"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function RetryAiButton({
  endpoint,
  method = "POST",
  body
}: {
  endpoint: string;
  method?: "POST" | "PATCH";
  body?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const response = await fetch(endpoint, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined
          });
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;

          if (!response.ok) {
            throw new Error(payload?.message ?? "AI 重试失败。");
          }

          toast.success(payload?.message ?? "AI 结构化已重试。");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "AI 重试失败。");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "处理中..." : "重新调用 AI"}
    </Button>
  );
}
