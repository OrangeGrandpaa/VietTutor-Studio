import type { Recording, SpeakingFeedback, SpeakingUnit } from "@prisma/client";

export type SpeakingUnitWithRelations = SpeakingUnit & {
  recordings: Array<
    Recording & {
      feedback: SpeakingFeedback | null;
    }
  >;
};

export type SpeakingReviewItem = {
  id: string;
  unitType: SpeakingUnit["unitType"];
  content: string;
  orderIndex: number;
  latestRecording:
    | (Recording & {
        feedback: SpeakingFeedback | null;
      })
    | null;
  recordingsCount: number;
  isReviewed: boolean;
  overallScore: number | null;
};

export type SpeakingReviewGroup = {
  label: string;
  key: string;
  totalUnits: number;
  recordedUnits: number;
  reviewedUnits: number;
  averageOverallScore: number | null;
  units: SpeakingReviewItem[];
};

export type SpeakingReviewStats = {
  totalUnits: number;
  recordedUnits: number;
  reviewedUnits: number;
  pendingUnits: number;
  averageOverallScore: number | null;
};

function averageScore(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function unitTypeLabel(unitType: SpeakingUnit["unitType"]) {
  switch (unitType) {
    case "WORD":
      return "单词练习";
    case "PHRASE":
      return "短语练习";
    case "SENTENCE":
      return "句子练习";
    case "PARAGRAPH":
      return "段落练习";
    case "ARTICLE":
      return "文章练习";
    case "DIALOGUE":
      return "对话练习";
    default:
      return "口语练习";
  }
}

function getLatestRecording(unit: SpeakingUnitWithRelations) {
  if (!unit.recordings.length) {
    return null;
  }

  return [...unit.recordings].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;
}

export function buildSpeakingReviewGroups(units: SpeakingUnitWithRelations[]): {
  groups: SpeakingReviewGroup[];
  stats: SpeakingReviewStats;
} {
  const mappedUnits: SpeakingReviewItem[] = units.map((unit) => {
    const latestRecording = getLatestRecording(unit);
    const overallScore = latestRecording?.feedback?.overallScore ?? null;

    return {
      id: unit.id,
      unitType: unit.unitType,
      content: unit.content,
      orderIndex: unit.orderIndex,
      latestRecording,
      recordingsCount: unit.recordings.length,
      isReviewed: overallScore !== null,
      overallScore
    };
  });

  const groupedMap = new Map<string, SpeakingReviewItem[]>();

  for (const unit of mappedUnits) {
    const key = unit.unitType;
    const bucket = groupedMap.get(key) ?? [];
    bucket.push(unit);
    groupedMap.set(key, bucket);
  }

  const groups: SpeakingReviewGroup[] = [...groupedMap.entries()]
    .map(([key, items]) => {
      const recordedUnits = items.filter((item) => item.recordingsCount > 0).length;
      const reviewedUnits = items.filter((item) => item.isReviewed).length;
      const scores = items.flatMap((item) => (item.overallScore === null ? [] : [item.overallScore]));

      return {
        key,
        label: unitTypeLabel(items[0]?.unitType ?? "SENTENCE"),
        totalUnits: items.length,
        recordedUnits,
        reviewedUnits,
        averageOverallScore: averageScore(scores),
        units: items.sort((a, b) => a.orderIndex - b.orderIndex)
      };
    })
    .sort((a, b) => a.units[0].orderIndex - b.units[0].orderIndex);

  const recordedUnits = mappedUnits.filter((item) => item.recordingsCount > 0).length;
  const reviewedUnits = mappedUnits.filter((item) => item.isReviewed).length;
  const scores = mappedUnits.flatMap((item) => (item.overallScore === null ? [] : [item.overallScore]));

  return {
    groups,
    stats: {
      totalUnits: mappedUnits.length,
      recordedUnits,
      reviewedUnits,
      pendingUnits: Math.max(0, mappedUnits.length - reviewedUnits),
      averageOverallScore: averageScore(scores)
    }
  };
}
