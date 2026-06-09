import { createClassroomService } from "@/lib/classroom/service";
import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";

export const runtime = "nodejs";

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return recordFrom(body);
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const questionSetId = typeof body?.questionSetId === "string" ? body.questionSetId.trim() : "";
  const expectedCount = body?.expectedCount;

  if (!questionSetId || !Number.isInteger(expectedCount) || Number(expectedCount) <= 0) {
    return Response.json({ error: "请求参数无效" }, { status: 400 });
  }

  const repos = createRepositories(getDatabase());
  const service = createClassroomService(repos);

  try {
    const classroom = await service.createClassroom(questionSetId, Number(expectedCount));
    return Response.json(classroom);
  } catch {
    return Response.json({ error: "题目集不存在" }, { status: 404 });
  }
}
