import { describe, expect, it } from "vitest";
import {
  CLASSROOM_STATUSES,
  GRADING_MODES,
  LAYER_RULES,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
} from "@/lib/domain/constants";

describe("domain constants", () => {
  it("contains the first-version supported question and grading types", () => {
    expect(QUESTION_TYPES).toEqual(["choice", "judgement", "blank", "matching"]);
    expect(GRADING_MODES).toEqual(["text", "numeric", "matching"]);
    expect(CLASSROOM_STATUSES).toEqual(["draft", "active", "ended"]);
    expect(QUESTION_DIFFICULTIES).toEqual(["基础", "提高", "拓展"]);
  });

  it("contains the first-version learning layer rules", () => {
    expect(LAYER_RULES).toEqual([
      { code: "A", name: "优秀拓展层", minInclusive: 0.85 },
      { code: "B", name: "良好提升层", minInclusive: 0.7 },
      { code: "C", name: "基础夯实层", minInclusive: 0.5 },
      { code: "D", name: "补差帮扶层", minInclusive: 0 },
    ]);
  });
});
