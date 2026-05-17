"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";

export function DeleteButton({
  endpoint,
  label = "删除",
  variant = "ghost",
  size = "default",
  className
}: {
  endpoint: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      className={className}
      variant={variant}
      size={size}
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
