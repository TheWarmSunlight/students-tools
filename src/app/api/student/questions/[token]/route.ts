import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const repos = createRepositories(getDatabase());
  const questionToken = repos.questionTokens.get(token);

  if (!questionToken) {
    return Response.json({ error: "题目不存在" }, { status: 404 });
  }

  const classroom = repos.classrooms.get(questionToken.classroomId);
  if (!classroom) {
    return Response.json({ error: "课堂不存在" }, { status: 404 });
  }

  const question = repos
    .questionSets
    .listQuestions(classroom.questionSetId)
    .find((candidate) => candidate.id === questionToken.questionId);

  if (!question) {
    return Response.json({ error: "题目不存在" }, { status: 404 });
  }

  return Response.json({
    classroomId: classroom.id,
    questionId: question.id,
    questionNo: question.questionNo,
    prompt: question.prompt,
    type: question.type,
    options: question.options,
    itemCount: question.itemCount,
    status: classroom.status,
  });
}
