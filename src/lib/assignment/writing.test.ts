import { describe, expect, it } from "vitest";

import { buildWritingReviewGroups, normalizeWritingStructure } from "@/lib/assignment/writing";

describe("writing helpers", () => {
  it("normalizes structure using only active fields", () => {
    const result = normalizeWritingStructure({
      title: "Demo",
      assignment_type: "writing",
      parts: [
        {
          part_title: "Part 1",
          instruction: "Do it",
          questions: [
            {
              question_number: 1,
              prompt: "Xin chao",
              answer: "Hello",
              detected_level: "A1",
              suggested_display_type: "sentence"
            }
          ]
        }
      ]
    });

    expect(result?.title).toBe("Demo");
    expect(result?.parts[0]?.questions[0]?.prompt).toBe("Xin chao");
  });

  it("keeps reading comprehension display hints", () => {
    const result = normalizeWritingStructure({
      title: "Reading demo",
      assignment_type: "writing",
      parts: [
        {
          part_title: "阅读理解",
          instruction: "阅读短文并回答问题",
          questions: [
            {
              question_number: 1,
              prompt: "阅读下面短文\nXin chao.\n1. Ai dang noi?",
              answer: "",
              detected_level: "A2",
              suggested_display_type: "reading"
            }
          ]
        }
      ]
    });

    expect(result?.parts[0]?.questions[0]?.suggested_display_type).toBe("reading");
  });

  it("computes review stats from latest feedback", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    const result = buildWritingReviewGroups(
      [
        {
          id: "section-1",
          assignmentId: "assignment-1",
          sectionTitle: "Q1",
          originalText: "Question 1",
          vietnameseText: "Answer 1",
          chineseTranslation: null,
          detectedLevel: "A1",
          displayType: "SENTENCE",
          orderIndex: 1,
          createdAt: now,
          updatedAt: now,
          feedbacks: [
            {
              id: "feedback-1",
              assignmentId: "assignment-1",
              sectionId: "section-1",
              explanation: "Looks good",
              score: 100,
              createdAt: now,
              updatedAt: now
            }
          ]
        }
      ],
      {
        title: "Demo",
        assignment_type: "writing",
        parts: [
          {
            part_title: "Part 1",
            instruction: "",
            questions: [
              {
                question_number: 1,
                prompt: "Question 1",
                answer: "Answer 1",
                detected_level: "A1",
                suggested_display_type: "sentence"
              }
            ]
          }
        ]
      }
    );

    expect(result.stats.totalQuestions).toBe(1);
    expect(result.stats.reviewedQuestions).toBe(1);
    expect(result.stats.correctQuestions).toBe(1);
    expect(result.stats.accuracy).toBe(100);
  });

  it("builds exercise navigation groups from exercise headings", () => {
    const now = new Date("2026-07-08T00:00:00.000Z");
    const sections = Array.from({ length: 4 }, (_, index) => ({
      id: `section-${index + 1}`,
      assignmentId: "assignment-1",
      sectionTitle: `Q${index + 1}`,
      originalText:
        index === 0
          ? "练习 13：句型转换\n1. Tôi cao hơn anh ấy\n→ Anh ấy __________ tôi"
          : `${index + 1}. Question`,
      vietnameseText: null,
      chineseTranslation: null,
      detectedLevel: null,
      displayType: "SENTENCE",
      orderIndex: index + 1,
      createdAt: now,
      updatedAt: now,
      feedbacks: []
    }));

    const result = buildWritingReviewGroups(sections, {
      title: "Demo",
      assignment_type: "writing",
      parts: [
        {
          part_title: "题目列表",
          instruction: "",
          questions: sections.map((section, index) => ({
            question_number: index + 1,
            prompt: section.originalText,
            answer: "",
            detected_level: "",
            suggested_display_type: "sentence"
          }))
        }
      ]
    });

    expect(result.groups[0]?.exerciseGroups[0]).toMatchObject({
      title: "练习 13：句型转换",
      firstQuestionId: "section-1",
      totalQuestions: 4
    });
  });
});
