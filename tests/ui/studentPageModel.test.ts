import { describe, expect, it, vi } from "vitest";
import type { StudentQuestion } from "@/components/QuestionRenderer";
import {
  STUDENT_IDENTITY_KEY,
  createLoadedQuestionState,
  loadStudentIdentity,
  saveStudentIdentity,
  submitStudentAnswers,
  type StudentStorage,
} from "@/components/studentPageModel";

function question(overrides: Partial<StudentQuestion> = {}): StudentQuestion {
  return {
    questionId: "q-1",
    questionNo: "Q1",
    prompt: "1/2 = ____",
    type: "blank",
    options: [],
    itemCount: 1,
    status: "active",
    ...overrides,
  };
}

describe("student page model", () => {
  it("returns an empty identity when localStorage getItem or JSON parsing fails", () => {
    const blockedStorage: StudentStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(),
    };
    const malformedStorage: StudentStorage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadStudentIdentity(blockedStorage)).toEqual({ name: "", seatNo: "" });
    expect(loadStudentIdentity(malformedStorage)).toEqual({ name: "", seatNo: "" });
  });

  it("ignores localStorage setItem failures", () => {
    const storage: StudentStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    };

    expect(() => saveStudentIdentity(storage, { name: "小明", seatNo: "01" })).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledWith(
      STUDENT_IDENTITY_KEY,
      JSON.stringify({ name: "小明", seatNo: "01" }),
    );
  });

  it("submits the expected student answer payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        questionId: "q-1",
        allCorrect: true,
        gradedItems: [{ index: 0, correct: true }],
        submitCount: 1,
        submittedAt: "2026-06-10T00:00:00.000Z",
      }),
    );

    const result = await submitStudentAnswers({
      token: "token-1",
      identity: { name: "小明", seatNo: "01" },
      answers: ["1/2"],
      fetcher,
    });

    expect(result).toMatchObject({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/student/questions/token-1/submit",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      name: "小明",
      seatNo: "01",
      answers: ["1/2"],
    });
  });

  it("can save identity and submit even when localStorage writes fail", async () => {
    const storage: StudentStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        questionId: "q-1",
        allCorrect: false,
        gradedItems: [{ index: 0, correct: false }],
        submitCount: 1,
        submittedAt: "2026-06-10T00:00:00.000Z",
      }),
    );

    saveStudentIdentity(storage, { name: "小红", seatNo: "02" });
    const result = await submitStudentAnswers({
      token: "token-1",
      identity: { name: "小红", seatNo: "02" },
      answers: ["3/4"],
      fetcher,
    });

    expect(result).toMatchObject({ status: "ok" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("clears stale submitted state when a new question loads", () => {
    const loadedState = createLoadedQuestionState(question({ itemCount: 2 }));

    expect(loadedState.answers).toEqual(["", ""]);
    expect(loadedState.submitResult).toBeNull();
  });
});
