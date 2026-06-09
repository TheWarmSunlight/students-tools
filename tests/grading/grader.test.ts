import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/domain/types";
import { gradeSubmission } from "@/lib/grading/grader";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    questionNo: "Q1",
    type: "blank",
    prompt: "填空",
    itemCount: 3,
    options: [],
    items: [
      { index: 0, answer: "1/2", gradingMode: "numeric" },
      { index: 1, answer: "交换律,加法交换律", gradingMode: "text" },
      { index: 2, answer: "3", gradingMode: "numeric" },
    ],
    knowledgePoints: ["加法交换律"],
    difficulty: "基础",
    includeInStats: true,
    explanation: "",
    ...overrides,
  };
}

describe("gradeSubmission", () => {
  it("grades mixed numeric and text blanks item by item", () => {
    const graded = gradeSubmission(question(), ["0.5", "加 法 交 换 律", "2+1"]);

    expect(graded).toEqual({
      questionId: "q-1",
      student: { seatNo: "", name: "" },
      items: [
        { index: 0, correct: true },
        { index: 1, correct: true },
        { index: 2, correct: true },
      ],
      allCorrect: true,
    });
  });

  it("accepts any comma-separated text answer after whitespace normalization", () => {
    const graded = gradeSubmission(question(), ["1/2", " 交换律 ", "3"]);

    expect(graded.items[1]).toEqual({ index: 1, correct: true });
    expect(graded.allCorrect).toBe(true);
  });

  it("passes numeric format errors through to the graded item", () => {
    const graded = gradeSubmission(question(), ["1/0", "加法交换律", "3"]);

    expect(graded.items[0]).toEqual({
      index: 0,
      correct: false,
      reason: "格式无法识别",
    });
    expect(graded.allCorrect).toBe(false);
  });

  it("grades matching answers item by item after whitespace and case normalization", () => {
    const graded = gradeSubmission(
      question({
        id: "q-2",
        type: "matching",
        itemCount: 2,
        items: [
          { index: 0, answer: "①-B", gradingMode: "matching" },
          { index: 1, answer: "②-a", gradingMode: "matching" },
        ],
      }),
      [" ①-b ", "②-c"],
    );

    expect(graded.items).toEqual([
      { index: 0, correct: true },
      { index: 1, correct: false },
    ]);
    expect(graded.allCorrect).toBe(false);
  });

  it("marks missing answers wrong", () => {
    const graded = gradeSubmission(question(), ["0.5"]);

    expect(graded.items).toEqual([
      { index: 0, correct: true },
      { index: 1, correct: false },
      { index: 2, correct: false, reason: "格式无法识别" },
    ]);
    expect(graded.allCorrect).toBe(false);
  });

  it("returns the provided student identity", () => {
    const student = { seatNo: "07", name: "王同学" };

    expect(gradeSubmission(question(), ["0.5", "加法交换律", "3"], student).student).toEqual(student);
  });
});
