import { CheckCircle2, Database, FolderLock, KeyRound, Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";

const checks: Array<[string, string, typeof KeyRound]> = [
  ["密码访问", "通过环境变量密码和 HttpOnly Cookie 控制网站访问。", KeyRound],
  ["数据存储", "当前使用 Prisma + SQLite，后续可以平滑迁移到 PostgreSQL。", Database],
  ["文件保护", "上传文件不放在 public 目录，通过受保护的 API 读取。", FolderLock],
  ["AI Service", "Kimi 调用已经封装，后续可以继续扩展其他模型或服务。", Sparkles]
];

const roadmapItems = ["词汇本模块", "错题本模块", "学习日历模块", "自动发音评分", "AI 复习题生成"];

export default async function SettingsPage() {
  await requireAuth();

  return (
    <AppShell
      title="设置"
      description="查看当前系统能力、部署形态和后续可扩展方向。"
    >
      <PageShell>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {checks.map(([title, description, Icon]) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <CardTitle className="text-lg">{title}</CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>后续扩展预留</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              {roadmapItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl border border-border/70 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>会话管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                当前登录会话使用服务端校验。页面访问、文件读取和 API 调用都依赖认证状态。
              </p>
              <LogoutButton />
            </CardContent>
          </Card>
        </section>
      </PageShell>
    </AppShell>
  );
}
