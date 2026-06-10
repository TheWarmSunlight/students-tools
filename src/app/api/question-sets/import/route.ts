import { getRepositories } from "@/lib/db/runtime";
import { importQuestionsFromWorkbook } from "@/lib/excel/importer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return Response.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }

  const titleValue = formData.get("title");
  const title =
    typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : "课堂题目";
  const buffer = Buffer.from(await file.arrayBuffer());
  const imported = await importQuestionsFromWorkbook(buffer);

  if (imported.errors.length > 0) {
    return Response.json(imported, { status: 400 });
  }

  const repos = await getRepositories();
  const questionSetId = await repos.questionSets.create(title, imported.questions);

  return Response.json({ questionSetId, questions: imported.questions });
}
