import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import { buildTeacherAnalytics } from "../analytics";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teacherToken: string }> | { teacherToken: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { teacherToken } = await context.params;
  const repos = createRepositories(getDatabase());
  const classroom = repos.classrooms.getByTeacherToken(teacherToken);

  if (!classroom) {
    return Response.json({ error: "教师口令无效" }, { status: 404 });
  }

  return Response.json(buildTeacherAnalytics(repos, classroom));
}
