import { getRepositories } from "@/lib/db/runtime";
import { gradeSubmission } from "@/lib/grading/grader";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return recordFrom(body);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const body = await readJsonObject(request);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const seatNo = typeof body?.seatNo === "string" ? body.seatNo.trim() : "";
  const answers = body?.answers;

  if (!name || !seatNo || !Array.isArray(answers) || !answers.every(isString)) {
    return Response.json({ error: "请求参数无效" }, { status: 400 });
  }

  const repos = await getRepositories();
  const questionToken = await repos.questionTokens.get(token);

  if (!questionToken) {
    return Response.json({ error: "题目不存在" }, { status: 404 });
  }

  const classroom = await repos.classrooms.get(questionToken.classroomId);
  if (!classroom) {
    return Response.json({ error: "课堂不存在" }, { status: 404 });
  }

  if (classroom.status !== "active") {
    return Response.json({ error: "课堂未开始或已结束" }, { status: 409 });
  }

  const question = (await repos.questionSets.listQuestions(classroom.questionSetId)).find(
    (candidate) => candidate.id === questionToken.questionId,
  );

  if (!question) {
    return Response.json({ error: "题目不存在" }, { status: 404 });
  }

  if (answers.length !== question.itemCount) {
    return Response.json({ error: "请求参数无效" }, { status: 400 });
  }

  const trimmedAnswers = answers.map((answer) => answer.trim());
  const student = { seatNo, name };
  const studentId = await repos.students.upsert(classroom.id, student);
  const graded = gradeSubmission(question, trimmedAnswers, student);
  const submission = await repos.submissions.save({
    classroomId: classroom.id,
    questionId: question.id,
    studentId,
    answers: trimmedAnswers,
    gradedItems: graded.items,
    allCorrect: graded.allCorrect,
  });

  return Response.json({
    questionId: submission.questionId,
    allCorrect: submission.allCorrect,
    gradedItems: submission.gradedItems,
    submitCount: submission.submitCount,
    submittedAt: submission.submittedAt,
  });
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
