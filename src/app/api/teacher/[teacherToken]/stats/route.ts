import { getRepositories } from "@/lib/db/runtime";
import { buildTeacherAnalytics } from "../analytics";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teacherToken: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { teacherToken } = await context.params;
  const repos = await getRepositories();
  const classroom = await repos.classrooms.getByTeacherToken(teacherToken);

  if (!classroom) {
    return Response.json({ error: "教师口令无效" }, { status: 404 });
  }

  return Response.json(await buildTeacherAnalytics(repos, classroom));
}
