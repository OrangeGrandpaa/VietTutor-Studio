"use client";

import { Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RecordingReviewForm } from "@/components/speaking/recording-review-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpeakingReviewGroup } from "@/lib/assignment/speaking";
import { formatPercent, speakingUnitTypeLabel } from "@/lib/utils/format";

type RecordingItem = {
  id: string;
  duration: number | null;
  createdAt: string | Date;
  feedback?: {
    pronunciationIssue: string | null;
    toneIssue: string | null;
    fluencyComment: string | null;
    speedComment: string | null;
    repeatWords: string | null;
    teacherSuggestion: string | null;
    pronunciationScore: number | null;
    fluencyScore: number | null;
    toneScore: number | null;
    overallScore: number | null;
  } | null;
};

type SpeakingUnitCard = {
  id: string;
  unitType: "WORD" | "PHRASE" | "SENTENCE" | "PARAGRAPH" | "ARTICLE" | "DIALOGUE";
  content: string;
  recordings: RecordingItem[];
};

const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/wav"];

function reviewBadge(recordings: RecordingItem[]) {
  const latest = recordings[0];
  const score = latest?.feedback?.overallScore ?? null;

  if (score === null) {
    return { label: "待批阅", variant: "warning" as const };
  }

  if (score >= 85) {
    return { label: "正确", variant: "success" as const };
  }

  if (score >= 60) {
    return { label: "已批阅", variant: "outline" as const };
  }

  return { label: "错误", variant: "destructive" as const };
}

export function SpeakingRecorderPanel({
  assignmentId,
  units,
  groups
}: {
  assignmentId: string;
  units: SpeakingUnitCard[];
  groups: SpeakingReviewGroup[];
}) {
  const router = useRouter();
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "ready">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const supportedMimeType = useMemo(
    () => mimeTypes.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)),
    []
  );

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording(unitId: string) {
    try {
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
      setActiveUnitId(unitId);
      setRecordingState("recording");
      setPreviewBlob(null);
      setPreviewUrl(null);
      setDuration(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法访问麦克风。");
    }
  }

  async function uploadPreview() {
    if (!previewBlob || !activeUnitId) {
      return;
    }

    const extension = previewBlob.type.includes("wav") ? "wav" : "webm";
    const file = new File([previewBlob], `recording.${extension}`, { type: previewBlob.type || "audio/webm" });
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("speakingUnitId", activeUnitId);
    formData.append("duration", String(duration));

    const response = await fetch("/api/recordings", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "录音上传失败。");
    }

    toast.success("录音已保存。");
    router.refresh();
    setRecordingState("idle");
    setPreviewBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setActiveUnitId(null);
  }

  function resetPreview() {
    stopStream();
    setPreviewBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setRecordingState("idle");
    setActiveUnitId(null);
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const groupUnits = units.filter((unit) => unit.unitType === group.key);

        return (
          <Card key={group.key}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{group.label}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {group.recordedUnits}/{group.totalUnits} 个单元已录音，平均综合分 {formatPercent(group.averageOverallScore)}
                  </p>
                </div>
                <Badge variant="outline">{group.totalUnits} 个单元</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupUnits.map((unit, index) => {
                const reviewState = reviewBadge(unit.recordings);

                return (
                  <div key={unit.id} className="rounded-[1.5rem] border border-border/70 p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">第 {index + 1} 项</Badge>
                      <Badge variant={reviewState.variant}>{reviewState.label}</Badge>
                      <Badge variant="outline">{speakingUnitTypeLabel(unit.unitType)}</Badge>
                      <Badge variant="outline">{unit.recordings.length} 条录音</Badge>
                    </div>

                    <p className="whitespace-pre-wrap text-base leading-8 text-foreground/85">{unit.content}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeUnitId !== unit.id || recordingState === "idle" ? (
                        <Button onClick={() => startRecording(unit.id)}>开始录音</Button>
                      ) : null}
                      {activeUnitId === unit.id && recordingState === "recording" ? (
                        <>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.pause()}>
                            <Pause className="mr-2 h-4 w-4" />
                            暂停
                          </Button>
                          <Button variant="outline" onClick={() => mediaRecorderRef.current?.stop()}>
                            <Square className="mr-2 h-4 w-4" />
                            停止
                          </Button>
                        </>
                      ) : null}
                      {activeUnitId === unit.id && recordingState === "paused" ? (
                        <Button onClick={() => mediaRecorderRef.current?.resume()}>
                          <Play className="mr-2 h-4 w-4" />
                          继续
                        </Button>
                      ) : null}
                      {activeUnitId === unit.id && recordingState === "ready" ? (
                        <>
                          <Button onClick={() => uploadPreview()}>保存录音</Button>
                          <Button variant="outline" onClick={resetPreview}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            重新录制
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {activeUnitId === unit.id && previewUrl ? (
                      <div className="mt-4 rounded-2xl border border-border/70 p-4">
                        <p className="mb-3 text-sm text-muted-foreground">录音预览，确认后再保存到服务器。</p>
                        <audio controls className="w-full" src={previewUrl} />
                      </div>
                    ) : null}

                    {unit.recordings.length > 0 ? (
                      <div className="mt-4 space-y-4">
                        {unit.recordings.map((recording, recordingIndex) => (
                          <div key={recording.id} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  第 {recordingIndex + 1} 条录音
                                </Badge>
                                {recording.feedback?.overallScore !== null &&
                                recording.feedback?.overallScore !== undefined ? (
                                  <Badge variant="outline">
                                    综合分 {formatPercent(recording.feedback.overallScore)}
                                  </Badge>
                                ) : (
                                  <Badge variant="warning">待批阅</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <audio controls src={`/api/files/${recording.id}?kind=recording`} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/recordings/${recording.id}`, {
                                        method: "DELETE"
                                      });
                                      if (!response.ok) throw new Error("删除失败。");
                                      toast.success("录音已删除。");
                                      router.refresh();
                                    } catch (error) {
                                      toast.error(error instanceof Error ? error.message : "删除失败。");
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <p className="mb-4 text-sm text-muted-foreground">
                              录音时长：{recording.duration ? `${recording.duration.toFixed(1)} 秒` : "未知"}
                            </p>

                            <RecordingReviewForm assignmentId={assignmentId} recording={recording} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
