import { createClassroomService } from "@/lib/classroom/service";
import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ classroomId: string }> | { classroomId: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const { classroomId } = await context.params;
  const repos = createRepositories(getDatabase());
  const service = createClassroomService(repos);
  const classroom = service.endClassroom(classroomId);

  if (!classroom) {
    return Response.json({ error: "课堂不存在" }, { status: 404 });
  }

  return Response.json(classroom);
}
