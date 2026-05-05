import { format } from "date-fns";
import {
  AssignmentStatus,
  AssignmentType,
  DisplayType,
  MaterialCategory,
  MaterialFileType,
  ProgressStatus,
  SpeakingUnitType
} from "@prisma/client";

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd HH:mm");
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--";
  }

  return `${value}%`;
}

export function assignmentStatusLabel(status: AssignmentStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return "未批阅";
    case "REVIEWING":
      return "批阅中";
    case "REVIEWED":
      return "已批阅";
    case "AI_FAILED":
      return "AI 失败";
    default:
      return status;
  }
}

export function assignmentTypeLabel(type: AssignmentType) {
  return type === "WRITING" ? "笔头作业" : "口语作业";
}

export function progressStatusLabel(status: ProgressStatus) {
  switch (status) {
    case "NOT_STARTED":
      return "未开始";
    case "IN_PROGRESS":
      return "学习中";
    case "COMPLETED":
      return "已完成";
    case "NEEDS_REVIEW":
      return "需要复习";
    default:
      return status;
  }
}

export function materialFileTypeLabel(type: MaterialFileType) {
  const mapping: Record<MaterialFileType, string> = {
    PDF: "PDF",
    WORD: "Word",
    POWERPOINT: "PowerPoint",
    MARKDOWN: "Markdown",
    IMAGE: "图片",
    AUDIO: "音频",
    VIDEO: "视频",
    OTHER: "其他"
  };

  return mapping[type];
}

export function materialCategoryLabel(category: MaterialCategory) {
  const mapping: Record<MaterialCategory, string> = {
    PRONUNCIATION: "发音",
    VOCABULARY: "词汇",
    GRAMMAR: "语法",
    LISTENING: "听力",
    SPEAKING: "口语",
    READING: "阅读",
    WRITING: "写作",
    INTEGRATED: "综合"
  };

  return mapping[category];
}

export function displayTypeLabel(type: DisplayType) {
  const mapping: Record<DisplayType, string> = {
    SENTENCE: "句子",
    PARAGRAPH: "段落",
    DIALOGUE: "对话",
    ESSAY: "短文",
    VOCABULARY: "词汇"
  };

  return mapping[type];
}

export function speakingUnitTypeLabel(type: SpeakingUnitType) {
  const mapping: Record<SpeakingUnitType, string> = {
    WORD: "单词",
    PHRASE: "短语",
    SENTENCE: "句子",
    PARAGRAPH: "段落",
    ARTICLE: "文章",
    DIALOGUE: "对话"
  };

  return mapping[type];
}
