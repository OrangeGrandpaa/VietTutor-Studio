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
});
