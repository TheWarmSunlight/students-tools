import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClassroomService } from "@/lib/classroom/service";
import { openDatabase, type AppDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import type { Question } from "@/lib/domain/types";

const BASE_URL = "http://localhost:3000";

let tempDir = "";
let db: AppDatabase | null = null;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "students-tools-classroom-service-"));
});

afterEach(() => {
  db?.close();
  db = null;
  rmSync(tempDir, { recursive: true, force: true });
});

function openTestRepositories() {
  db = openDatabase(join(tempDir, "test.db"));
  return createRepositories(db);
}

function sampleQuestions(): Question[] {
  return [
    {
      id: "q-choice",
      questionNo: "Q1",
      type: "choice",
      prompt: "Which expression shows multiplication commutativity?",
      itemCount: 1,
      options: [
        { key: "A", text: "a+b=b+a" },
        { key: "B", text: "a*b=b*a" },
      ],
      items: [{ index: 0, answer: "B", gradingMode: "text" }],
      knowledgePoints: ["multiplication commutativity"],
      difficulty: "基础",
      includeInStats: true,
      explanation: "Swapping factors does not change the product.",
    },
    {
      id: "q-fill",
      questionNo: "Q2",
      type: "blank",
      prompt: "Fill in the missing factor.",
      itemCount: 1,
      options: [],
      items: [{ index: 0, answer: "6", gradingMode: "text" }],
      knowledgePoints: ["multiplication"],
      difficulty: "基础",
      includeInStats: true,
      explanation: "",
    },
  ];
}

describe("classroom service", () => {
  it("creates a draft classroom with teacher and per-question student QR links", async () => {
    const repos = openTestRepositories();
    const questionSetId = repos.questionSets.create("Operations", sampleQuestions());
    const service = createClassroomService(repos, BASE_URL);

    const classroom = await service.createClassroom(questionSetId, 40);

    expect(classroom).toMatchObject({
      id: expect.any(String),
      questionSetId,
      status: "draft",
      expectedCount: 40,
      teacherToken: expect.any(String),
      teacherUrl: `${BASE_URL}/teacher/report/${classroom.teacherToken}`,
    });
    expect(classroom.questions).toHaveLength(2);
    expect(classroom.questions).toEqual([
      {
        questionId: "q-choice",
        questionNo: "Q1",
        studentUrl: expect.stringMatching(/^http:\/\/localhost:3000\/student\/.{32}$/),
        qrDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      },
      {
        questionId: "q-fill",
        questionNo: "Q2",
        studentUrl: expect.stringMatching(/^http:\/\/localhost:3000\/student\/.{32}$/),
        qrDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      },
    ]);

    for (const questionLink of classroom.questions) {
      expect(questionLink.studentUrl).not.toContain(classroom.teacherToken);
      const token = questionLink.studentUrl.split("/").at(-1);
      expect(token).toBeDefined();
      expect(repos.questionTokens.get(token ?? "")).toEqual({
        token,
        classroomId: classroom.id,
        questionId: questionLink.questionId,
      });
    }
  });

  it("normalizes a base URL with a trailing slash", async () => {
    const repos = openTestRepositories();
    const questionSetId = repos.questionSets.create("Operations", [sampleQuestions()[0]]);
    const service = createClassroomService(repos, "http://localhost:3000/");

    const classroom = await service.createClassroom(questionSetId, 40);

    expect(classroom.teacherUrl).toBe(
      `http://localhost:3000/teacher/report/${classroom.teacherToken}`,
    );
    expect(classroom.teacherUrl).not.toContain("3000//teacher");
    expect(classroom.questions[0].studentUrl).toMatch(/^http:\/\/localhost:3000\/student\/.{32}$/);
    expect(classroom.questions[0].studentUrl).not.toContain("3000//student");
  });

  it("keeps teacher and student tokens isolated", async () => {
    const repos = openTestRepositories();
    const questionSetId = repos.questionSets.create("Operations", [sampleQuestions()[0]]);
    const service = createClassroomService(repos, BASE_URL);

    const classroom = await service.createClassroom(questionSetId, 40);
    const studentToken = classroom.questions[0].studentUrl.split("/").at(-1) ?? "";

    expect(studentToken).not.toBe(classroom.teacherToken);
    expect(classroom.questions[0].studentUrl).not.toContain(classroom.teacherToken);
    expect(repos.questionTokens.get(classroom.teacherToken)).toBeNull();
    expect(service.resolveQuestionToken(classroom.teacherToken)).toBeNull();
    expect(service.resolveQuestionToken(studentToken)).toEqual({
      token: studentToken,
      classroomId: classroom.id,
      questionId: "q-choice",
    });
  });

  it("starts and ends classrooms with timestamps", async () => {
    const repos = openTestRepositories();
    const questionSetId = repos.questionSets.create("Operations", [sampleQuestions()[0]]);
    const service = createClassroomService(repos, BASE_URL);
    const classroom = await service.createClassroom(questionSetId, 40);

    const activeClassroom = service.startClassroom(classroom.id);

    expect(activeClassroom).toMatchObject({
      id: classroom.id,
      status: "active",
      startedAt: expect.any(String),
      endedAt: null,
    });

    const endedClassroom = service.endClassroom(classroom.id);

    expect(endedClassroom).toMatchObject({
      id: classroom.id,
      status: "ended",
      startedAt: activeClassroom?.startedAt,
      endedAt: expect.any(String),
    });
  });

  it("allows creating a classroom for a question set without questions", async () => {
    const repos = openTestRepositories();
    const questionSetId = repos.questionSets.create("Empty set", []);
    const service = createClassroomService(repos, BASE_URL);

    const classroom = await service.createClassroom(questionSetId, 5);

    expect(classroom).toMatchObject({
      id: expect.any(String),
      questionSetId,
      status: "draft",
      expectedCount: 5,
      teacherToken: expect.any(String),
      teacherUrl: `${BASE_URL}/teacher/report/${classroom.teacherToken}`,
      questions: [],
    });
  });
});
