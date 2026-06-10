import { nanoid } from "nanoid";
import type {
  ClassroomStatus,
  GradedItem,
  Question,
  QuestionItem,
  QuestionOption,
  StudentIdentity,
} from "@/lib/domain/types";
import type { AppDatabase } from "./client";

type QuestionRow = {
  id: string;
  question_no: string;
  type: Question["type"];
  prompt: string;
  item_count: number;
  options_json: string;
  items_json: string;
  knowledge_points_json: string;
  difficulty: Question["difficulty"];
  include_in_stats: number;
  explanation: string;
};

type ClassroomRow = {
  id: string;
  question_set_id: string;
  status: ClassroomStatus;
  expected_count: number;
  teacher_token: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type QuestionTokenRow = {
  token: string;
  classroom_id: string;
  question_set_id: string;
  question_id: string;
};

type StudentRow = {
  id: string;
  classroom_id: string;
  seat_no: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  classroom_id: string;
  question_set_id: string;
  question_id: string;
  student_id: string;
  answers_json: string;
  graded_items_json: string;
  all_correct: number;
  submit_count: number;
  submitted_at: string;
};

export type CreatedClassroom = {
  id: string;
  teacherToken: string;
  questionSetId: string;
  status: "draft";
  expectedCount: number;
};

export type ClassroomRecord = {
  id: string;
  questionSetId: string;
  status: ClassroomStatus;
  expectedCount: number;
  teacherToken: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

export type QuestionTokenRecord = {
  token: string;
  classroomId: string;
  questionId: string;
};

export type StudentRecord = {
  id: string;
  classroomId: string;
  seatNo: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionRecord = {
  id: string;
  classroomId: string;
  questionId: string;
  studentId: string;
  answers: string[];
  gradedItems: GradedItem[];
  allCorrect: boolean;
  submitCount: number;
  submittedAt: string;
};

type SaveSubmissionInput = {
  classroomId: string;
  questionId: string;
  studentId: string;
  answers: string[];
  gradedItems: GradedItem[];
  allCorrect: boolean;
  submittedAt?: string;
};

export type MaybePromise<T> = T | Promise<T>;

export type RepositorySet = {
  questionSets: {
    create(title: string, questions: Question[]): MaybePromise<string>;
    listQuestions(questionSetId: string): MaybePromise<Question[]>;
  };
  classrooms: {
    create(questionSetId: string, expectedCount: number): MaybePromise<CreatedClassroom>;
    get(id: string): MaybePromise<ClassroomRecord | null>;
    getByTeacherToken(token: string): MaybePromise<ClassroomRecord | null>;
    setStatus(id: string, status: ClassroomStatus): MaybePromise<ClassroomRecord | null>;
  };
  questionTokens: {
    create(classroomId: string, questionId: string): MaybePromise<string>;
    get(token: string): MaybePromise<QuestionTokenRecord | null>;
  };
  students: {
    upsert(classroomId: string, student: StudentIdentity): MaybePromise<string>;
    listByClassroom(classroomId: string): MaybePromise<StudentRecord[]>;
  };
  submissions: {
    save(input: SaveSubmissionInput): MaybePromise<SubmissionRecord>;
    listByClassroom(classroomId: string): MaybePromise<SubmissionRecord[]>;
  };
};

const TOKEN_SIZE = 32;

function now() {
  return new Date().toISOString();
}

function parseJsonArray<T>(raw: string, fieldName: string): T[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON array`);
  }

  return parsed as T[];
}

function toSqlBoolean(value: boolean) {
  return value ? 1 : 0;
}

function fromSqlBoolean(value: number) {
  return value === 1;
}

function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    questionNo: row.question_no,
    type: row.type,
    prompt: row.prompt,
    itemCount: row.item_count,
    options: parseJsonArray<QuestionOption>(row.options_json, "options_json"),
    items: parseJsonArray<QuestionItem>(row.items_json, "items_json"),
    knowledgePoints: parseJsonArray<string>(
      row.knowledge_points_json,
      "knowledge_points_json",
    ),
    difficulty: row.difficulty,
    includeInStats: fromSqlBoolean(row.include_in_stats),
    explanation: row.explanation,
  };
}

function rowToClassroom(row: ClassroomRow): ClassroomRecord {
  return {
    id: row.id,
    questionSetId: row.question_set_id,
    status: row.status,
    expectedCount: row.expected_count,
    teacherToken: row.teacher_token,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function rowToQuestionToken(row: QuestionTokenRow): QuestionTokenRecord {
  return {
    token: row.token,
    classroomId: row.classroom_id,
    questionId: row.question_id,
  };
}

function rowToStudent(row: StudentRow): StudentRecord {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    seatNo: row.seat_no,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSubmission(row: SubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    questionId: row.question_id,
    studentId: row.student_id,
    answers: parseJsonArray<string>(row.answers_json, "answers_json"),
    gradedItems: parseJsonArray<GradedItem>(row.graded_items_json, "graded_items_json"),
    allCorrect: fromSqlBoolean(row.all_correct),
    submitCount: row.submit_count,
    submittedAt: row.submitted_at,
  };
}

function getClassroomQuestionSetId(db: AppDatabase, classroomId: string): string {
  const classroom = db
    .prepare<[string], { question_set_id: string }>(
      "SELECT question_set_id FROM classrooms WHERE id = ?",
    )
    .get(classroomId);
  if (!classroom) {
    throw new Error(`Classroom not found: ${classroomId}`);
  }

  return classroom.question_set_id;
}

export function createRepositories(db: AppDatabase) {
  const questionSets = {
    create(title: string, questions: Question[]) {
      const id = nanoid();
      const createdAt = now();
      const insertQuestionSet = db.prepare<[string, string, string]>(
        "INSERT INTO question_sets (id, title, created_at) VALUES (?, ?, ?)",
      );
      const insertQuestion = db.prepare<
        [
          string,
          string,
          string,
          Question["type"],
          string,
          number,
          string,
          string,
          string,
          Question["difficulty"],
          number,
          string,
        ]
      >(
        `INSERT INTO questions (
          id,
          question_set_id,
          question_no,
          type,
          prompt,
          item_count,
          options_json,
          items_json,
          knowledge_points_json,
          difficulty,
          include_in_stats,
          explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const createQuestionSet = db.transaction(() => {
        insertQuestionSet.run(id, title, createdAt);
        for (const question of questions) {
          insertQuestion.run(
            question.id,
            id,
            question.questionNo,
            question.type,
            question.prompt,
            question.itemCount,
            JSON.stringify(question.options),
            JSON.stringify(question.items),
            JSON.stringify(question.knowledgePoints),
            question.difficulty,
            toSqlBoolean(question.includeInStats),
            question.explanation,
          );
        }
      });

      createQuestionSet();
      return id;
    },

    listQuestions(questionSetId: string): Question[] {
      return db
        .prepare<[string], QuestionRow>(
          "SELECT * FROM questions WHERE question_set_id = ? ORDER BY question_no",
        )
        .all(questionSetId)
        .map(rowToQuestion);
    },
  };

  const classrooms = {
    create(questionSetId: string, expectedCount: number): CreatedClassroom {
      const id = nanoid();
      const teacherToken = nanoid(TOKEN_SIZE);
      db.prepare<[string, string, number, string, string]>(
        `INSERT INTO classrooms (
          id,
          question_set_id,
          status,
          expected_count,
          teacher_token,
          created_at
        ) VALUES (?, ?, 'draft', ?, ?, ?)`,
      ).run(id, questionSetId, expectedCount, teacherToken, now());

      return {
        id,
        teacherToken,
        questionSetId,
        status: "draft",
        expectedCount,
      };
    },

    get(id: string): ClassroomRecord | null {
      const row = db
        .prepare<[string], ClassroomRow>("SELECT * FROM classrooms WHERE id = ?")
        .get(id);
      return row ? rowToClassroom(row) : null;
    },

    getByTeacherToken(token: string): ClassroomRecord | null {
      const row = db
        .prepare<[string], ClassroomRow>("SELECT * FROM classrooms WHERE teacher_token = ?")
        .get(token);
      return row ? rowToClassroom(row) : null;
    },

    setStatus(id: string, status: ClassroomStatus): ClassroomRecord | null {
      const timestamp = now();
      if (status === "active") {
        db.prepare<[ClassroomStatus, string, string]>(
          "UPDATE classrooms SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?",
        ).run(status, timestamp, id);
      } else if (status === "ended") {
        db.prepare<[ClassroomStatus, string, string]>(
          "UPDATE classrooms SET status = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?",
        ).run(status, timestamp, id);
      } else {
        db.prepare<[ClassroomStatus, string]>("UPDATE classrooms SET status = ? WHERE id = ?").run(
          status,
          id,
        );
      }

      return this.get(id);
    },
  };

  const questionTokens = {
    create(classroomId: string, questionId: string) {
      const token = nanoid(TOKEN_SIZE);
      const questionSetId = getClassroomQuestionSetId(db, classroomId);
      db.prepare<[string, string, string, string]>(
        `INSERT INTO question_tokens (
          token,
          classroom_id,
          question_set_id,
          question_id
        ) VALUES (?, ?, ?, ?)`,
      ).run(token, classroomId, questionSetId, questionId);
      return token;
    },

    get(token: string): QuestionTokenRecord | null {
      const row = db
        .prepare<[string], QuestionTokenRow>("SELECT * FROM question_tokens WHERE token = ?")
        .get(token);
      return row ? rowToQuestionToken(row) : null;
    },
  };

  const students = {
    upsert(classroomId: string, student: StudentIdentity) {
      const existing = db
        .prepare<[string, string], { id: string }>(
          "SELECT id FROM students WHERE classroom_id = ? AND seat_no = ?",
        )
        .get(classroomId, student.seatNo);
      const timestamp = now();

      if (existing) {
        db.prepare<[string, string, string]>(
          "UPDATE students SET name = ?, updated_at = ? WHERE id = ?",
        ).run(student.name, timestamp, existing.id);
        return existing.id;
      }

      const id = nanoid();
      db.prepare<[string, string, string, string, string, string]>(
        `INSERT INTO students (
          id,
          classroom_id,
          seat_no,
          name,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, classroomId, student.seatNo, student.name, timestamp, timestamp);
      return id;
    },

    listByClassroom(classroomId: string): StudentRecord[] {
      return db
        .prepare<[string], StudentRow>(
          "SELECT * FROM students WHERE classroom_id = ? ORDER BY seat_no",
        )
        .all(classroomId)
        .map(rowToStudent);
    },
  };

  const submissions = {
    save(input: SaveSubmissionInput): SubmissionRecord {
      const submittedAt = input.submittedAt ?? now();
      const questionSetId = getClassroomQuestionSetId(db, input.classroomId);
      db.prepare<
        [string, string, string, string, string, string, string, number, string]
      >(
        `INSERT INTO submissions (
          id,
          classroom_id,
          question_set_id,
          question_id,
          student_id,
          answers_json,
          graded_items_json,
          all_correct,
          submit_count,
          submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(classroom_id, question_id, student_id) DO UPDATE SET
          answers_json = excluded.answers_json,
          graded_items_json = excluded.graded_items_json,
          all_correct = excluded.all_correct,
          submit_count = submissions.submit_count + 1,
          submitted_at = excluded.submitted_at`,
      ).run(
        nanoid(),
        input.classroomId,
        questionSetId,
        input.questionId,
        input.studentId,
        JSON.stringify(input.answers),
        JSON.stringify(input.gradedItems),
        toSqlBoolean(input.allCorrect),
        submittedAt,
      );

      const row = db
        .prepare<[string, string, string], SubmissionRow>(
          `SELECT * FROM submissions
          WHERE classroom_id = ? AND question_id = ? AND student_id = ?`,
        )
        .get(input.classroomId, input.questionId, input.studentId);
      if (!row) {
        throw new Error("Failed to save submission");
      }

      return rowToSubmission(row);
    },

    listByClassroom(classroomId: string): SubmissionRecord[] {
      return db
        .prepare<[string], SubmissionRow>(
          "SELECT * FROM submissions WHERE classroom_id = ? ORDER BY submitted_at, id",
        )
        .all(classroomId)
        .map(rowToSubmission);
    },
  };

  return {
    questionSets,
    classrooms,
    questionTokens,
    students,
    submissions,
  };
}
