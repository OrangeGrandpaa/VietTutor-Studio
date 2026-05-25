import Link from "next/link";
import type { Route } from "next";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function PaginationControls({
  buildHref,
  page,
  totalItems,
  totalPages
}: {
  buildHref: (page: number) => Route;
  page: number;
  totalItems: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        第 {page} / {totalPages} 页，共 {totalItems} 条
      </span>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page <= 1}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            page <= 1 && "pointer-events-none opacity-50"
          )}
          href={buildHref(Math.max(1, page - 1))}
        >
          上一页
        </Link>
        <Link
          aria-disabled={page >= totalPages}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            page >= totalPages && "pointer-events-none opacity-50"
          )}
          href={buildHref(Math.min(totalPages, page + 1))}
        >
          下一页
        </Link>
      </div>
    </div>
  );
}
