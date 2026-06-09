import type { ClassroomAnalytics } from "@/lib/stats/analytics";

export type ReportMessage = { role: "system" | "user" | "assistant"; content: string };

type SafeItemStats = {
  index: number;
  correct: number;
  total: number;
  accuracy: number;
  errorRate: number;
};

type SafeQuestionSummary = {
  questionId: string;
  questionNo: string;
  itemAccuracy: number;
  errorRate: number;
  allCorrectRate: number;
  submittedCount: number;
  correctItems: number;
  totalItems: number;
  itemStats: SafeItemStats[];
};

type SafeKnowledgePointSummary = {
  name: string;
  accuracy: number;
  correctItems: number;
  totalItems: number;
};

type SafeLayerSummary = {
  code: string;
  name: string;
  count: number;
  percentage: number;
};

type SafeReportSummary = {
  expectedCount: number;
  studentCount: number;
  submittedStudentCount: number;
  submitRate: number;
  averageAccuracy: number;
  questions: SafeQuestionSummary[];
  knowledgePoints: SafeKnowledgePointSummary[];
  layers: SafeLayerSummary[];
};

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberFrom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function projectItemStats(value: unknown): SafeItemStats {
  const itemStats = recordFrom(value);

  return {
    index: numberFrom(itemStats.index),
    correct: numberFrom(itemStats.correct),
    total: numberFrom(itemStats.total),
    accuracy: numberFrom(itemStats.accuracy),
    errorRate: numberFrom(itemStats.errorRate),
  };
}

function projectQuestion(value: unknown): SafeQuestionSummary {
  const question = recordFrom(value);

  return {
    questionId: stringFrom(question.questionId),
    questionNo: stringFrom(question.questionNo),
    itemAccuracy: numberFrom(question.itemAccuracy),
    errorRate: numberFrom(question.errorRate),
    allCorrectRate: numberFrom(question.allCorrectRate),
    submittedCount: numberFrom(question.submittedCount),
    correctItems: numberFrom(question.correctItems),
    totalItems: numberFrom(question.totalItems),
    itemStats: arrayFrom(question.itemStats).map(projectItemStats),
  };
}

function projectKnowledgePoint(value: unknown): SafeKnowledgePointSummary {
  const knowledgePoint = recordFrom(value);

  return {
    name: stringFrom(knowledgePoint.name),
    accuracy: numberFrom(knowledgePoint.accuracy),
    correctItems: numberFrom(knowledgePoint.correctItems),
    totalItems: numberFrom(knowledgePoint.totalItems),
  };
}

function projectLayer(value: unknown): SafeLayerSummary {
  const layer = recordFrom(value);

  return {
    code: stringFrom(layer.code),
    name: stringFrom(layer.name),
    count: numberFrom(layer.count),
    percentage: numberFrom(layer.percentage),
  };
}

function projectSafeSummary(summary: ClassroomAnalytics): SafeReportSummary {
  const source = recordFrom(summary);

  return {
    expectedCount: numberFrom(source.expectedCount),
    studentCount: numberFrom(source.studentCount),
    submittedStudentCount: numberFrom(source.submittedStudentCount),
    submitRate: numberFrom(source.submitRate),
    averageAccuracy: numberFrom(source.averageAccuracy),
    questions: arrayFrom(source.questions).map(projectQuestion),
    knowledgePoints: arrayFrom(source.knowledgePoints).map(projectKnowledgePoint),
    layers: arrayFrom(source.layers).map(projectLayer),
  };
}

const SYSTEM_PROMPT = [
  "你是面向教师的学情分析报告助手。",
  "你只基于汇总统计生成报告，不得使用、推测或还原任何逐人信息。",
  "不得编造未提供的数据、题目内容、知识点名称、人数或正确率。",
  "不得改写原始正确率、人数、题目统计或知识点统计；引用数据时保持原始统计含义。",
  "报告中必须清楚区分“数据结论”和“教学建议”。",
  "如果提交人数较少、样本不足或统计分母为 0，必须提示样本不足并降低结论确定性。",
].join("\n");

export function buildReportMessages(summary: ClassroomAnalytics): ReportMessage[] {
  const safeSummary = projectSafeSummary(summary);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "请基于以下 AI-safe 汇总统计生成一份教师学情分析报告。",
        "输出应包含数据结论、主要薄弱点、分层教学建议和后续练习建议。",
        JSON.stringify(safeSummary, null, 2),
      ].join("\n\n"),
    },
  ];
}
