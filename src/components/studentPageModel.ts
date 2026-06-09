import { createEmptyAnswers, type StudentQuestion } from "@/components/QuestionRenderer";

export type StudentIdentity = {
  name: string;
  seatNo: string;
};

export type SubmitResult = {
  questionId: string;
  allCorrect: boolean;
  gradedItems: Array<{ index: number; correct: boolean; reason?: string }>;
  submitCount: number;
  submittedAt: string;
};

export type StudentStorage = Pick<Storage, "getItem" | "setItem">;
export type StudentFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type StudentSubmitAnswersResult =
  | { status: "ok"; submission: SubmitResult }
  | { status: "error"; error: string };

export type LoadedQuestionState = {
  question: StudentQuestion;
  answers: string[];
  submitResult: null;
};

export const STUDENT_IDENTITY_KEY = "studentIdentity";
export const emptyStudentIdentity: StudentIdentity = { name: "", seatNo: "" };

function emptyIdentity(): StudentIdentity {
  return { ...emptyStudentIdentity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function getBrowserStudentStorage(): StudentStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStudentIdentity(storage: StudentStorage | null = getBrowserStudentStorage()): StudentIdentity {
  if (!storage) {
    return emptyIdentity();
  }

  try {
    const raw = storage.getItem(STUDENT_IDENTITY_KEY);
    if (!raw) {
      return emptyIdentity();
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      typeof parsed.name === "string" &&
      typeof parsed.seatNo === "string"
    ) {
      return { name: parsed.name, seatNo: parsed.seatNo };
    }
  } catch {
    return emptyIdentity();
  }

  return emptyIdentity();
}

export function saveStudentIdentity(
  storage: StudentStorage | null,
  identity: StudentIdentity,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    return;
  }
}

export async function submitStudentAnswers({
  token,
  identity,
  answers,
  fetcher = fetch,
}: {
  token: string;
  identity: StudentIdentity;
  answers: string[];
  fetcher?: StudentFetcher;
}): Promise<StudentSubmitAnswersResult> {
  try {
    const response = await fetcher(`/api/student/questions/${encodeURIComponent(token)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: identity.name,
        seatNo: identity.seatNo,
        answers,
      }),
    });
    const body = await readJson(response);

    if (!response.ok) {
      return { status: "error", error: readError(body, "提交失败，请稍后重试") };
    }

    return { status: "ok", submission: body as SubmitResult };
  } catch {
    return { status: "error", error: "提交失败，请稍后重试" };
  }
}

export function createLoadedQuestionState(question: StudentQuestion): LoadedQuestionState {
  return {
    question,
    answers: createEmptyAnswers(question.itemCount),
    submitResult: null,
  };
}
