export type WritingQuestion = {
  question_number: number;
  prompt: string;
  answer: string;
  detected_level: string;
  suggested_display_type: "sentence" | "paragraph" | "dialogue" | "essay" | "vocabulary";
};

export type WritingPart = {
  part_title: string;
  instruction: string;
  questions: WritingQuestion[];
};

export type WritingStructuredContent = {
  title: string;
  assignment_type: "writing";
  parts: WritingPart[];
};

export type SpeakingUnitPayload = {
  unit_type: "word" | "phrase" | "sentence" | "paragraph" | "article" | "dialogue";
  content: string;
  order_index: number;
};

export type SpeakingStructuredContent = {
  title: string;
  assignment_type: "speaking";
  units: SpeakingUnitPayload[];
};
