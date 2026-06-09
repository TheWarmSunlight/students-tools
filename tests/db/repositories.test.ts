import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import type { GradedItem, Question } from "@/lib/domain/types";

let tempDir = "";
let db: AppDatabase | null = null;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "students-tools-db-"));
});

afterEach(() => {
  db?.close();
  db = null;
  rmSync(tempDir, { recursive: true, force: true });
});

function openTestDatabase(fileName = "test.db") {
  db = openDatabase(join(tempDir, fileName));
  return db;
}

function sampleQuestions(): Question[] {
  return [
    {
      id: "q-choice",
      questionNo: "Q1",
      type: "choice",
      prompt: "哪个算式表示乘法交换律？",
      itemCount: 1,
      options: [
        { key: "A", text: "a+b=b+a" },
        { key: "B", text: "a*b=b*a" },
      ],
      items: [{ index: 0, answer: "B", gradingMode: "text" }],
      knowledgePoints: ["乘法交换律"],
      difficulty: "基础",
      includeInStats: true,
      explanation: "交换两个因数的位置，积不变。",
    },
    {
      id: "q-matching",
      questionNo: "Q2",
      type: "matching",
      prompt: "把算律和例子配对。",
      itemCount: 2,
      options: [],
      items: [
        { index: 0, answer: "①-b", gradingMode: "matching" },
        { index: 1, answer: "②-a", gradingMode: "matching" },
      ],
      knowledgePoints: ["乘法分配律", "乘法结合律"],
      difficulty: "提高",
      includeInStats: false,
      explanation: "",
    },
  ];
}

function setupQuestionSet() {
  const repos = createRepositories(openTestDatabase());
  const questionSetId = repos.questionSets.create("运算律课堂", sampleQuestions());
  return { repos, questionSetId };
}

describe("database client", () => {
  it("opens a temporary SQLite database and creates the schema", () => {
    const nestedPath = join(tempDir, "nested", "learning.db");

    db = openDatabase(nestedPath);
    const rows = db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all();

    expect(existsSync(nestedPath)).toBe(true);
    expect(rows.map((row) => row.name)).toEqual([
      "classrooms",
      "question_sets",
      "question_tokens",
      "questions",
      "reports",
      "students",
      "submissions",
    ]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });
});

describe("repositories", () => {
  it("persists question sets and restores full question JSON fields", () => {
    const { repos, questionSetId } = setupQuestionSet();

    const restored = repos.questionSets.listQuestions(questionSetId);

    expect(restored).toEqual(sampleQuestions());
  });

  it("creates classrooms with teacher tokens and maps status timestamps to camelCase", () => {
    const { repos, questionSetId } = setupQuestionSet();

    const classroom = repos.classrooms.create(questionSetId, 45);

    expect(classroom).toEqual({
      id: expect.any(String),
      teacherToken: expect.any(String),
      questionSetId,
      status: "draft",
      expectedCount: 45,
    });
    expect(classroom.teacherToken).toHaveLength(32);
    expect(classroom.teacherToken).not.toBe(classroom.id);
    expect(classroom.teacherToken).not.toBe(questionSetId);

    repos.classrooms.setStatus(classroom.id, "active");
    const activeClassroom = repos.classrooms.get(classroom.id);
    expect(activeClassroom).toMatchObject({
      id: classroom.id,
      questionSetId,
      status: "active",
      expectedCount: 45,
      teacherToken: classroom.teacherToken,
      startedAt: expect.any(String),
      endedAt: null,
    });
    expect(repos.classrooms.getByTeacherToken(classroom.teacherToken)).toEqual(activeClassroom);

    repos.classrooms.setStatus(classroom.id, "ended");
    const endedClassroom = repos.classrooms.get(classroom.id);
    expect(endedClassroom).toMatchObject({
      id: classroom.id,
      status: "ended",
      startedAt: activeClassroom?.startedAt,
      endedAt: expect.any(String),
    });
  });

  it("creates and reads question tokens as camelCase objects", () => {
    const { repos, questionSetId } = setupQuestionSet();
    const classroom = repos.classrooms.create(questionSetId, 40);

    const token = repos.questionTokens.create(classroom.id, "q-choice");

    expect(token).toHaveLength(32);
    expect(repos.questionTokens.get(token)).toEqual({
      token,
      classroomId: classroom.id,
      questionId: "q-choice",
    });
  });

  it("upserts students by classroom and seat number and lists them by seat number", () => {
    const { repos, questionSetId } = setupQuestionSet();
    const classroom = repos.classrooms.create(questionSetId, 40);

    const secondSeatId = repos.students.upsert(classroom.id, { seatNo: "02", name: "小明" });
    const firstSeatId = repos.students.upsert(classroom.id, { seatNo: "01", name: "小红" });
    const updatedSecondSeatId = repos.students.upsert(classroom.id, {
      seatNo: "02",
      name: "小明同学",
    });

    expect(updatedSecondSeatId).toBe(secondSeatId);
    expect(repos.students.listByClassroom(classroom.id)).toEqual([
      {
        id: firstSeatId,
        classroomId: classroom.id,
        seatNo: "01",
        name: "小红",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      {
        id: secondSeatId,
        classroomId: classroom.id,
        seatNo: "02",
        name: "小明同学",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("saves submissions with parsed JSON, boolean values, and incrementing submit count", () => {
    const { repos, questionSetId } = setupQuestionSet();
    const classroom = repos.classrooms.create(questionSetId, 40);
    const studentId = repos.students.upsert(classroom.id, { seatNo: "01", name: "小明" });
    const firstGradedItems: GradedItem[] = [
      { index: 0, correct: false, reason: "答案不匹配" },
    ];
    const secondGradedItems: GradedItem[] = [{ index: 0, correct: true }];

    repos.submissions.save({
      classroomId: classroom.id,
      questionId: "q-choice",
      studentId,
      answers: ["A"],
      gradedItems: firstGradedItems,
      allCorrect: false,
    });

    expect(repos.submissions.listByClassroom(classroom.id)).toEqual([
      {
        id: expect.any(String),
        classroomId: classroom.id,
        questionId: "q-choice",
        studentId,
        answers: ["A"],
        gradedItems: firstGradedItems,
        allCorrect: false,
        submitCount: 1,
        submittedAt: expect.any(String),
      },
    ]);

    repos.submissions.save({
      classroomId: classroom.id,
      questionId: "q-choice",
      studentId,
      answers: ["B"],
      gradedItems: secondGradedItems,
      allCorrect: true,
    });

    const submissions = repos.submissions.listByClassroom(classroom.id);
    expect(submissions).toEqual([
      {
        id: expect.any(String),
        classroomId: classroom.id,
        questionId: "q-choice",
        studentId,
        answers: ["B"],
        gradedItems: secondGradedItems,
        allCorrect: true,
        submitCount: 2,
        submittedAt: expect.any(String),
      },
    ]);
    expect(typeof submissions[0].allCorrect).toBe("boolean");
    expect(typeof submissions[0].gradedItems[0].correct).toBe("boolean");
  });

  it("persists the happy path across database instances", () => {
    const databasePath = join(tempDir, "persistent.db");
    db = openDatabase(databasePath);
    let repos = createRepositories(db);
    const questionSetId = repos.questionSets.create("基础运算", sampleQuestions());
    const classroom = repos.classrooms.create(questionSetId, 2);
    const token = repos.questionTokens.create(classroom.id, "q-choice");
    const studentId = repos.students.upsert(classroom.id, { seatNo: "01", name: "小明" });
    repos.submissions.save({
      classroomId: classroom.id,
      questionId: "q-choice",
      studentId,
      answers: ["B"],
      gradedItems: [{ index: 0, correct: true }],
      allCorrect: true,
    });
    db.close();

    db = openDatabase(databasePath);
    repos = createRepositories(db);

    expect(repos.questionSets.listQuestions(questionSetId)).toEqual(sampleQuestions());
    expect(repos.classrooms.getByTeacherToken(classroom.teacherToken)).toMatchObject({
      id: classroom.id,
      expectedCount: 2,
    });
    expect(repos.questionTokens.get(token)).toEqual({
      token,
      classroomId: classroom.id,
      questionId: "q-choice",
    });
    expect(repos.students.listByClassroom(classroom.id)).toHaveLength(1);
    expect(repos.submissions.listByClassroom(classroom.id)).toHaveLength(1);
  });
});
