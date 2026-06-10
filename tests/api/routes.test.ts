import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as importQuestionSet } from "@/app/api/question-sets/import/route";
import { POST as createClassroom } from "@/app/api/classrooms/route";
import { POST as startClassroom } from "@/app/api/classrooms/[classroomId]/start/route";
import { POST as endClassroom } from "@/app/api/classrooms/[classroomId]/end/route";
import { GET as getStudentQuestion } from "@/app/api/student/questions/[token]/route";
import { POST as submitStudentQuestion } from "@/app/api/student/questions/[token]/submit/route";
import { GET as getTeacherStats } from "@/app/api/teacher/[teacherToken]/stats/route";
import { POST as buildTeacherReport } from "@/app/api/teacher/[teacherToken]/report/route";
import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";

const DEFAULT_HEADERS = [
  "题号",
  "题型",
  "题干",
  "小题/空数量",
  "选项A",
  "选项B",
  "标准答案",
  "答案分隔符",
  "判分方式",
  "知识点",
  "是否纳入统计",
  "解析",
];

type JsonObject = Record<string, unknown>;

const originalEnv = {
  appBaseUrl: process.env.APP_BASE_URL,
  databasePath: process.env.DATABASE_PATH,
  zhipuApiKey: process.env.ZHIPU_API_KEY,
};

let tempDir = "";

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "students-tools-api-routes-"));
  process.env.APP_BASE_URL = "http://school.test";
  process.env.DATABASE_PATH = join(tempDir, "api.db");
  process.env.ZHIPU_API_KEY = "";
});

afterAll(() => {
  getDatabase().close();
  restoreEnv("APP_BASE_URL", originalEnv.appBaseUrl);
  restoreEnv("DATABASE_PATH", originalEnv.databasePath);
  restoreEnv("ZHIPU_API_KEY", originalEnv.zhipuApiKey);
  rmSync(tempDir, { recursive: true, force: true });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function workbookFile(rows: Record<string, string | number>[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题目");
  sheet.addRow(DEFAULT_HEADERS);
  for (const row of rows) {
    sheet.addRow(DEFAULT_HEADERS.map((header) => row[header] ?? ""));
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  return new File([arrayBuffer], "questions.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function jsonBody(response: Response): Promise<JsonObject> {
  return (await response.json()) as JsonObject;
}

function jsonPost(url: string, body: JsonObject) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeContext<T extends JsonObject>(params: T) {
  return { params: Promise.resolve(params) };
}

async function importSampleQuestionSet() {
  const form = new FormData();
  form.set("title", "分数课堂");
  form.set(
    "file",
    await workbookFile([
      {
        题号: "Q1",
        题型: "选择",
        题干: "选择 1/2 的等值分数",
        "小题/空数量": 1,
        选项A: "1/3",
        选项B: "2/4",
        标准答案: "B",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数等值",
        是否纳入统计: "是",
        解析: "分子分母同时乘 2。",
      },
      {
        题号: "Q2",
        题型: "填空",
        题干: "1/4 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "3/4",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数凑整",
        是否纳入统计: "是",
      },
    ]),
  );

  const response = await importQuestionSet(
    new Request("http://school.test/api/question-sets/import", {
      method: "POST",
      body: form,
    }),
  );
  const body = await jsonBody(response);
  expect(response.status).toBe(200);
  expect(body.questionSetId).toEqual(expect.any(String));
  return body.questionSetId as string;
}

async function createSampleClassroom() {
  const questionSetId = await importSampleQuestionSet();
  const response = await createClassroom(
    jsonPost("http://school.test/api/classrooms", {
      questionSetId,
      expectedCount: 2,
    }),
  );
  const body = await jsonBody(response);
  expect(response.status).toBe(200);
  expect(body.id).toEqual(expect.any(String));
  expect(body.teacherUrl).toEqual(expect.stringMatching(/^http:\/\/school\.test\/teacher\/report\//));
  expect(body.questions).toEqual([
    {
      questionId: "q-Q1",
      questionNo: "Q1",
      studentUrl: expect.stringMatching(/^http:\/\/school\.test\/student\/.{32}$/),
      qrDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
    },
    {
      questionId: "q-Q2",
      questionNo: "Q2",
      studentUrl: expect.stringMatching(/^http:\/\/school\.test\/student\/.{32}$/),
      qrDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
    },
  ]);

  const questions = body.questions as Array<{ studentUrl: string }>;
  return {
    classroomId: body.id as string,
    teacherToken: String(body.teacherUrl).split("/").at(-1) ?? "",
    firstStudentToken: questions[0].studentUrl.split("/").at(-1) ?? "",
  };
}

async function startSampleClassroom(classroom: { classroomId: string; teacherToken: string }) {
  return startClassroom(
    jsonPost(`http://school.test/api/classrooms/${classroom.classroomId}/start`, {
      teacherToken: classroom.teacherToken,
    }),
    routeContext({ classroomId: classroom.classroomId }),
  );
}

describe("API routes", () => {
  it("rejects import requests without an Excel file", async () => {
    const response = await importQuestionSet(
      new Request("http://school.test/api/question-sets/import", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    expect(await jsonBody(response)).toEqual({ error: "请上传 Excel 文件" });
  });

  it("creates classrooms and returns safe student-facing question data", async () => {
    const classroom = await createSampleClassroom();

    const draftResponse = await getStudentQuestion(
      new Request(`http://school.test/api/student/questions/${classroom.firstStudentToken}`),
      routeContext({ token: classroom.firstStudentToken }),
    );
    const draftBody = await jsonBody(draftResponse);

    expect(draftResponse.status).toBe(200);
    expect(draftBody).toMatchObject({
      questionId: "q-Q1",
      questionNo: "Q1",
      prompt: "选择 1/2 的等值分数",
      type: "choice",
      options: [
        { key: "A", text: "1/3" },
        { key: "B", text: "2/4" },
      ],
      itemCount: 1,
      status: "draft",
    });
    expect(draftBody).not.toHaveProperty("classroomId");
    expect(draftBody).not.toHaveProperty("items");
    expect(draftBody).not.toHaveProperty("explanation");

    const startResponse = await startSampleClassroom(classroom);
    const startBody = await jsonBody(startResponse);
    expect(startResponse.status).toBe(200);
    expect(startBody).toMatchObject({
      id: classroom.classroomId,
      status: "active",
      startedAt: expect.any(String),
      endedAt: null,
    });
    expect(startBody).not.toHaveProperty("teacherToken");

    const activeResponse = await getStudentQuestion(
      new Request(`http://school.test/api/student/questions/${classroom.firstStudentToken}`),
      routeContext({ token: classroom.firstStudentToken }),
    );
    expect(await jsonBody(activeResponse)).toMatchObject({ status: "active" });

    const endResponse = await endClassroom(
      jsonPost(`http://school.test/api/classrooms/${classroom.classroomId}/end`, {
        teacherToken: classroom.teacherToken,
      }),
      routeContext({ classroomId: classroom.classroomId }),
    );
    const endBody = await jsonBody(endResponse);
    expect(endResponse.status).toBe(200);
    expect(endBody).toMatchObject({
      id: classroom.classroomId,
      status: "ended",
      endedAt: expect.any(String),
    });
    expect(endBody).not.toHaveProperty("teacherToken");

    const endedResponse = await getStudentQuestion(
      new Request(`http://school.test/api/student/questions/${classroom.firstStudentToken}`),
      routeContext({ token: classroom.firstStudentToken }),
    );
    expect(await jsonBody(endedResponse)).toMatchObject({ status: "ended" });
  });

  it("uses request origin for classroom links when app base url is not configured", async () => {
    const previousBaseUrl = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;

    try {
      const questionSetId = await importSampleQuestionSet();
      const response = await createClassroom(
        jsonPost("http://192.168.31.6:3000/api/classrooms", {
          questionSetId,
          expectedCount: 2,
        }),
      );
      const body = await jsonBody(response);

      expect(response.status).toBe(200);
      expect(body.teacherUrl).toEqual(
        expect.stringMatching(/^http:\/\/192\.168\.31\.6:3000\/teacher\/report\//),
      );
      expect(body.questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            studentUrl: expect.stringMatching(/^http:\/\/192\.168\.31\.6:3000\/student\//),
          }),
        ]),
      );
    } finally {
      restoreEnv("APP_BASE_URL", previousBaseUrl);
    }
  });

  it("requires matching teacher tokens for classroom start and end routes", async () => {
    const classroom = await createSampleClassroom();

    const missingStartResponse = await startClassroom(
      jsonPost(`http://school.test/api/classrooms/${classroom.classroomId}/start`, {}),
      routeContext({ classroomId: classroom.classroomId }),
    );
    expect(missingStartResponse.status).toBe(403);

    const mismatchedStartResponse = await startClassroom(
      jsonPost(`http://school.test/api/classrooms/${classroom.classroomId}/start`, {
        teacherToken: "wrong-token",
      }),
      routeContext({ classroomId: classroom.classroomId }),
    );
    expect(mismatchedStartResponse.status).toBe(403);

    const draftResponse = await getStudentQuestion(
      new Request(`http://school.test/api/student/questions/${classroom.firstStudentToken}`),
      routeContext({ token: classroom.firstStudentToken }),
    );
    expect(await jsonBody(draftResponse)).toMatchObject({ status: "draft" });

    const validStartResponse = await startSampleClassroom(classroom);
    expect(validStartResponse.status).toBe(200);

    const mismatchedEndResponse = await endClassroom(
      jsonPost(`http://school.test/api/classrooms/${classroom.classroomId}/end`, {
        teacherToken: "wrong-token",
      }),
      routeContext({ classroomId: classroom.classroomId }),
    );
    expect(mismatchedEndResponse.status).toBe(403);

    const activeResponse = await getStudentQuestion(
      new Request(`http://school.test/api/student/questions/${classroom.firstStudentToken}`),
      routeContext({ token: classroom.firstStudentToken }),
    );
    expect(await jsonBody(activeResponse)).toMatchObject({ status: "active" });
  });

  it("returns 404 for classroom creation when the question set has no questions", async () => {
    const repos = createRepositories(getDatabase());
    const questionSetId = repos.questionSets.create("空题集", []);

    const response = await createClassroom(
      jsonPost("http://school.test/api/classrooms", {
        questionSetId,
        expectedCount: 2,
      }),
    );

    expect(response.status).toBe(404);
    expect(await jsonBody(response)).toEqual({ error: "题目集不存在或没有题目" });
  });

  it("rejects submissions unless the classroom is active", async () => {
    const classroom = await createSampleClassroom();

    const response = await submitStudentQuestion(
      jsonPost(`http://school.test/api/student/questions/${classroom.firstStudentToken}/submit`, {
        name: "小明",
        seatNo: "01",
        answers: ["B"],
      }),
      routeContext({ token: classroom.firstStudentToken }),
    );

    expect(response.status).toBe(409);
    expect(await jsonBody(response)).toEqual({ error: "课堂未开始或已结束" });
  });

  it("upserts students, grades active submissions, and preserves latest answers", async () => {
    const classroom = await createSampleClassroom();
    await startSampleClassroom(classroom);

    const wrongAnswerCountResponse = await submitStudentQuestion(
      jsonPost(`http://school.test/api/student/questions/${classroom.firstStudentToken}/submit`, {
        name: "小明",
        seatNo: "01",
        answers: ["A", "B"],
      }),
      routeContext({ token: classroom.firstStudentToken }),
    );
    expect(wrongAnswerCountResponse.status).toBe(400);

    const firstResponse = await submitStudentQuestion(
      jsonPost(`http://school.test/api/student/questions/${classroom.firstStudentToken}/submit`, {
        name: "小明",
        seatNo: "01",
        answers: [" A "],
      }),
      routeContext({ token: classroom.firstStudentToken }),
    );
    const firstBody = await jsonBody(firstResponse);
    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({
      questionId: "q-Q1",
      allCorrect: false,
      submitCount: 1,
      submittedAt: expect.any(String),
    });
    expect(firstBody).not.toHaveProperty("answers");
    expect(firstBody).not.toHaveProperty("studentId");
    expect(firstBody).not.toHaveProperty("classroomId");

    const secondResponse = await submitStudentQuestion(
      jsonPost(`http://school.test/api/student/questions/${classroom.firstStudentToken}/submit`, {
        name: "小明同学",
        seatNo: "01",
        answers: [" B "],
      }),
      routeContext({ token: classroom.firstStudentToken }),
    );
    const secondBody = await jsonBody(secondResponse);

    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({
      questionId: "q-Q1",
      gradedItems: [{ index: 0, correct: true }],
      allCorrect: true,
      submitCount: 2,
      submittedAt: expect.any(String),
    });
    expect(secondBody).not.toHaveProperty("answers");
    expect(secondBody).not.toHaveProperty("studentId");
    expect(secondBody).not.toHaveProperty("classroomId");
  });

  it("returns teacher analytics and skips AI report generation without an API key", async () => {
    const classroom = await createSampleClassroom();
    await startSampleClassroom(classroom);
    await submitStudentQuestion(
      jsonPost(`http://school.test/api/student/questions/${classroom.firstStudentToken}/submit`, {
        name: "小明",
        seatNo: "01",
        answers: ["B"],
      }),
      routeContext({ token: classroom.firstStudentToken }),
    );

    const statsResponse = await getTeacherStats(
      new Request(`http://school.test/api/teacher/${classroom.teacherToken}/stats`),
      routeContext({ teacherToken: classroom.teacherToken }),
    );
    const statsBody = await jsonBody(statsResponse);
    expect(statsResponse.status).toBe(200);
    expect(statsBody).toMatchObject({
      expectedCount: 2,
      studentCount: 1,
      submittedStudentCount: 1,
      submitRate: 0.5,
      averageAccuracy: 1,
    });

    const reportResponse = await buildTeacherReport(
      jsonPost(`http://school.test/api/teacher/${classroom.teacherToken}/report`, {}),
      routeContext({ teacherToken: classroom.teacherToken }),
    );
    const reportBody = await jsonBody(reportResponse);

    expect(reportResponse.status).toBe(200);
    expect(reportBody).toMatchObject({
      summary: statsBody,
      aiText: "",
      aiStatus: "skipped",
    });
  });

  it("returns 404 for invalid teacher tokens on stats and report routes", async () => {
    const statsResponse = await getTeacherStats(
      new Request("http://school.test/api/teacher/not-a-token/stats"),
      routeContext({ teacherToken: "not-a-token" }),
    );
    expect(statsResponse.status).toBe(404);

    const reportResponse = await buildTeacherReport(
      jsonPost("http://school.test/api/teacher/not-a-token/report", {}),
      routeContext({ teacherToken: "not-a-token" }),
    );
    expect(reportResponse.status).toBe(404);
  });
});
