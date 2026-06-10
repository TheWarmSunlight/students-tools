import type { ClassroomRecord, RepositorySet } from "@/lib/db/repositories";

export async function readTeacherToken(request: Request): Promise<string> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "";
  }

  const teacherToken = (body as { teacherToken?: unknown }).teacherToken;
  return typeof teacherToken === "string" ? teacherToken : "";
}

export function sanitizeClassroom(classroom: ClassroomRecord) {
  return {
    id: classroom.id,
    questionSetId: classroom.questionSetId,
    status: classroom.status,
    expectedCount: classroom.expectedCount,
    startedAt: classroom.startedAt,
    endedAt: classroom.endedAt,
  };
}

export async function authorizeClassroom(
  repos: RepositorySet,
  classroomId: string,
  teacherToken: string,
): Promise<ClassroomRecord | Response> {
  const classroom = await repos.classrooms.get(classroomId);

  if (!classroom) {
    return Response.json({ error: "课堂不存在" }, { status: 404 });
  }

  if (!teacherToken || teacherToken !== classroom.teacherToken) {
    return Response.json({ error: "无权操作该课堂" }, { status: 403 });
  }

  return classroom;
}
