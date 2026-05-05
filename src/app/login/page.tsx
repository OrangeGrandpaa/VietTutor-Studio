import { redirect } from "next/navigation";

import { LoginForm } from "@/components/layout/login-form";
import { isAuthenticated } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <section className="space-y-6">
          <h1 className="font-serif text-6xl leading-none text-foreground/95">欢迎进入 Kiet 的越南语学习空间。</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            通过上传 Markdown 作业、进行网页录音、管理课件进度，将学习进度沉淀成可持续追踪的数据。
          </p>
        </section>
        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
