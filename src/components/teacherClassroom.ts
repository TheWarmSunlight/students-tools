import type { ClassroomStatus } from "@/lib/domain/types";

export type ClassroomQuestionLink = {
  questionId: string;
  questionNo: string;
  studentUrl: string;
  qrDataUrl: string;
};

export type StoredClassroom = {
  id: string;
  questionSetId: string;
  teacherToken: string;
  teacherUrl: string;
  status: ClassroomStatus;
  expectedCount: number;
  startedAt: string | null;
  endedAt: string | null;
  questions: ClassroomQuestionLink[];
};

export type ClassroomStatusUpdate = Pick<
  StoredClassroom,
  "id" | "questionSetId" | "status" | "expectedCount" | "startedAt" | "endedAt"
>;

const CLASSROOM_STATUSES: ClassroomStatus[] = ["draft", "active", "ended"];

export function classroomStorageKey(classroomId: string) {
  return `classroom:${classroomId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isClassroomStatus(value: unknown): value is ClassroomStatus {
  return typeof value === "string" && CLASSROOM_STATUSES.includes(value as ClassroomStatus);
}

function isQuestionLink(value: unknown): value is ClassroomQuestionLink {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.questionId === "string" &&
    typeof value.questionNo === "string" &&
    typeof value.studentUrl === "string" &&
    typeof value.qrDataUrl === "string"
  );
}

export function toStoredClassroom(value: unknown): StoredClassroom | null {
  if (!isRecord(value)) {
    return null;
  }

  const expectedCount = value.expectedCount;

  if (
    typeof value.id === "string" &&
    typeof value.questionSetId === "string" &&
    typeof value.teacherToken === "string" &&
    typeof value.teacherUrl === "string" &&
    isClassroomStatus(value.status) &&
    typeof expectedCount === "number" &&
    Number.isInteger(expectedCount) &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestionLink)
  ) {
    return {
      id: value.id,
      questionSetId: value.questionSetId,
      teacherToken: value.teacherToken,
      teacherUrl: value.teacherUrl,
      status: value.status,
      expectedCount,
      startedAt: isNullableString(value.startedAt) ? value.startedAt : null,
      endedAt: isNullableString(value.endedAt) ? value.endedAt : null,
      questions: value.questions,
    };
  }

  return null;
}

export function isStoredClassroom(value: unknown): value is StoredClassroom {
  return toStoredClassroom(value) !== null;
}

export function isClassroomStatusUpdate(value: unknown): value is ClassroomStatusUpdate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.questionSetId === "string" &&
    isClassroomStatus(value.status) &&
    Number.isInteger(value.expectedCount) &&
    isNullableString(value.startedAt) &&
    isNullableString(value.endedAt)
  );
}

export function loadStoredClassroom(classroomId: string): StoredClassroom | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(classroomStorageKey(classroomId));
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return toStoredClassroom(parsed);
  } catch {
    return null;
  }
}

export function saveStoredClassroom(classroom: StoredClassroom) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(classroomStorageKey(classroom.id), JSON.stringify(classroom));
}
