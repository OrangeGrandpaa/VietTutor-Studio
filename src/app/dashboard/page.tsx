import Link from "next/link";

import { RecentAssignmentList } from "@/components/dashboard/recent-assignment-list";
import { AccuracyTrendChart } from "@/components/dashboard/accuracy-trend-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
import { formatPercent } from "@/lib/utils/format";

export default async function DashboardPage() {
  await requireAuth();
  const data = await getDashboardData();

  return (
    <AppShell
      title="Dashboard"
      description="总览作业、课件和练习进展。MVP 已覆盖上传、结构化、批阅、录音和统计主链路。"
      actions={
        <>
          <Link href="/assignments/writing/new" className={buttonVariants()}>
            上传笔头作业
          </Link>
          <Link href="/assignments/speaking/new" className={buttonVariants({ variant: "outline" })}>
            新建口语练习
          </Link>
        </>
      }
    >
      <PageShell>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="总作业数"
            value={data.overview.totalAssignments}
            hint={`${data.overview.completedAssignments} 份已完成批阅`}
          />
          <StatCard
            label="待批阅"
            value={data.overview.pendingAssignments}
            hint="包括未批阅和批阅中作业"
          />
          <StatCard
            label="平均正确率"
            value={formatPercent(data.overview.averageAccuracy)}
            hint={`笔头平均 ${formatPercent(data.scores.writingAverage)}`}
          />
          <StatCard
            label="口语平均分"
            value={formatPercent(data.scores.speakingAverage)}
            hint={`${data.achievements.recordingsCount} 条录音已沉淀`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>正确率趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <AccuracyTrendChart data={data.trend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>学习成就</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-secondary/60 p-4">
                <p className="text-sm text-muted-foreground">连续学习天数</p>
                <p className="mt-2 font-serif text-4xl">{data.achievements.streakDays}</p>
              </div>
              <div className="rounded-2xl bg-secondary/60 p-4">
                <p className="text-sm text-muted-foreground">完成录音数</p>
                <p className="mt-2 font-serif text-4xl">{data.achievements.recordingsCount}</p>
              </div>
              <div className="rounded-2xl bg-secondary/60 p-4">
                <p className="text-sm text-muted-foreground">课件数量</p>
                <p className="mt-2 font-serif text-4xl">{data.achievements.materialsCount}</p>
              </div>
              <div className="rounded-2xl bg-secondary/60 p-4">
                <p className="text-sm text-muted-foreground">最高正确率</p>
                <p className="mt-2 font-serif text-4xl">{formatPercent(data.achievements.bestAccuracy)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <RecentAssignmentList
            title="最近 5 条笔头作业"
            items={data.recentWriting}
            detailBasePath="/assignments/writing"
          />
          <RecentAssignmentList
            title="最近 5 条口语作业"
            items={data.recentSpeaking}
            detailBasePath="/assignments/speaking"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>课件库</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-sm text-muted-foreground">总课件</p>
                <p className="mt-2 text-3xl font-semibold">{data.materials.total}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-sm text-muted-foreground">PDF / Word</p>
                <p className="mt-2 text-3xl font-semibold">{data.materials.pdf + data.materials.word}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-sm text-muted-foreground">音视频/图片</p>
                <p className="mt-2 text-3xl font-semibold">{data.materials.media}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>当前节奏</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>PowerPoint 课件：{data.materials.powerpoint} 份。</p>
              <p>正确率趋势和课件库会继续累积，计划扩展：学习日历、词汇本和错题本模块。</p>
            </CardContent>
          </Card>
        </section>
      </PageShell>
    </AppShell>
  );
}
