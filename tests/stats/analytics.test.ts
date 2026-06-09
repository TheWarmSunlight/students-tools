import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/domain/types";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    questionNo: "Q1",
    type: "blank",
    prompt: "填空",
    itemCount: 1,
    options: [],
    items: [{ index: 0, answer: "1", gradingMode: "text" }],
    knowledgePoints: ["知识点一"],
    difficulty: "基础",
    includeInStats: true,
    explanation: "",
    ...overrides,
  };
}

describe("buildClassroomAnalytics", () => {
  it("builds classroom accuracy, question stats, knowledge points, and student layers", () => {
    const students = [
      { id: "s-1", seatNo: "01", name: "王同学" },
      { id: "s-2", seatNo: "02", name: "李同学" },
    ];
    const questions = [
      question({
        id: "q-1",
        questionNo: "Q1",
        itemCount: 2,
        items: [
          { index: 0, answer: "1", gradingMode: "text" },
          { index: 1, answer: "2", gradingMode: "text" },
        ],
        knowledgePoints: ["分数加法"],
      }),
      question({
        id: "q-2",
        questionNo: "Q2",
        items: [{ index: 0, answer: "3", gradingMode: "text" }],
        knowledgePoints: ["分数加法", "通分"],
      }),
    ];

    const analytics = buildClassroomAnalytics({
      expectedCount: 3,
      students,
      questions,
      submissions: [
        {
          studentId: "s-1",
          questionId: "q-1",
          gradedItems: [
            { index: 0, correct: true },
            { index: 1, correct: true },
          ],
          allCorrect: true,
        },
        {
          studentId: "s-2",
          questionId: "q-1",
          gradedItems: [
            { index: 0, correct: true },
            { index: 1, correct: false },
          ],
          allCorrect: false,
        },
        {
          studentId: "s-1",
          questionId: "q-2",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
        {
          studentId: "s-2",
          questionId: "q-2",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
      ],
    });

    expect(analytics).toMatchObject({
      expectedCount: 3,
      studentCount: 2,
      submittedStudentCount: 2,
      submitRate: 2 / 3,
      averageAccuracy: 5 / 6,
    });
    expect(analytics.questions).toEqual([
      {
        questionId: "q-1",
        questionNo: "Q1",
        itemAccuracy: 3 / 4,
        errorRate: 1 / 4,
        allCorrectRate: 1 / 2,
        submittedCount: 2,
        correctItems: 3,
        totalItems: 4,
        itemStats: [
          { index: 0, correct: 2, total: 2, accuracy: 1, errorRate: 0 },
          { index: 1, correct: 1, total: 2, accuracy: 1 / 2, errorRate: 1 / 2 },
        ],
      },
      {
        questionId: "q-2",
        questionNo: "Q2",
        itemAccuracy: 1,
        errorRate: 0,
        allCorrectRate: 1,
        submittedCount: 2,
        correctItems: 2,
        totalItems: 2,
        itemStats: [{ index: 0, correct: 2, total: 2, accuracy: 1, errorRate: 0 }],
      },
    ]);
    expect(analytics.knowledgePoints).toEqual([
      { name: "分数加法", accuracy: 5 / 6, correctItems: 5, totalItems: 6 },
      { name: "通分", accuracy: 1, correctItems: 2, totalItems: 2 },
    ]);
    expect(analytics.students).toEqual([
      {
        id: "s-1",
        seatNo: "01",
        name: "王同学",
        accuracy: 1,
        correctItems: 3,
        totalItems: 3,
        layerCode: "A",
      },
      {
        id: "s-2",
        seatNo: "02",
        name: "李同学",
        accuracy: 2 / 3,
        correctItems: 2,
        totalItems: 3,
        layerCode: "C",
      },
    ]);
    expect(analytics.layers).toEqual([
      { code: "A", name: "优秀拓展层", count: 1, percentage: 1 / 2 },
      { code: "B", name: "良好提升层", count: 0, percentage: 0 },
      { code: "C", name: "基础夯实层", count: 1, percentage: 1 / 2 },
      { code: "D", name: "补差帮扶层", count: 0, percentage: 0 },
    ]);
  });

  it("counts only the first valid graded item per index and recomputes all-correct from expected items", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 1,
      students: [{ id: "s-1", seatNo: "01", name: "王同学" }],
      questions: [
        question({
          id: "q-1",
          questionNo: "Q1",
          itemCount: 2,
          items: [
            { index: 0, answer: "1", gradingMode: "text" },
            { index: 1, answer: "2", gradingMode: "text" },
          ],
          knowledgePoints: ["分数加法"],
        }),
      ],
      submissions: [
        {
          studentId: "s-1",
          questionId: "q-1",
          gradedItems: [
            { index: 0, correct: true },
            { index: 0, correct: false },
            { index: 99, correct: true },
          ],
          allCorrect: true,
        },
      ],
    });

    expect(analytics.averageAccuracy).toBe(1);
    expect(analytics.questions).toEqual([
      {
        questionId: "q-1",
        questionNo: "Q1",
        itemAccuracy: 1,
        errorRate: 0,
        allCorrectRate: 0,
        submittedCount: 1,
        correctItems: 1,
        totalItems: 1,
        itemStats: [
          { index: 0, correct: 1, total: 1, accuracy: 1, errorRate: 0 },
          { index: 1, correct: 0, total: 0, accuracy: 0, errorRate: 0 },
        ],
      },
    ]);
    expect(analytics.knowledgePoints).toEqual([
      { name: "分数加法", accuracy: 1, correctItems: 1, totalItems: 1 },
    ]);
    expect(analytics.students).toEqual([
      {
        id: "s-1",
        seatNo: "01",
        name: "王同学",
        accuracy: 1,
        correctItems: 1,
        totalItems: 1,
        layerCode: "A",
      },
    ]);
  });

  it("treats a clean submission as all-correct when every expected item is correct despite a false flag", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 1,
      students: [{ id: "s-1", seatNo: "01", name: "王同学" }],
      questions: [
        question({
          id: "q-1",
          questionNo: "Q1",
          itemCount: 2,
          items: [
            { index: 0, answer: "1", gradingMode: "text" },
            { index: 1, answer: "2", gradingMode: "text" },
          ],
          knowledgePoints: ["分数加法"],
        }),
      ],
      submissions: [
        {
          studentId: "s-1",
          questionId: "q-1",
          gradedItems: [
            { index: 0, correct: true },
            { index: 1, correct: true },
          ],
          allCorrect: false,
        },
      ],
    });

    expect(analytics.averageAccuracy).toBe(1);
    expect(analytics.questions[0]).toMatchObject({
      allCorrectRate: 1,
      correctItems: 2,
      totalItems: 2,
      itemStats: [
        { index: 0, correct: 1, total: 1, accuracy: 1, errorRate: 0 },
        { index: 1, correct: 1, total: 1, accuracy: 1, errorRate: 0 },
      ],
    });
    expect(analytics.knowledgePoints).toEqual([
      { name: "分数加法", accuracy: 1, correctItems: 2, totalItems: 2 },
    ]);
    expect(analytics.students[0]).toMatchObject({
      accuracy: 1,
      correctItems: 2,
      totalItems: 2,
      layerCode: "A",
    });
  });

  it("excludes includeInStats=false questions from analytics but still counts their submissions", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 2,
      students: [
        { id: "s-1", seatNo: "01", name: "王同学" },
        { id: "s-2", seatNo: "02", name: "李同学" },
      ],
      questions: [
        question({ id: "included", questionNo: "Q1", knowledgePoints: ["纳入"] }),
        question({
          id: "excluded",
          questionNo: "Q2",
          knowledgePoints: ["不纳入"],
          includeInStats: false,
        }),
      ],
      submissions: [
        {
          studentId: "s-1",
          questionId: "excluded",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
        {
          studentId: "s-2",
          questionId: "included",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
      ],
    });

    expect(analytics.submittedStudentCount).toBe(2);
    expect(analytics.submitRate).toBe(1);
    expect(analytics.averageAccuracy).toBe(1);
    expect(analytics.questions.map((questionStats) => questionStats.questionId)).toEqual(["included"]);
    expect(analytics.knowledgePoints).toEqual([
      { name: "纳入", accuracy: 1, correctItems: 1, totalItems: 1 },
    ]);
    expect(analytics.students.map((student) => [student.id, student.accuracy, student.layerCode])).toEqual([
      ["s-1", 0, "D"],
      ["s-2", 1, "A"],
    ]);
  });

  it("places students without included submissions in layer D and computes layer percentages", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 3,
      students: [
        { id: "s-1", seatNo: "01", name: "王同学" },
        { id: "s-2", seatNo: "02", name: "李同学" },
        { id: "s-3", seatNo: "03", name: "张同学" },
      ],
      questions: [question()],
      submissions: [
        {
          studentId: "s-1",
          questionId: "q-1",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
        {
          studentId: "s-2",
          questionId: "q-1",
          gradedItems: [{ index: 0, correct: false }],
          allCorrect: false,
        },
      ],
    });

    expect(analytics.students.map((student) => [student.id, student.layerCode])).toEqual([
      ["s-1", "A"],
      ["s-2", "D"],
      ["s-3", "D"],
    ]);
    expect(analytics.layers).toEqual([
      { code: "A", name: "优秀拓展层", count: 1, percentage: 1 / 3 },
      { code: "B", name: "良好提升层", count: 0, percentage: 0 },
      { code: "C", name: "基础夯实层", count: 0, percentage: 0 },
      { code: "D", name: "补差帮扶层", count: 2, percentage: 2 / 3 },
    ]);
  });

  it("ignores unknown question submissions for accuracy while counting them in submit rate", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 2,
      students: [{ id: "s-1", seatNo: "01", name: "王同学" }],
      questions: [question()],
      submissions: [
        {
          studentId: "s-1",
          questionId: "unknown",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
      ],
    });

    expect(analytics.submittedStudentCount).toBe(1);
    expect(analytics.submitRate).toBe(1 / 2);
    expect(analytics.averageAccuracy).toBe(0);
    expect(analytics.questions[0]).toMatchObject({
      questionId: "q-1",
      itemAccuracy: 0,
      errorRate: 0,
      allCorrectRate: 0,
      submittedCount: 0,
      correctItems: 0,
      totalItems: 0,
    });
    expect(analytics.knowledgePoints).toEqual([
      { name: "知识点一", accuracy: 0, correctItems: 0, totalItems: 0 },
    ]);
    expect(analytics.students[0]).toMatchObject({
      accuracy: 0,
      correctItems: 0,
      totalItems: 0,
      layerCode: "D",
    });
  });

  it("ignores unknown student submissions for submit rate and analytics", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 2,
      students: [{ id: "s-1", seatNo: "01", name: "王同学" }],
      questions: [question({ id: "q-1", questionNo: "Q1", knowledgePoints: ["纳入"] })],
      submissions: [
        {
          studentId: "s-ghost",
          questionId: "q-1",
          gradedItems: [{ index: 0, correct: true }],
          allCorrect: true,
        },
        {
          studentId: "s-1",
          questionId: "q-1",
          gradedItems: [{ index: 0, correct: false }],
          allCorrect: false,
        },
      ],
    });

    expect(analytics.submittedStudentCount).toBe(1);
    expect(analytics.submitRate).toBe(1 / 2);
    expect(analytics.averageAccuracy).toBe(0);
    expect(analytics.questions).toEqual([
      {
        questionId: "q-1",
        questionNo: "Q1",
        itemAccuracy: 0,
        errorRate: 1,
        allCorrectRate: 0,
        submittedCount: 1,
        correctItems: 0,
        totalItems: 1,
        itemStats: [{ index: 0, correct: 0, total: 1, accuracy: 0, errorRate: 1 }],
      },
    ]);
    expect(analytics.knowledgePoints).toEqual([
      { name: "纳入", accuracy: 0, correctItems: 0, totalItems: 1 },
    ]);
    expect(analytics.students).toEqual([
      {
        id: "s-1",
        seatNo: "01",
        name: "王同学",
        accuracy: 0,
        correctItems: 0,
        totalItems: 1,
        layerCode: "D",
      },
    ]);
    expect(analytics.layers).toEqual([
      { code: "A", name: "优秀拓展层", count: 0, percentage: 0 },
      { code: "B", name: "良好提升层", count: 0, percentage: 0 },
      { code: "C", name: "基础夯实层", count: 0, percentage: 0 },
      { code: "D", name: "补差帮扶层", count: 1, percentage: 1 },
    ]);
  });

  it("returns zero rates instead of NaN when expectedCount or students are empty", () => {
    const analytics = buildClassroomAnalytics({
      expectedCount: 0,
      students: [],
      questions: [question()],
      submissions: [],
    });

    expect(analytics.submitRate).toBe(0);
    expect(analytics.averageAccuracy).toBe(0);
    expect(analytics.layers).toEqual([
      { code: "A", name: "优秀拓展层", count: 0, percentage: 0 },
      { code: "B", name: "良好提升层", count: 0, percentage: 0 },
      { code: "C", name: "基础夯实层", count: 0, percentage: 0 },
      { code: "D", name: "补差帮扶层", count: 0, percentage: 0 },
    ]);
    expect(Number.isNaN(analytics.submitRate)).toBe(false);
    expect(Number.isNaN(analytics.averageAccuracy)).toBe(false);
    expect(analytics.layers.every((layer) => !Number.isNaN(layer.percentage))).toBe(true);
  });
});
