import { createClassroomService } from "@/lib/classroom/service";
import { getRepositories } from "@/lib/db/runtime";
import { authorizeClassroom, readTeacherToken, sanitizeClassroom } from "../lifecycle";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ classroomId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { classroomId } = await context.params;
  const repos = await getRepositories();
  const authorized = await authorizeClassroom(repos, classroomId, await readTeacherToken(request));

  if (authorized instanceof Response) {
    return authorized;
  }

  const service = createClassroomService(repos);
  const classroom = await service.startClassroom(classroomId);

  if (!classroom) {
    return Response.json({ error: "课堂不存在" }, { status: 404 });
  }

  return Response.json(sanitizeClassroom(classroom));
}
