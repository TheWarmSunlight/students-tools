export const QUESTION_TYPES = ["choice", "judgement", "blank", "matching"] as const;
export const GRADING_MODES = ["text", "numeric", "matching"] as const;
export const CLASSROOM_STATUSES = ["draft", "active", "ended"] as const;
export const QUESTION_DIFFICULTIES = ["基础", "提高", "拓展"] as const;
export const LAYER_RULES = [
  { code: "A", name: "优秀拓展层", minInclusive: 0.85 },
  { code: "B", name: "良好提升层", minInclusive: 0.7 },
  { code: "C", name: "基础夯实层", minInclusive: 0.5 },
  { code: "D", name: "补差帮扶层", minInclusive: 0 }
] as const;
