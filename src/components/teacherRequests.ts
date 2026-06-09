import type { ClassroomAnalytics } from "@/lib/stats/analytics";
import {
  isClassroomStatusUpdate,
  toStoredClassroom,
  type ClassroomStatusUpdate,
  type StoredClassroom,
} from "@/components/teacherClassroom";

export type TeacherFetcher = (input: string, init?: RequestInit) => Promise<Response>;

type ImportResponse = {
  questionSetId: string;
};

type ReportBody = {
  summary: ClassroomAnalytics;
  aiText: string;
  aiStatus: "generated" | "skipped" | "failed";
};

type RequestError = {
  status: "error";
  error: string;
};

export type TeacherStatsResult =
  | { status: "ok"; stats: ClassroomAnalytics }
  | RequestError;

export type ClassroomStatusResult =
  | { status: "ok"; update: ClassroomStatusUpdate }
  | RequestError;

export type AiReportResult = { status: "ok"; report: ReportBody } | RequestError;

export type ImportClassroomResult = { status: "ok" } | RequestError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isImportResponse(value: unknown): value is ImportResponse {
  return isRecord(value) && typeof value.questionSetId === "string";
}

function isReportBody(value: unknown): value is ReportBody {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.summary) &&
    typeof value.aiText === "string" &&
    typeof value.aiStatus === "string" &&
    ["generated", "skipped", "failed"].includes(value.aiStatus)
  );
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function statusError(action: "start" | "end") {
  return action === "start"
    ? "课堂开始失败，请检查网络后重试"
    : "课堂结束失败，请检查网络后重试";
}

export function parseExpectedCount(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function requestTeacherStats({
  teacherToken,
  fetcher = fetch,
  errorMessage = "学情数据读取失败",
}: {
  teacherToken: string;
  fetcher?: TeacherFetcher;
  errorMessage?: string;
}): Promise<TeacherStatsResult> {
  try {
    const response = await fetcher(`/api/teacher/${teacherToken}/stats`, { cache: "no-store" });
    const body = await readJson(response);

    if (!response.ok) {
      return { status: "error", error: errorMessage };
    }

    return { status: "ok", stats: body as ClassroomAnalytics };
  } catch {
    return { status: "error", error: errorMessage };
  }
}

export async function requestClassroomStatusUpdate({
  action,
  classroom,
  fetcher = fetch,
}: {
  action: "start" | "end";
  classroom: StoredClassroom;
  fetcher?: TeacherFetcher;
}): Promise<ClassroomStatusResult> {
  try {
    const response = await fetcher(`/api/classrooms/${classroom.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherToken: classroom.teacherToken }),
    });
    const body = await readJson(response);

    if (!response.ok || !isClassroomStatusUpdate(body)) {
      return { status: "error", error: statusError(action) };
    }

    return { status: "ok", update: body };
  } catch {
    return { status: "error", error: statusError(action) };
  }
}

export async function requestAiReport({
  teacherToken,
  fetcher = fetch,
}: {
  teacherToken: string;
  fetcher?: TeacherFetcher;
}): Promise<AiReportResult> {
  try {
    const response = await fetcher(`/api/teacher/${teacherToken}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await readJson(response);

    if (!response.ok || !isReportBody(body)) {
      return { status: "error", error: "AI 报告生成失败，请稍后重试。" };
    }

    return { status: "ok", report: body };
  } catch {
    return { status: "error", error: "AI 报告生成失败，请稍后重试。" };
  }
}

export async function importAndCreateClassroom({
  file,
  title,
  expectedCountText,
  fetcher = fetch,
  saveClassroom,
  navigate,
}: {
  file: File | null;
  title: string;
  expectedCountText: string;
  fetcher?: TeacherFetcher;
  saveClassroom: (classroom: StoredClassroom) => void;
  navigate: (path: string) => void;
}): Promise<ImportClassroomResult> {
  if (!file) {
    return { status: "error", error: "请先选择 Excel 文件" };
  }

  const expectedCount = parseExpectedCount(expectedCountText);
  if (!expectedCount) {
    return { status: "error", error: "预计人数必须大于 0" };
  }

  try {
    const form = new FormData();
    form.set("file", file);

    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      form.set("title", trimmedTitle);
    }

    const importResponse = await fetcher("/api/question-sets/import", {
      method: "POST",
      body: form,
    });
    const importBody = await readJson(importResponse);

    if (!importResponse.ok || !isImportResponse(importBody)) {
      return { status: "error", error: readError(importBody, "题目导入失败") };
    }

    const classroomResponse = await fetcher("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionSetId: importBody.questionSetId,
        expectedCount,
      }),
    });
    const classroomBody = await readJson(classroomResponse);
    const classroom = toStoredClassroom(classroomBody);

    if (!classroomResponse.ok || !classroom) {
      return { status: "error", error: readError(classroomBody, "课堂创建失败") };
    }

    saveClassroom(classroom);
    navigate(`/teacher/classrooms/${classroom.id}`);
    return { status: "ok" };
  } catch (caught) {
    return {
      status: "error",
      error: caught instanceof Error ? caught.message : "导入失败",
    };
  }
}
