import { LAYER_RULES } from "@/lib/domain/constants";
import type { LayerCode, Question } from "@/lib/domain/types";

type StudentInput = {
  id: string;
  seatNo: string;
  name: string;
};

type SubmissionInput = {
  studentId: string;
  questionId: string;
  gradedItems: Array<{ index: number; correct: boolean }>;
  allCorrect: boolean;
};

type GradedItem = SubmissionInput["gradedItems"][number];

export type ItemAnalytics = {
  index: number;
  correct: number;
  total: number;
  accuracy: number;
  errorRate: number;
};

export type QuestionAnalytics = {
  questionId: string;
  questionNo: string;
  itemAccuracy: number;
  errorRate: number;
  allCorrectRate: number;
  submittedCount: number;
  correctItems: number;
  totalItems: number;
  itemStats: ItemAnalytics[];
};

export type KnowledgePointAnalytics = {
  name: string;
  accuracy: number;
  correctItems: number;
  totalItems: number;
};

export type StudentAnalytics = StudentInput & {
  accuracy: number;
  correctItems: number;
  totalItems: number;
  layerCode: LayerCode;
};

export type LayerAnalytics = {
  code: LayerCode;
  name: string;
  count: number;
  percentage: number;
};

export type ClassroomAnalytics = {
  expectedCount: number;
  studentCount: number;
  submittedStudentCount: number;
  submitRate: number;
  averageAccuracy: number;
  questions: QuestionAnalytics[];
  knowledgePoints: KnowledgePointAnalytics[];
  students: StudentAnalytics[];
  layers: LayerAnalytics[];
};

type CountStats = {
  correctItems: number;
  totalItems: number;
};

type MutableItemStats = {
  index: number;
  correct: number;
  total: number;
};

type MutableQuestionStats = CountStats & {
  question: Question;
  submittedCount: number;
  allCorrectCount: number;
  itemStatsByIndex: Map<number, MutableItemStats>;
};

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function layerForAccuracy(accuracy: number): LayerCode {
  return (
    LAYER_RULES.find((rule) => accuracy >= rule.minInclusive)?.code ??
    LAYER_RULES[LAYER_RULES.length - 1].code
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function firstValidGradedItems(
  gradedItems: GradedItem[],
  expectedItemsByIndex: ReadonlyMap<number, unknown>,
): GradedItem[] {
  const seenIndexes = new Set<number>();
  const validGradedItems: GradedItem[] = [];

  for (const gradedItem of gradedItems) {
    if (!expectedItemsByIndex.has(gradedItem.index) || seenIndexes.has(gradedItem.index)) {
      continue;
    }

    seenIndexes.add(gradedItem.index);
    validGradedItems.push(gradedItem);
  }

  return validGradedItems;
}

function hasAllExpectedCorrectItems(
  gradedItems: GradedItem[],
  expectedItemsByIndex: ReadonlyMap<number, unknown>,
): boolean {
  return (
    expectedItemsByIndex.size > 0 &&
    gradedItems.length === expectedItemsByIndex.size &&
    gradedItems.every((gradedItem) => gradedItem.correct && expectedItemsByIndex.has(gradedItem.index))
  );
}

export function buildClassroomAnalytics(input: {
  expectedCount: number;
  questions: Question[];
  students: StudentInput[];
  submissions: SubmissionInput[];
}): ClassroomAnalytics {
  const includedQuestions = input.questions.filter((question) => question.includeInStats);
  const questionStatsById = new Map<string, MutableQuestionStats>();
  const knowledgePointStatsByName = new Map<string, KnowledgePointAnalytics>();
  const studentStatsById = new Map<string, CountStats>();
  const knownStudentIds = new Set(input.students.map((student) => student.id));
  const submittedStudentIds = new Set<string>();
  const classStats: CountStats = { correctItems: 0, totalItems: 0 };

  for (const student of input.students) {
    studentStatsById.set(student.id, { correctItems: 0, totalItems: 0 });
  }

  for (const question of includedQuestions) {
    const itemStatsByIndex = new Map<number, MutableItemStats>();

    for (const item of question.items) {
      itemStatsByIndex.set(item.index, { index: item.index, correct: 0, total: 0 });
    }

    questionStatsById.set(question.id, {
      question,
      submittedCount: 0,
      allCorrectCount: 0,
      correctItems: 0,
      totalItems: 0,
      itemStatsByIndex,
    });

    for (const knowledgePoint of unique(question.knowledgePoints)) {
      if (!knowledgePointStatsByName.has(knowledgePoint)) {
        knowledgePointStatsByName.set(knowledgePoint, {
          name: knowledgePoint,
          accuracy: 0,
          correctItems: 0,
          totalItems: 0,
        });
      }
    }
  }

  for (const submission of input.submissions) {
    if (!knownStudentIds.has(submission.studentId)) {
      continue;
    }

    submittedStudentIds.add(submission.studentId);

    const questionStats = questionStatsById.get(submission.questionId);

    if (!questionStats) {
      continue;
    }

    questionStats.submittedCount += 1;
    const validGradedItems = firstValidGradedItems(
      submission.gradedItems,
      questionStats.itemStatsByIndex,
    );

    if (hasAllExpectedCorrectItems(validGradedItems, questionStats.itemStatsByIndex)) {
      questionStats.allCorrectCount += 1;
    }

    const studentStats = studentStatsById.get(submission.studentId);
    const knowledgePoints = unique(questionStats.question.knowledgePoints);

    for (const gradedItem of validGradedItems) {
      const itemStats = questionStats.itemStatsByIndex.get(gradedItem.index);
      if (!itemStats) {
        continue;
      }

      const correctIncrement = gradedItem.correct ? 1 : 0;

      questionStats.correctItems += correctIncrement;
      questionStats.totalItems += 1;
      classStats.correctItems += correctIncrement;
      classStats.totalItems += 1;

      itemStats.correct += correctIncrement;
      itemStats.total += 1;

      if (studentStats) {
        studentStats.correctItems += correctIncrement;
        studentStats.totalItems += 1;
      }

      for (const knowledgePoint of knowledgePoints) {
        const knowledgePointStats = knowledgePointStatsByName.get(knowledgePoint);
        if (knowledgePointStats) {
          knowledgePointStats.correctItems += correctIncrement;
          knowledgePointStats.totalItems += 1;
        }
      }
    }
  }

  const questions = includedQuestions.map((question) => {
    const questionStats = questionStatsById.get(question.id);

    if (!questionStats) {
      throw new Error(`Missing stats for included question: ${question.id}`);
    }

    return {
      questionId: question.id,
      questionNo: question.questionNo,
      itemAccuracy: ratio(questionStats.correctItems, questionStats.totalItems),
      errorRate: ratio(
        questionStats.totalItems - questionStats.correctItems,
        questionStats.totalItems,
      ),
      allCorrectRate: ratio(questionStats.allCorrectCount, questionStats.submittedCount),
      submittedCount: questionStats.submittedCount,
      correctItems: questionStats.correctItems,
      totalItems: questionStats.totalItems,
      itemStats: question.items.map((item) => {
        const itemStats = questionStats.itemStatsByIndex.get(item.index) ?? {
          index: item.index,
          correct: 0,
          total: 0,
        };

        return {
          index: item.index,
          correct: itemStats.correct,
          total: itemStats.total,
          accuracy: ratio(itemStats.correct, itemStats.total),
          errorRate: ratio(itemStats.total - itemStats.correct, itemStats.total),
        };
      }),
    };
  });

  const knowledgePoints = [...knowledgePointStatsByName.values()].map((knowledgePointStats) => ({
    name: knowledgePointStats.name,
    accuracy: ratio(knowledgePointStats.correctItems, knowledgePointStats.totalItems),
    correctItems: knowledgePointStats.correctItems,
    totalItems: knowledgePointStats.totalItems,
  }));

  const students = input.students.map((student) => {
    const stats = studentStatsById.get(student.id) ?? { correctItems: 0, totalItems: 0 };
    const accuracy = ratio(stats.correctItems, stats.totalItems);

    return {
      ...student,
      accuracy,
      correctItems: stats.correctItems,
      totalItems: stats.totalItems,
      layerCode: layerForAccuracy(accuracy),
    };
  });

  const layers = LAYER_RULES.map((rule) => {
    const count = students.filter((student) => student.layerCode === rule.code).length;

    return {
      code: rule.code,
      name: rule.name,
      count,
      percentage: ratio(count, input.students.length),
    };
  });

  return {
    expectedCount: input.expectedCount,
    studentCount: input.students.length,
    submittedStudentCount: submittedStudentIds.size,
    submitRate: ratio(submittedStudentIds.size, input.expectedCount),
    averageAccuracy: ratio(classStats.correctItems, classStats.totalItems),
    questions,
    knowledgePoints,
    students,
    layers,
  };
}
