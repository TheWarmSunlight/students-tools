import { generateZhipuReport, readZhipuConfigFromEnv } from "@/lib/ai/zhipu";
import { getRepositories } from "@/lib/db/runtime";
import { buildReportMessages } from "@/lib/reports/prompt";
import { buildTeacherAnalytics } from "../analytics";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teacherToken: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { teacherToken } = await context.params;
  const repos = await getRepositories();
  const classroom = await repos.classrooms.getByTeacherToken(teacherToken);

  if (!classroom) {
    return Response.json({ error: "教师口令无效" }, { status: 404 });
  }

  const summary = await buildTeacherAnalytics(repos, classroom);
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
