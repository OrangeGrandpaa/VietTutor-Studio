export type ChoiceOption = {
  label: string;
  text: string;
  value: string;
};

export type ChoiceQuestionGroup = {
  questionLines: string[];
  options: ChoiceOption[];
};

export const questionStartPattern =
  /^(?:câu|question|q)\s*\d+[\s.、):：-]|^(?:第\s*)?\d+\s*[.、)、):：]\s*\S|^(?:问题|题目|选择题|回答问题|questions?|câu hỏi)/i;

const optionPattern = /^([A-Da-d])\s*[.、)、):：]\s*(\S.*)$/;

export function normalizeQuestionPrompt(prompt: string) {
  return prompt
    .replace(/[\u2028\u2029]/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

export function getPromptLines(prompt: string) {
  return normalizeQuestionPrompt(prompt)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseChoiceOption(line: string): ChoiceOption | null {
  const match = line.match(optionPattern);

  if (!match) {
    return null;
  }

  const label = match[1].toUpperCase();
  const text = match[2].trim();

  return {
    label,
    text,
    value: `${label}. ${text}`
  };
}

export function getChoiceOptions(prompt: string) {
  return getPromptLines(prompt).flatMap((line) => {
    const option = parseChoiceOption(line);
    return option ? [option] : [];
  });
}

export function isSelectedChoice(answer: string, option: ChoiceOption) {
  const normalized = answer.trim();
  return (
    normalized === option.label ||
    normalized.toUpperCase() === option.label ||
    normalized === option.value ||
    normalized === `${option.label}${option.text}` ||
    normalized === option.text
  );
}

export function buildChoiceQuestionGroups(questionLines: string[]) {
  const groups: ChoiceQuestionGroup[] = [];
  let current: ChoiceQuestionGroup | null = null;

  for (const line of questionLines) {
    const option = parseChoiceOption(line);

    if (option) {
      current ??= { questionLines: [], options: [] };
      current.options.push(option);
      continue;
    }

    if (!current) {
      current = { questionLines: [line], options: [] };
      continue;
    }

    if (current.options.length > 0 || questionStartPattern.test(line)) {
      groups.push(current);
      current = { questionLines: [line], options: [] };
      continue;
    }

    current.questionLines.push(line);
  }

  if (current) {
    groups.push(current);
  }

  return groups.filter((group) => group.options.length > 0);
}

export function getChoiceQuestionGroups(prompt: string) {
  return buildChoiceQuestionGroups(getPromptLines(prompt));
}

export function parseChoiceAnswerValues(answer: string | null | undefined, answerCount: number) {
  const normalized = answer?.trim() ?? "";

  if (answerCount <= 0) {
    return [];
  }

  if (!normalized) {
    return Array.from({ length: answerCount }, () => "");
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;

    if (Array.isArray(parsed)) {
      return Array.from({ length: answerCount }, (_, index) =>
        typeof parsed[index] === "string" ? parsed[index] : ""
      );
    }
  } catch {}

  return Array.from({ length: answerCount }, (_, index) => (index === 0 ? normalized : ""));
}

export function serializeChoiceAnswers(answers: string[]) {
  if (answers.length === 0) {
    return "";
  }

  if (answers.length === 1) {
    return answers[0];
  }

  return JSON.stringify(answers);
}

export function getChoiceAnswerStats(prompt: string, answer: string | null | undefined) {
  const groups = getChoiceQuestionGroups(prompt);

  if (groups.length === 0) {
    return null;
  }

  const values = parseChoiceAnswerValues(answer, groups.length);

  return {
    total: groups.length,
    answered: values.filter((value) => value.trim().length > 0).length
  };
}
