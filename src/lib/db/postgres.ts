import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { nanoid } from "nanoid";
import type {
  ClassroomStatus,
  GradedItem,
  Question,
  QuestionItem,
  QuestionOption,
  StudentIdentity,
} from "@/lib/domain/types";
import { SCHEMA_SQL } from "./schema";
import type {
  ClassroomRecord,
  CreatedClassroom,
  QuestionTokenRecord,
  RepositorySet,
  StudentRecord,
  SubmissionRecord,
} from "./repositories";

type QueryRunner = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
};

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

type SaveSubmissionInput = Parameters<RepositorySet["submissions"]["save"]>[0];

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
  return Number(value) === 1;
}

function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    questionNo: row.question_no,
    type: row.type,
    prompt: row.prompt,
    itemCount: Number(row.item_count),
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
    expectedCount: Number(row.expected_count),
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
    submitCount: Number(row.submit_count),
    submittedAt: row.submitted_at,
  };
}

async function withTransaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function getClassroomQuestionSetId(runner: QueryRunner, classroomId: string) {
  const result = await runner.query<{ question_set_id: string }>(
    "SELECT question_set_id FROM classrooms WHERE id = $1",
    [classroomId],
  );
  const classroom = result.rows[0];
  if (!classroom) {
    throw new Error(`Classroom not found: ${classroomId}`);
  }

  return classroom.question_set_id;
}

function firstRow<T extends QueryResultRow>(result: QueryResult<T>) {
  return result.rows[0] ?? null;
}

export async function createPostgresRepositories(pool: Pool): Promise<RepositorySet> {
  await pool.query(SCHEMA_SQL);

  const questionSets: RepositorySet["questionSets"] = {
    async create(title: string, questions: Question[]) {
      const id = nanoid();
      const createdAt = now();

      await withTransaction(pool, async (client) => {
        await client.query(
          "INSERT INTO question_sets (id, title, created_at) VALUES ($1, $2, $3)",
          [id, title, createdAt],
        );

        for (const question of questions) {
          await client.query(
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
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
            ],
          );
        }
      });

      return id;
    },

    async listQuestions(questionSetId: string) {
      const result = await pool.query<QuestionRow>(
        "SELECT * FROM questions WHERE question_set_id = $1 ORDER BY question_no",
        [questionSetId],
      );
      return result.rows.map(rowToQuestion);
    },
  };

  const classrooms: RepositorySet["classrooms"] = {
    async create(questionSetId: string, expectedCount: number): Promise<CreatedClassroom> {
      const id = nanoid();
      const teacherToken = nanoid(TOKEN_SIZE);
      await pool.query(
        `INSERT INTO classrooms (
          id,
          question_set_id,
          status,
          expected_count,
          teacher_token,
          created_at
        ) VALUES ($1, $2, 'draft', $3, $4, $5)`,
        [id, questionSetId, expectedCount, teacherToken, now()],
      );

      return {
        id,
        teacherToken,
        questionSetId,
        status: "draft",
        expectedCount,
      };
    },

    async get(id: string) {
      const result = await pool.query<ClassroomRow>("SELECT * FROM classrooms WHERE id = $1", [
        id,
      ]);
      const row = firstRow(result);
      return row ? rowToClassroom(row) : null;
    },

    async getByTeacherToken(token: string) {
      const result = await pool.query<ClassroomRow>(
        "SELECT * FROM classrooms WHERE teacher_token = $1",
        [token],
      );
      const row = firstRow(result);
      return row ? rowToClassroom(row) : null;
    },

    async setStatus(id: string, status: ClassroomStatus) {
      const timestamp = now();
      let result: QueryResult<ClassroomRow>;

      if (status === "active") {
        result = await pool.query<ClassroomRow>(
          `UPDATE classrooms
          SET status = $1, started_at = COALESCE(started_at, $2)
          WHERE id = $3
          RETURNING *`,
          [status, timestamp, id],
        );
      } else if (status === "ended") {
        result = await pool.query<ClassroomRow>(
          `UPDATE classrooms
          SET status = $1, ended_at = COALESCE(ended_at, $2)
          WHERE id = $3
          RETURNING *`,
          [status, timestamp, id],
        );
      } else {
        result = await pool.query<ClassroomRow>(
          "UPDATE classrooms SET status = $1 WHERE id = $2 RETURNING *",
          [status, id],
        );
      }

      const row = firstRow(result);
      return row ? rowToClassroom(row) : null;
    },
  };

  const questionTokens: RepositorySet["questionTokens"] = {
    async create(classroomId: string, questionId: string) {
      const token = nanoid(TOKEN_SIZE);
      const questionSetId = await getClassroomQuestionSetId(pool, classroomId);
      await pool.query(
        `INSERT INTO question_tokens (
          token,
          classroom_id,
          question_set_id,
          question_id
        ) VALUES ($1, $2, $3, $4)`,
        [token, classroomId, questionSetId, questionId],
      );
      return token;
    },

    async get(token: string) {
      const result = await pool.query<QuestionTokenRow>(
        "SELECT * FROM question_tokens WHERE token = $1",
        [token],
      );
      const row = firstRow(result);
      return row ? rowToQuestionToken(row) : null;
    },
  };

  const students: RepositorySet["students"] = {
    async upsert(classroomId: string, student: StudentIdentity) {
      const timestamp = now();
      const result = await pool.query<{ id: string }>(
        `INSERT INTO students (
          id,
          classroom_id,
          seat_no,
          name,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(classroom_id, seat_no) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at
        RETURNING id`,
        [nanoid(), classroomId, student.seatNo, student.name, timestamp, timestamp],
      );

      const row = firstRow(result);
      if (!row) {
        throw new Error("Failed to upsert student");
      }

      return row.id;
    },

    async listByClassroom(classroomId: string) {
      const result = await pool.query<StudentRow>(
        "SELECT * FROM students WHERE classroom_id = $1 ORDER BY seat_no",
        [classroomId],
      );
      return result.rows.map(rowToStudent);
    },
  };

  const submissions: RepositorySet["submissions"] = {
    async save(input: SaveSubmissionInput) {
      const submittedAt = input.submittedAt ?? now();
      const questionSetId = await getClassroomQuestionSetId(pool, input.classroomId);
      const result = await pool.query<SubmissionRow>(
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
        ON CONFLICT(classroom_id, question_id, student_id) DO UPDATE SET
          answers_json = excluded.answers_json,
          graded_items_json = excluded.graded_items_json,
          all_correct = excluded.all_correct,
          submit_count = submissions.submit_count + 1,
          submitted_at = excluded.submitted_at
        RETURNING *`,
        [
          nanoid(),
          input.classroomId,
          questionSetId,
          input.questionId,
          input.studentId,
          JSON.stringify(input.answers),
          JSON.stringify(input.gradedItems),
          toSqlBoolean(input.allCorrect),
          submittedAt,
        ],
      );
      const row = firstRow(result);
      if (!row) {
        throw new Error("Failed to save submission");
      }

      return rowToSubmission(row);
    },

    async listByClassroom(classroomId: string) {
      const result = await pool.query<SubmissionRow>(
        "SELECT * FROM submissions WHERE classroom_id = $1 ORDER BY submitted_at, id",
        [classroomId],
      );
      return result.rows.map(rowToSubmission);
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
