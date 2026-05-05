"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Card className="w-full max-w-md bg-card/90">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <CardTitle className="font-serif text-4xl">进入学习空间</CardTitle>
        <CardDescription>
          密钥访问。登录成功后写入 HttpOnly Cookie 并在服务端校验。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);

            try {
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
              });

              const payload = (await response.json().catch(() => null)) as { message?: string } | null;

              if (!response.ok) {
                throw new Error(payload?.message ?? "登录失败。");
              }

              toast.success("登录成功。");
              router.push(searchParams.get("next") ?? "/dashboard");
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "登录失败。");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="password">访问密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="输入访问密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "登录中..." : "进入网站"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
