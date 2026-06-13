import Link from "next/link";
import { BookOpenText } from "lucide-react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AppShell({
  title,
  description,
  children,
  actions,
  showSettings = true
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showSettings?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <Card className="grid h-full grid-rows-[auto_1fr_auto] gap-6 bg-card/90 p-6">
            <div className="space-y-4">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Viet Learning Studio</p>
                  <p className="text-sm text-muted-foreground">越南语学习空间</p>
                </div>
              </Link>
              <SidebarNav />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
              <div>
                <p className="text-sm font-medium">主题</p>
                <p className="text-xs text-muted-foreground">浅色 / 深色已预留</p>
              </div>
              <ThemeToggle />
            </div>
          </Card>
        </aside>
        <main className="space-y-6 py-1">
          <header className="flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-card/75 p-6 shadow-soft backdrop-blur-sm md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="font-serif text-4xl leading-none text-foreground/90">{title}</p>
              {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              {showSettings ? (
                <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
                  设置
                </Link>
              ) : null}
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
