import { generateZhipuReport, readZhipuConfigFromEnv } from "@/lib/ai/zhipu";
import { getDatabase } from "@/lib/db/client";
import { createRepositories, type ClassroomRecord } from "@/lib/db/repositories";
import { buildReportMessages } from "@/lib/reports/prompt";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teacherToken: string }> | { teacherToken: string };
};

type Repositories = ReturnType<typeof createRepositories>;

export async function POST(_request: Request, context: RouteContext) {
  const { teacherToken } = await context.params;
  const repos = createRepositories(getDatabase());
  const classroom = repos.classrooms.getByTeacherToken(teacherToken);

  if (!classroom) {
    return Response.json({ error: "教师口令无效" }, { status: 404 });
  }

  const summary = buildAnalytics(repos, classroom);
  const config = readZhipuConfigFromEnv();

  if (!config.apiKey) {
    return Response.json({ summary, aiText: "", aiStatus: "skipped" });
  }

  try {
    const aiText = await generateZhipuReport({
      ...config,
      messages: buildReportMessages(summary),
    });
    return Response.json({ summary, aiText, aiStatus: "generated" });
  } catch {
    return Response.json({ summary, aiText: "", aiStatus: "failed" });
  }
}

function buildAnalytics(repos: Repositories, classroom: ClassroomRecord) {
  return buildClassroomAnalytics({
    expectedCount: classroom.expectedCount,
    questions: repos.questionSets.listQuestions(classroom.questionSetId),
    students: repos.students.listByClassroom(classroom.id).map((student) => ({
      id: student.id,
      seatNo: student.seatNo,
      name: student.name,
    })),
    submissions: repos.submissions.listByClassroom(classroom.id).map((submission) => ({
      questionId: submission.questionId,
      studentId: submission.studentId,
      gradedItems: submission.gradedItems,
      allCorrect: submission.allCorrect,
    })),
  });
}
