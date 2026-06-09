import { describe, expect, it } from "vitest";
import { CLASSROOM_STATUSES, GRADING_MODES, QUESTION_TYPES } from "@/lib/domain/constants";

describe("domain constants", () => {
  it("contains the first-version supported question and grading types", () => {
    expect(QUESTION_TYPES).toEqual(["choice", "judgement", "blank", "matching"]);
    expect(GRADING_MODES).toEqual(["text", "numeric", "matching"]);
    expect(CLASSROOM_STATUSES).toEqual(["draft", "active", "ended"]);
  });
});
