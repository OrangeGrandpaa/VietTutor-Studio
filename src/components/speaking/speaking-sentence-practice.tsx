"use client";

import { Mic, Pause, Play, RotateCcw, Square, Trash2, Volume2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type RecordingKind = "STUDENT" | "TEACHER_STANDARD";
type ReviewLevel = "ACCURATE" | "OKAY" | "MUMBLING";
type RecordingTarget =
  | { scope: "ASSIGNMENT"; assignmentId: string; kind: "STUDENT" }
  | { scope: "UNIT"; unitId: string; kind: RecordingKind };

type RecordingItem = {
  id: string;
  kind: RecordingKind;
  duration: number | null;
  createdAt: string | Date;
};

export type SpeakingSentenceUnit = {
  id: string;
  content: string;
  orderIndex: number;
  reviewLevel: ReviewLevel | null;
  reviewScore: number | null;
  recordings: RecordingItem[];
};

const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/wav"];

const reviewOptions: Array<{
  level: ReviewLevel;
  label: string;
  score: number;
  className: string;
  selectedClassName: string;
}> = [
  {
    level: "ACCURATE",
    label: "准确",
    score: 10,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    selectedClassName: "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-600"
  },
  {
    level: "OKAY",
    label: "一般",
    score: 5,
    className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClassName: "border-amber-500 bg-amber-500 text-white hover:bg-amber-500"
  },
  {
    level: "MUMBLING",
    label: "叽里咕噜说些什么呢",
    score: 0,
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClassName: "border-red-500 bg-red-600 text-white hover:bg-red-600"
  }
];

function reviewBadge(level: ReviewLevel | null) {
  switch (level) {
    case "ACCURATE":
      return { label: "准确", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "OKAY":
      return { label: "一般", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "MUMBLING":
      return { label: "听不懂", className: "border-red-200 bg-red-50 text-red-700" };
    default:
      return { label: "待判断", className: "border-border bg-card text-muted-foreground" };
  }
}

function formatDuration(duration: number | null) {
  return duration ? `${duration.toFixed(1)} 秒` : "未知时长";
}

export function SpeakingSentencePractice({
  assignmentId,
  fullRecordings,
  units
}: {
  assignmentId: string;
  fullRecordings: RecordingItem[];
  units: SpeakingSentenceUnit[];
}) {
  const router = useRouter();
  const [activeUnitId, setActiveUnitId] = useState<string | null>(units[0]?.id ?? null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "ready">("idle");
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const activeUnit = units.find((unit) => unit.id === activeUnitId) ?? units[0] ?? null;
  const supportedMimeType = useMemo(
    () => mimeTypes.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)),
    []
  );

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function resetPreview(nextActiveUnitId: string | null = activeUnitId) {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    stopStream();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setRecordingState("idle");
    setRecordingTarget(null);
    setActiveUnitId(nextActiveUnitId);
  }

  function selectUnit(unitId: string) {
    if (unitId !== activeUnitId) {
      resetPreview(unitId);
      return;
    }

    setActiveUnitId(unitId);
  }

  async function startRecording(target: RecordingTarget) {
    try {
      resetPreview(activeUnitId);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, supportedMimeType ? { mimeType: supportedMimeType } : undefined);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onpause = () => {
        setRecordingState("paused");
      };
      recorder.onresume = () => {
        setRecordingState("recording");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setDuration((Date.now() - startedAtRef.current) / 1000);
        setRecordingState("ready");
        stopStream();
      };

      recorder.start();
      startedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      if (target.scope === "UNIT") {
        setActiveUnitId(target.unitId);
      }
      setRecordingTarget(target);
      setRecordingState("recording");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法访问麦克风。");
      resetPreview(activeUnitId);
    }
  }

  async function restartRecording() {
    if (!recordingTarget) {
      return;
    }

    await startRecording(recordingTarget);
  }

  async function uploadPreview() {
    if (!previewBlob || !recordingTarget) {
      return;
    }

    try {
      const extension = previewBlob.type.includes("wav") ? "wav" : "webm";
      const fileName =
        recordingTarget.scope === "ASSIGNMENT"
          ? "full-text-recording"
          : recordingTarget.kind === "TEACHER_STANDARD"
            ? "teacher-recording"
            : "student-recording";
      const file = new File([previewBlob], `${fileName}.${extension}`, { type: previewBlob.type || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("duration", String(duration));
      formData.append("kind", recordingTarget.kind);

      if (recordingTarget.scope === "ASSIGNMENT") {
        formData.append("assignmentId", recordingTarget.assignmentId);
      } else {
        formData.append("speakingUnitId", recordingTarget.unitId);
      }

      const response = await fetch("/api/recordings", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "录音上传失败。");
      }

      toast.success(
        recordingTarget.scope === "ASSIGNMENT"
          ? "全文录音已保存。"
          : recordingTarget.kind === "TEACHER_STANDARD"
            ? "教师发音已保存。"
            : "学生录音已保存。"
      );
      router.refresh();
      resetPreview(recordingTarget.scope === "UNIT" ? recordingTarget.unitId : activeUnitId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "录音上传失败。");
    }
  }

  async function deleteRecording(recordingId: string) {
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("删除失败。");
      }

      toast.success("录音已删除。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function saveReview(level: ReviewLevel) {
    if (!activeUnit) {
      return;
    }

    try {
      const response = await fetch(`/api/assignments/speaking/${assignmentId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          speakingUnitId: activeUnit.id,
          reviewLevel: level
        })
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "批阅保存失败。");
      }

      toast.success("批阅结果已保存。");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批阅保存失败。");
    }
  }

  const activeStudentRecordings = activeUnit?.recordings.filter((recording) => recording.kind === "STUDENT") ?? [];
  const activeTeacherRecordings =
    activeUnit?.recordings.filter((recording) => recording.kind === "TEACHER_STANDARD") ?? [];
  const isFullRecordingActive = recordingTarget?.scope === "ASSIGNMENT";
  const isUnitRecordingActive = Boolean(
    recordingTarget?.scope === "UNIT" && recordingTarget.unitId === activeUnit?.id
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden border-primary/10 bg-card/90">
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-secondary/70 via-card to-emerald-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>口语朗读文本</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                句子以 ; 或 . 等句末标点拆分。点击任一句，即可录音、播放标准音并完成判断。
              </p>
            </div>
            <Badge variant="outline">{units.length} 句</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <article className="min-h-[520px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,235,0.72))] p-6 sm:p-8">
            <section className="mb-5 rounded-2xl border border-primary/15 bg-white/75 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">全文录音</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    先完整听一遍，再点击问题句子做发音判断。
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => startRecording({ scope: "ASSIGNMENT", assignmentId, kind: "STUDENT" })}
                  disabled={recordingState !== "idle"}
                >
                  <Mic className="mr-2 h-4 w-4" />
                  全文录音
                </Button>
              </div>

              {fullRecordings.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {fullRecordings.map((recording, index) => (
                    <div key={recording.id} className="rounded-xl bg-secondary/35 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">全文录音 {index + 1}</span>
                        <span className="text-xs text-muted-foreground">{formatDuration(recording.duration)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <audio controls className="min-w-0 flex-1" src={`/api/files/${recording.id}?kind=recording`} />
                        <Button variant="ghost" size="icon" onClick={() => deleteRecording(recording.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  还没有全文录音。
                </p>
              )}

              {isFullRecordingActive ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">全文录音录制</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        停止后先试听，确认无误再保存。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recordingState === "recording" ? (
                        <>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.pause()}>
                            <Pause className="mr-2 h-4 w-4" />
                            暂停
                          </Button>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.stop()}>
                            <Square className="mr-2 h-4 w-4" />
                            停止
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnitId)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                      {recordingState === "paused" ? (
                        <>
                          <Button onClick={() => mediaRecorderRef.current?.resume()}>
                            <Play className="mr-2 h-4 w-4" />
                            继续
                          </Button>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.stop()}>
                            <Square className="mr-2 h-4 w-4" />
                            停止
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnitId)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                      {recordingState === "ready" ? (
                        <>
                          <Button onClick={() => uploadPreview()}>保存录音</Button>
                          <Button variant="outline" onClick={() => restartRecording()}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重录
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnitId)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {previewUrl ? <audio controls className="w-full" src={previewUrl} /> : null}
                </div>
              ) : null}
            </section>

            <div className="space-y-1.5 text-base leading-6 text-foreground/85 sm:text-lg sm:leading-7">
              {units.map((unit) => {
                const badge = reviewBadge(unit.reviewLevel);
                const isActive = unit.id === activeUnit?.id;

                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => selectUnit(unit.id)}
                    className={cn(
                      "block w-full rounded-xl border px-3 py-1 text-left font-serif font-semibold tracking-wide transition-all",
                      "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white hover:shadow-soft",
                      isActive
                        ? "border-primary/40 bg-white shadow-soft"
                        : "border-transparent bg-white/45"
                    )}
                  >
                    <span className="mr-3 align-middle text-sm font-bold font-sans text-muted-foreground">
                      {String(unit.orderIndex).padStart(2, "0")}
                    </span>
                    <span className="align-middle font-bold">{unit.content}</span>
                    <span
                      className={cn(
                        "ml-3 inline-flex rounded-full border px-2 py-0.5 align-middle font-sans text-xs",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-4">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>句子互动窗体</CardTitle>
            </div>
            {activeUnit?.reviewScore !== null && activeUnit?.reviewScore !== undefined ? (
              <Badge variant="outline">{activeUnit.reviewScore} 分</Badge>
            ) : (
              <Badge variant="warning">待判断</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {activeUnit ? (
            <>
              <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  当前句子 #{activeUnit.orderIndex}
                </p>
                <p className="font-serif text-xl leading-9 text-foreground">{activeUnit.content}</p>
              </div>

              <section className="rounded-2xl border border-border/70 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">学生语音输入</h3>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => startRecording({ scope: "UNIT", unitId: activeUnit.id, kind: "STUDENT" })}
                    disabled={recordingState !== "idle"}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    学生录音
                  </Button>
                </div>

                {activeStudentRecordings.length > 0 ? (
                  <div className="space-y-3">
                    {activeStudentRecordings.map((recording, index) => (
                      <div key={recording.id} className="rounded-xl bg-muted/50 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">学生录音 {index + 1}</span>
                          <span className="text-xs text-muted-foreground">{formatDuration(recording.duration)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <audio controls className="min-w-0 flex-1" src={`/api/files/${recording.id}?kind=recording`} />
                          <Button variant="ghost" size="icon" onClick={() => deleteRecording(recording.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    这句还没有学生录音。
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border/70 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">教师发音</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      老师可录制发音，供学生反复对照。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      startRecording({ scope: "UNIT", unitId: activeUnit.id, kind: "TEACHER_STANDARD" })
                    }
                    disabled={recordingState !== "idle"}
                  >
                    <Volume2 className="mr-2 h-4 w-4" />
                    教师录制
                  </Button>
                </div>

                {activeTeacherRecordings.length > 0 ? (
                  <div className="space-y-3">
                    {activeTeacherRecordings.map((recording, index) => (
                      <div key={recording.id} className="rounded-xl bg-emerald-50/70 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">教师发音 {index + 1}</span>
                          <span className="text-xs text-muted-foreground">{formatDuration(recording.duration)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <audio controls className="min-w-0 flex-1" src={`/api/files/${recording.id}?kind=recording`} />
                          <Button variant="ghost" size="icon" onClick={() => deleteRecording(recording.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    这句还没有教师发音。
                  </p>
                )}
              </section>

              {isUnitRecordingActive ? (
                <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {recordingTarget?.kind === "TEACHER_STANDARD" ? "教师发音录制" : "学生录音录制"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        停止后先试听，确认无误再保存。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recordingState === "recording" ? (
                        <>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.pause()}>
                            <Pause className="mr-2 h-4 w-4" />
                            暂停
                          </Button>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.stop()}>
                            <Square className="mr-2 h-4 w-4" />
                            停止
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnit.id)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                      {recordingState === "paused" ? (
                        <>
                          <Button onClick={() => mediaRecorderRef.current?.resume()}>
                            <Play className="mr-2 h-4 w-4" />
                            继续
                          </Button>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.stop()}>
                            <Square className="mr-2 h-4 w-4" />
                            停止
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnit.id)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                      {recordingState === "ready" ? (
                        <>
                          <Button onClick={() => uploadPreview()}>保存录音</Button>
                          <Button variant="outline" onClick={() => restartRecording()}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重录
                          </Button>
                          <Button variant="ghost" onClick={() => resetPreview(activeUnit.id)}>
                            取消
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {previewUrl ? <audio controls className="w-full" src={previewUrl} /> : null}
                </section>
              ) : null}

              <section className="rounded-2xl border border-border/70 p-4">
                <h3 className="font-semibold">发音判断</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  三档结果分别记为 10 分、5 分、0 分。
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {reviewOptions.map((option) => (
                    <Button
                      key={option.level}
                      variant="outline"
                      className={cn(
                        "h-auto min-h-12 whitespace-normal border px-3 py-3",
                        activeUnit.reviewLevel === option.level ? option.selectedClassName : option.className
                      )}
                      onClick={() => saveReview(option.level)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p className="rounded-2xl bg-muted/40 p-5 text-sm text-muted-foreground">
              这份口语作业还没有可互动句子。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
