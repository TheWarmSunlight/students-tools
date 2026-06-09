export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT NOT NULL,
  question_set_id TEXT NOT NULL,
  question_no TEXT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  options_json TEXT NOT NULL,
  items_json TEXT NOT NULL,
  knowledge_points_json TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  include_in_stats INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  PRIMARY KEY (question_set_id, id),
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  question_set_id TEXT NOT NULL,
  status TEXT NOT NULL,
  expected_count INTEGER NOT NULL,
  teacher_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id)
);

CREATE TABLE IF NOT EXISTS question_tokens (
  token TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  question_set_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (question_set_id, question_id) REFERENCES questions(question_set_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(classroom_id, seat_no),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  question_set_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  graded_items_json TEXT NOT NULL,
  all_correct INTEGER NOT NULL,
  submit_count INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(classroom_id, question_id, student_id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (question_set_id, question_id) REFERENCES questions(question_set_id, id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL UNIQUE,
  summary_json TEXT NOT NULL,
  ai_text TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
);
`;
