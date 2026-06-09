import type {
  CLASSROOM_STATUSES,
  GRADING_MODES,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
} from "./constants";

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type GradingMode = (typeof GRADING_MODES)[number];
export type ClassroomStatus = (typeof CLASSROOM_STATUSES)[number];
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export type QuestionOption = {
  key: string;
  text: string;
};

export type QuestionItem = {
  index: number;
  answer: string;
  gradingMode: GradingMode;
};

export type Question = {
  id: string;
  questionNo: string;
  type: QuestionType;
  prompt: string;
  itemCount: number;
  options: QuestionOption[];
  items: QuestionItem[];
  knowledgePoints: string[];
  difficulty: QuestionDifficulty;
  includeInStats: boolean;
  explanation: string;
};

export type StudentIdentity = {
  seatNo: string;
  name: string;
};

export type StudentSubmission = {
  questionId: string;
  student: StudentIdentity;
  answers: string[];
  submittedAt: string;
};

export type GradedItem = {
  index: number;
  correct: boolean;
  reason?: string;
};

export type GradedSubmission = {
  questionId: string;
  student: StudentIdentity;
  items: GradedItem[];
  allCorrect: boolean;
};
