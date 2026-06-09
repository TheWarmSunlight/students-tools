import { getDatabase } from "@/lib/db/client";
import { createRepositories, type ClassroomRecord } from "@/lib/db/repositories";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teacherToken: string }> | { teacherToken: string };
};

type Repositories = ReturnType<typeof createRepositories>;

export async function GET(_request: Request, context: RouteContext) {
  const { teacherToken } = await context.params;
  const repos = createRepositories(getDatabase());
  const classroom = repos.classrooms.getByTeacherToken(teacherToken);

  if (!classroom) {
    return Response.json({ error: "教师口令无效" }, { status: 404 });
  }

  return Response.json(buildAnalytics(repos, classroom));
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
