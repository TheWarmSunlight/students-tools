import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AnalysisReport from "@/components/AnalysisReport";
import ClassroomDashboard from "@/components/ClassroomDashboard";
import QrPanel from "@/components/QrPanel";
import QuestionEditor from "@/components/QuestionEditor";
import {
  importAndCreateClassroom,
  requestAiReport,
  requestClassroomStatusUpdate,
  type TeacherFetcher,
} from "@/components/teacherRequests";
import { toStoredClassroom } from "@/components/teacherClassroom";
import type { ClassroomAnalytics } from "@/lib/stats/analytics";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const classroom = {
  id: "classroom-1",
  questionSetId: "set-1",
  teacherToken: "teacher-token-1",
  teacherUrl: "http://school.test/teacher/report/teacher-token-1",
  status: "draft" as const,
  expectedCount: 30,
  startedAt: null,
  endedAt: null,
  questions: [
    {
      questionId: "q-Q1",
      questionNo: "Q1",
      studentUrl: "http://school.test/student/token-q1",
      qrDataUrl: "data:image/png;base64,abc",
    },
    {
      questionId: "q-Q2",
      questionNo: "Q2",
      studentUrl: "http://school.test/student/token-q2",
      qrDataUrl: "data:image/png;base64,def",
    },
  ],
};

const stats: ClassroomAnalytics = {
  expectedCount: 30,
  studentCount: 12,
  submittedStudentCount: 8,
  submitRate: 8 / 30,
  averageAccuracy: 0.72,
  questions: [
    {
      questionId: "q-Q1",
      questionNo: "Q1",
      itemAccuracy: 0.75,
      errorRate: 0.25,
      allCorrectRate: 0.7,
      submittedCount: 8,
      correctItems: 6,
      totalItems: 8,
      itemStats: [{ index: 0, correct: 6, total: 8, accuracy: 0.75, errorRate: 0.25 }],
    },
  ],
  knowledgePoints: [
    { name: "分数小数互化", accuracy: 0.6, correctItems: 6, totalItems: 10 },
    { name: "分数凑整", accuracy: 0.85, correctItems: 17, totalItems: 20 },
  ],
  students: [
    {
      id: "student-1",
      seatNo: "01",
      name: "小明",
      accuracy: 0.9,
      correctItems: 9,
      totalItems: 10,
      layerCode: "A",
    },
  ],
  layers: [
    { code: "A", name: "优秀拓展层", count: 3, percentage: 0.25 },
    { code: "B", name: "良好提升层", count: 4, percentage: 0.33 },
    { code: "C", name: "基础夯实层", count: 3, percentage: 0.25 },
    { code: "D", name: "补差帮扶层", count: 2, percentage: 0.17 },
  ],
};

describe("teacher UI components", () => {
  it("renders the teacher import form with required controls", () => {
    const html = renderToStaticMarkup(<QuestionEditor />);

    expect(html).toContain("课堂题目导入");
    expect(html).toContain('data-testid="excel-file-input"');
    expect(html).toContain('accept=".xlsx"');
    expect(html).toContain('data-testid="classroom-title-input"');
    expect(html).toContain('data-testid="expected-count-input"');
    expect(html).toContain('data-testid="import-button"');
  });

  it("normalizes classroom creation responses for session storage", () => {
    const stored = toStoredClassroom({
      id: "classroom-1",
      questionSetId: "set-1",
      teacherToken: "teacher-token-1",
      teacherUrl: "http://school.test/teacher/report/teacher-token-1",
      status: "draft",
      expectedCount: 30,
      questions: classroom.questions,
    });

    expect(stored).toMatchObject({
      id: "classroom-1",
      startedAt: null,
      endedAt: null,
    });
  });

  it("renders a selectable QR panel with current QR and student links", () => {
    const html = renderToStaticMarkup(<QrPanel classroom={classroom} />);

    expect(html).toContain("Q1");
    expect(html).toContain('data-testid="current-question-qr"');
    expect(html).toContain('data-testid="student-link-Q1"');
    expect(html).toContain("http://school.test/student/token-q1");
  });

  it("renders dashboard controls, stats, and teacher links from stored classroom data", () => {
    const html = renderToStaticMarkup(
      <ClassroomDashboard
        classroomId="classroom-1"
        initialClassroom={classroom}
        initialStats={stats}
      />,
    );

    expect(html).toContain('data-testid="start-classroom-button"');
    expect(html).toContain('data-testid="submitted-count"');
    expect(html).toContain(">8<");
    expect(html).toContain('data-testid="student-link-Q1"');
    expect(html).toContain('data-testid="teacher-report-link"');
    expect(html).toContain("/teacher/classrooms/classroom-1/projector");
    expect(html).toContain("/teacher/report/teacher-token-1");
  });

  it("renders report analytics and the AI report trigger", () => {
    const html = renderToStaticMarkup(
      <AnalysisReport teacherToken="teacher-token-1" initialStats={stats} />,
    );

    expect(html).toContain("学生层级分布");
    expect(html).toContain("知识点掌握");
    expect(html).toContain("题目正确率");
    expect(html).toContain('data-testid="knowledge-point-分数小数互化"');
    expect(html).toContain('data-testid="generate-ai-report-button"');
  });

  it("sends the teacher token when starting a classroom and returns network failures", async () => {
    const fetcher = vi.fn<TeacherFetcher>().mockResolvedValue(
      Response.json({
        id: "classroom-1",
        questionSetId: "set-1",
        status: "active",
        expectedCount: 30,
        startedAt: "2026-06-10T00:00:00.000Z",
        endedAt: null,
      }),
    );

    const result = await requestClassroomStatusUpdate({
      action: "start",
      classroom,
      fetcher,
    });

    expect(result).toMatchObject({
      status: "ok",
      update: {
        id: "classroom-1",
        status: "active",
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/classrooms/classroom-1/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ teacherToken: "teacher-token-1" }),
      }),
    );

    const failed = await requestClassroomStatusUpdate({
      action: "start",
      classroom,
      fetcher: vi.fn<TeacherFetcher>().mockRejectedValue(new Error("offline")),
    });

    expect(failed).toEqual({
      status: "error",
      error: "课堂开始失败，请检查网络后重试",
    });
  });

  it("returns a failed AI report result when report generation fetch rejects", async () => {
    const result = await requestAiReport({
      teacherToken: "teacher-token-1",
      fetcher: vi.fn<TeacherFetcher>().mockRejectedValue(new Error("offline")),
    });

    expect(result).toEqual({
      status: "error",
      error: "AI 报告生成失败，请稍后重试。",
    });
  });

  it("imports questions, creates a classroom, stores it, and navigates to the dashboard", async () => {
    const saveClassroom = vi.fn();
    const navigate = vi.fn();
    const file = new File(["mock"], "questions.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const fetcher = vi
      .fn<TeacherFetcher>()
      .mockResolvedValueOnce(Response.json({ questionSetId: "set-2", questions: [] }))
      .mockResolvedValueOnce(
        Response.json({
          id: "classroom-2",
          questionSetId: "set-2",
          teacherToken: "teacher-token-2",
          teacherUrl: "http://school.test/teacher/report/teacher-token-2",
          status: "draft",
          expectedCount: 31,
          questions: classroom.questions,
        }),
      );

    const result = await importAndCreateClassroom({
      file,
      title: " 分数复习 ",
      expectedCountText: "31",
      fetcher,
      saveClassroom,
      navigate,
    });

    const importBody = fetcher.mock.calls[0][1]?.body;
    const createBody = fetcher.mock.calls[1][1]?.body;

    expect(result).toEqual({ status: "ok" });
    expect(importBody).toBeInstanceOf(FormData);
    expect(JSON.parse(String(createBody))).toEqual({
      questionSetId: "set-2",
      expectedCount: 31,
    });
    expect(saveClassroom).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "classroom-2",
        startedAt: null,
        endedAt: null,
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/teacher/classrooms/classroom-2");
  });
});
