import type { GradedSubmission, Question, StudentIdentity } from "@/lib/domain/types";
import { numericEquivalent } from "./arithmetic";

type ItemResult = {
  correct: boolean;
  reason?: "格式无法识别";
};

const circledNumerals = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
  "⑫",
  "⑬",
  "⑭",
  "⑮",
  "⑯",
  "⑰",
  "⑱",
  "⑲",
  "⑳",
];

export function gradeSubmission(
  question: Question,
  answers: string[],
  student: StudentIdentity = { seatNo: "", name: "" },
): GradedSubmission {
  const items = question.items.map((item) => {
    const result = gradeItem(item.gradingMode, answers[item.index] ?? "", item.answer);

    return {
      index: item.index,
      correct: result.correct,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  });

  return {
    questionId: question.id,
    student,
    items,
    allCorrect: items.every((item) => item.correct),
  };
}

function gradeItem(mode: Question["items"][number]["gradingMode"], student: string, expected: string): ItemResult {
  if (mode === "numeric") {
    const result = numericEquivalent(student, expected);
    return {
      correct: result.equivalent,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }

  if (mode === "matching") {
    return {
      correct: normalizeMatching(student) === normalizeMatching(expected),
    };
  }

  return {
    correct: expected.split(",").some((candidate) => normalizeText(candidate) === normalizeText(student)),
  };
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeMatching(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (match) => {
      const index = circledNumerals.indexOf(match);
      return index >= 0 ? String(index + 1) : match;
    });
}
