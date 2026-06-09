# AI QR Learning Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-version classroom QR answering and AI learning-analysis web app from `docs/superpowers/specs/2026-06-09-ai-qr-learning-analysis-design.md`.

**Architecture:** Use a single Next.js App Router application with server-side API routes and a SQLite data store. Keep core behavior in focused TypeScript modules under `src/lib` so Excel parsing, grading, statistics, classroom tokens, and Zhipu AI report generation can be tested without rendering UI. The UI is split into teacher workflow pages and one student answering page.

**Tech Stack:** Next.js, React, TypeScript, SQLite via `better-sqlite3`, ExcelJS, QRCode, Vitest, Playwright, a custom safe arithmetic parser for numeric equivalence, and Zhipu AI through an OpenAI-compatible Chat Completions HTTP call.

---

## Scope Guard

This plan implements the first version only:

- Excel template import is the main question-entry path.
- PPT extraction is not implemented.
- Open-ended reasoning questions are not AI-graded.
- Student long-term accounts are not implemented.
- Teacher access uses the teacher board token from the classroom record.
- AI report generation defaults to Zhipu API and degrades to program statistics when it fails.

The workspace currently is not a Git repository. Task 1 initializes Git so subsequent task-level commits are possible.

## File Structure

Create this application structure:

```text
.
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── src
│   ├── app
│   │   ├── api
│   │   │   ├── question-sets/import/route.ts
│   │   │   ├── classrooms/route.ts
│   │   │   ├── classrooms/[classroomId]/route.ts
│   │   │   ├── classrooms/[classroomId]/start/route.ts
│   │   │   ├── classrooms/[classroomId]/end/route.ts
│   │   │   ├── student/questions/[token]/route.ts
│   │   │   ├── student/questions/[token]/submit/route.ts
│   │   │   ├── teacher/[teacherToken]/stats/route.ts
│   │   │   └── teacher/[teacherToken]/report/route.ts
│   │   ├── student/[token]/page.tsx
│   │   ├── teacher/page.tsx
│   │   ├── teacher/classrooms/[classroomId]/page.tsx
│   │   ├── teacher/classrooms/[classroomId]/projector/page.tsx
│   │   ├── teacher/report/[teacherToken]/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── AnalysisReport.tsx
│   │   ├── ClassroomDashboard.tsx
│   │   ├── QuestionEditor.tsx
│   │   ├── QuestionRenderer.tsx
│   │   └── QrPanel.tsx
│   └── lib
│       ├── ai/zhipu.ts
│       ├── classroom/service.ts
│       ├── db/client.ts
│       ├── db/repositories.ts
│       ├── db/schema.ts
│       ├── domain/constants.ts
│       ├── domain/types.ts
│       ├── excel/importer.ts
│       ├── grading/arithmetic.ts
│       ├── grading/grader.ts
│       ├── reports/prompt.ts
│       ├── stats/analytics.ts
│       └── tokens.ts
├── tests
│   ├── ai/zhipu.test.ts
│   ├── classroom/service.test.ts
│   ├── db/repositories.test.ts
│   ├── excel/importer.test.ts
│   ├── grading/arithmetic.test.ts
│   ├── grading/grader.test.ts
│   └── stats/analytics.test.ts
└── e2e/classroom-flow.spec.ts
```

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Initialize Git**

Run:

```powershell
git init
```

Expected: Git creates `.git`.

- [ ] **Step 2: Add package metadata and dependencies**

Create `package.json`:

```json
{
  "name": "students-tools",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "lint": "next lint"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "exceljs": "^4.4.0",
    "nanoid": "^5.1.5",
    "next": "^15.3.3",
    "qrcode": "^1.5.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.25.57"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@testing-library/react": "^16.3.0",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.30",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "typescript": "^5.8.3",
    "vitest": "^3.2.2"
  }
}
```

Run:

```powershell
npm install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 3: Add TypeScript and app config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    globals: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
```

- [ ] **Step 4: Add environment example and ignore rules**

Create `.env.example`:

```text
APP_BASE_URL=http://localhost:3000
DATABASE_PATH=./data/app.db
AI_PROVIDER=zhipu
ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_CHAT_COMPLETIONS_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_MODEL=GLM-4-Flash-250414
```

Create `.gitignore`:

```text
node_modules
.next
dist
coverage
data
.env
.env.local
.env.*.local
playwright-report
test-results
.superpowers
```

- [ ] **Step 5: Add minimal app shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 学情分析",
  description: "课堂二维码答题与学情分析"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <section className="homePanel">
        <h1>AI 学情分析与课堂二维码答题</h1>
        <p>从 Excel 导入题目，生成课堂二维码，实时收集答题并生成学情报告。</p>
        <Link href="/teacher" className="primaryLink">进入教师端</Link>
      </section>
    </main>
  );
}
```

Create `src/app/globals.css`:

```css
:root {
  --green: #285a3b;
  --green-2: #1f7a4d;
  --red: #e9473f;
  --orange: #f39c12;
  --blue: #2c86bd;
  --paper: #f6f2e9;
  --line: #d8d8d8;
  --text: #202124;
  --muted: #62676d;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, "Microsoft YaHei", sans-serif;
  color: var(--text);
  background: #eef2f5;
}

button,
input,
select,
textarea {
  font: inherit;
}

.home {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.homePanel {
  width: min(720px, 100%);
  background: white;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 32px;
}

.primaryLink,
.primaryButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 6px;
  background: var(--green);
  color: white;
  text-decoration: none;
  cursor: pointer;
}
```

- [ ] **Step 6: Verify scaffold**

Run:

```powershell
npm run test
npm run build
```

Expected: Vitest reports no tests or passes existing tests; Next build succeeds.

- [ ] **Step 7: Commit**

Run:

```powershell
git add .
git commit -m "chore: scaffold learning analysis app"
```

## Task 2: Domain Types and Constants

**Files:**
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/constants.ts`
- Test: `tests/domain/types.test.ts`

- [ ] **Step 1: Write domain test**

Create `tests/domain/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLASSROOM_STATUSES, GRADING_MODES, QUESTION_TYPES } from "@/lib/domain/constants";

describe("domain constants", () => {
  it("contains the first-version supported question and grading types", () => {
    expect(QUESTION_TYPES).toEqual(["choice", "judgement", "blank", "matching"]);
    expect(GRADING_MODES).toEqual(["text", "numeric", "matching"]);
    expect(CLASSROOM_STATUSES).toEqual(["draft", "active", "ended"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/domain/types.test.ts
```

Expected: FAIL because `src/lib/domain/constants.ts` does not exist.

- [ ] **Step 3: Add constants and types**

Create `src/lib/domain/constants.ts`:

```ts
export const QUESTION_TYPES = ["choice", "judgement", "blank", "matching"] as const;
export const GRADING_MODES = ["text", "numeric", "matching"] as const;
export const CLASSROOM_STATUSES = ["draft", "active", "ended"] as const;
export const LAYER_RULES = [
  { code: "A", name: "优秀拓展层", minInclusive: 0.85 },
  { code: "B", name: "良好提升层", minInclusive: 0.7 },
  { code: "C", name: "基础夯实层", minInclusive: 0.5 },
  { code: "D", name: "补差帮扶层", minInclusive: 0 }
] as const;
```

Create `src/lib/domain/types.ts`:

```ts
import type { CLASSROOM_STATUSES, GRADING_MODES, QUESTION_TYPES } from "./constants";

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type GradingMode = (typeof GRADING_MODES)[number];
export type ClassroomStatus = (typeof CLASSROOM_STATUSES)[number];

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
  difficulty: "基础" | "提高" | "拓展";
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm run test -- tests/domain/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/domain tests/domain
git commit -m "feat: add domain types"
```

## Task 3: Excel Template Import and Validation

**Files:**
- Create: `src/lib/excel/importer.ts`
- Test: `tests/excel/importer.test.ts`

- [ ] **Step 1: Write failing importer tests**

Create `tests/excel/importer.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { importQuestionsFromWorkbook } from "@/lib/excel/importer";

async function workbookBuffer(rows: Record<string, string | number>[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题目");
  const headers = [
    "题号", "题型", "题干", "小题/空数量", "选项A", "选项B", "选项C", "选项D",
    "标准答案", "答案分隔符", "判分方式", "知识点", "难度层级", "是否纳入统计", "解析"
  ];
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((header) => row[header] ?? ""));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("importQuestionsFromWorkbook", () => {
  it("imports valid blank and matching questions", async () => {
    const buffer = await workbookBuffer([
      {
        "题号": "Q1",
        "题型": "填空",
        "题干": "1/8 + ____ = 1",
        "小题/空数量": 1,
        "标准答案": "7/8",
        "答案分隔符": "|",
        "判分方式": "数值等价",
        "知识点": "加法交换律|加法结合律",
        "难度层级": "基础",
        "是否纳入统计": "是",
        "解析": "凑整"
      },
      {
        "题号": "Q2",
        "题型": "配对",
        "题干": "配对",
        "小题/空数量": 2,
        "标准答案": "①-b|②-a",
        "答案分隔符": "|",
        "判分方式": "配对匹配",
        "知识点": "乘法分配律",
        "难度层级": "基础",
        "是否纳入统计": "是",
        "解析": ""
      }
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].items).toEqual([{ index: 0, answer: "7/8", gradingMode: "numeric" }]);
    expect(result.questions[0].knowledgePoints).toEqual(["加法交换律", "加法结合律"]);
    expect(result.questions[1].items).toEqual([
      { index: 0, answer: "①-b", gradingMode: "matching" },
      { index: 1, answer: "②-a", gradingMode: "matching" }
    ]);
  });

  it("reports answer and grading count mismatch", async () => {
    const buffer = await workbookBuffer([
      {
        "题号": "Q1",
        "题型": "填空",
        "题干": "多空题",
        "小题/空数量": 2,
        "标准答案": "1",
        "答案分隔符": "|",
        "判分方式": "数值等价",
        "知识点": "分数凑整",
        "难度层级": "基础",
        "是否纳入统计": "是"
      }
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "标准答案",
      message: "标准答案数量必须等于小题/空数量 2"
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/excel/importer.test.ts
```

Expected: FAIL because `importQuestionsFromWorkbook` is missing.

- [ ] **Step 3: Implement importer**

Create `src/lib/excel/importer.ts`:

```ts
import ExcelJS from "exceljs";
import type { GradingMode, Question, QuestionType } from "@/lib/domain/types";

type ImportError = {
  rowNumber: number;
  field: string;
  message: string;
};

type ImportResult = {
  questions: Question[];
  errors: ImportError[];
};

const REQUIRED_HEADERS = ["题号", "题型", "题干", "小题/空数量", "标准答案", "判分方式", "知识点", "是否纳入统计"];

const TYPE_MAP: Record<string, QuestionType> = {
  "选择": "choice",
  "选择题": "choice",
  "判断": "judgement",
  "判断题": "judgement",
  "填空": "blank",
  "填空题": "blank",
  "配对": "matching",
  "连线": "matching",
  "连线配对": "matching"
};

const GRADING_MAP: Record<string, GradingMode> = {
  "文本匹配": "text",
  "数值等价": "numeric",
  "配对匹配": "matching"
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  return String(value).trim();
}

function splitBy(raw: string, delimiter: string): string[] {
  return raw.split(delimiter || "|").map((part) => part.trim()).filter(Boolean);
}

export async function importQuestionsFromWorkbook(buffer: Buffer): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const errors: ImportError[] = [];
  const questions: Question[] = [];
  if (!sheet) return { questions, errors: [{ rowNumber: 0, field: "工作表", message: "Excel 中没有工作表" }] };

  const headerRow = sheet.getRow(1);
  const headerIndex = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => headerIndex.set(cellText(cell.value), colNumber));
  for (const header of REQUIRED_HEADERS) {
    if (!headerIndex.has(header)) errors.push({ rowNumber: 1, field: header, message: `缺少必填字段 ${header}` });
  }
  if (errors.length > 0) return { questions, errors };

  function read(row: ExcelJS.Row, header: string): string {
    const index = headerIndex.get(header);
    return index ? cellText(row.getCell(index).value) : "";
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const questionNo = read(row, "题号");
    if (!questionNo) return;
    const typeRaw = read(row, "题型");
    const type = TYPE_MAP[typeRaw];
    const prompt = read(row, "题干");
    const itemCount = Number(read(row, "小题/空数量"));
    const delimiter = read(row, "答案分隔符") || "|";
    const answers = splitBy(read(row, "标准答案"), delimiter);
    const gradingModesRaw = splitBy(read(row, "判分方式"), delimiter);
    const includeInStats = read(row, "是否纳入统计") === "是";
    const rowErrors: ImportError[] = [];

    if (!type) rowErrors.push({ rowNumber, field: "题型", message: `不支持的题型 ${typeRaw}` });
    if (!prompt) rowErrors.push({ rowNumber, field: "题干", message: "题干不能为空" });
    if (!Number.isInteger(itemCount) || itemCount <= 0) rowErrors.push({ rowNumber, field: "小题/空数量", message: "小题/空数量必须为正整数" });
    if (Number.isInteger(itemCount) && answers.length !== itemCount) {
      rowErrors.push({ rowNumber, field: "标准答案", message: `标准答案数量必须等于小题/空数量 ${itemCount}` });
    }
    if (gradingModesRaw.length !== 1 && gradingModesRaw.length !== answers.length) {
      rowErrors.push({ rowNumber, field: "判分方式", message: "判分方式数量必须为 1 或与标准答案数量一致" });
    }
    const mappedModes = gradingModesRaw.map((mode) => GRADING_MAP[mode]);
    if (mappedModes.some((mode) => !mode)) rowErrors.push({ rowNumber, field: "判分方式", message: "存在不支持的判分方式" });
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    const options = ["A", "B", "C", "D"]
      .map((key) => ({ key, text: read(row, `选项${key}`) }))
      .filter((option) => option.text);

    questions.push({
      id: `q-${questionNo}`,
      questionNo,
      type,
      prompt,
      itemCount,
      options,
      items: answers.map((answer, index) => ({
        index,
        answer,
        gradingMode: mappedModes.length === 1 ? mappedModes[0] : mappedModes[index]
      })),
      knowledgePoints: splitBy(read(row, "知识点"), "|"),
      difficulty: (read(row, "难度层级") || "基础") as Question["difficulty"],
      includeInStats,
      explanation: read(row, "解析")
    });
  });

  return { questions: errors.length > 0 ? [] : questions, errors };
}
```

- [ ] **Step 4: Run importer tests**

Run:

```powershell
npm run test -- tests/excel/importer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/excel tests/excel
git commit -m "feat: import questions from excel"
```

## Task 4: Grading Engine and Safe Numeric Equivalence

**Files:**
- Create: `src/lib/grading/arithmetic.ts`
- Create: `src/lib/grading/grader.ts`
- Test: `tests/grading/arithmetic.test.ts`
- Test: `tests/grading/grader.test.ts`

- [ ] **Step 1: Write numeric parser tests**

Create `tests/grading/arithmetic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { numericEquivalent } from "@/lib/grading/arithmetic";

describe("numericEquivalent", () => {
  it.each([
    ["0.5", "1/2"],
    ["2/4", "1/2"],
    ["1.0", "1"],
    ["2+3", "5"],
    ["3×4", "12"],
    ["3x4", "12"],
    ["(1/8+7/8)", "1"],
    ["40%", "0.4"]
  ])("treats %s and %s as equivalent", (student, expected) => {
    expect(numericEquivalent(student, expected).equivalent).toBe(true);
  });

  it("rejects unsupported characters and overlong input", () => {
    expect(numericEquivalent("process.exit()", "1")).toEqual({ equivalent: false, reason: "格式无法识别" });
    expect(numericEquivalent("1".repeat(81), "1")).toEqual({ equivalent: false, reason: "格式无法识别" });
  });

  it("rejects division by zero", () => {
    expect(numericEquivalent("1/0", "1")).toEqual({ equivalent: false, reason: "格式无法识别" });
  });
});
```

- [ ] **Step 2: Write grader tests**

Create `tests/grading/grader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/domain/types";
import { gradeSubmission } from "@/lib/grading/grader";

const blankQuestion: Question = {
  id: "q-1",
  questionNo: "Q1",
  type: "blank",
  prompt: "填空",
  itemCount: 3,
  options: [],
  items: [
    { index: 0, answer: "1/2", gradingMode: "numeric" },
    { index: 1, answer: "交换律,加法交换律", gradingMode: "text" },
    { index: 2, answer: "3", gradingMode: "numeric" }
  ],
  knowledgePoints: ["加法交换律"],
  difficulty: "基础",
  includeInStats: true,
  explanation: ""
};

describe("gradeSubmission", () => {
  it("grades mixed numeric and text blanks item by item", () => {
    const graded = gradeSubmission(blankQuestion, ["0.5", "加法交换律", "2+1"]);
    expect(graded.items).toEqual([
      { index: 0, correct: true },
      { index: 1, correct: true },
      { index: 2, correct: true }
    ]);
    expect(graded.allCorrect).toBe(true);
  });

  it("grades matching answers item by item", () => {
    const question: Question = {
      ...blankQuestion,
      id: "q-2",
      type: "matching",
      itemCount: 2,
      items: [
        { index: 0, answer: "①-b", gradingMode: "matching" },
        { index: 1, answer: "②-a", gradingMode: "matching" }
      ]
    };
    expect(gradeSubmission(question, ["①-b", "②-c"]).items).toEqual([
      { index: 0, correct: true },
      { index: 1, correct: false }
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/grading/arithmetic.test.ts tests/grading/grader.test.ts
```

Expected: FAIL because grading modules are missing.

- [ ] **Step 4: Implement safe numeric parser**

Create `src/lib/grading/arithmetic.ts` with a tokenizer and recursive descent parser that accepts only numbers, `%`, `+`, `-`, `*`, `x`, `×`, `/`, `÷`, parentheses, and spaces. Normalize `x` and `×` to `*`, `÷` to `/`, reject input longer than 80 characters, and compare results with tolerance `1e-9`. Do not use JavaScript `eval`.

Required exported API:

```ts
export type NumericCompareResult = {
  equivalent: boolean;
  reason?: "格式无法识别";
};

export function numericEquivalent(student: string, expected: string): NumericCompareResult;
```

Implementation requirements:

- `numericEquivalent("40%", "0.4").equivalent` returns `true`.
- `numericEquivalent("1/0", "1")` returns `{ equivalent: false, reason: "格式无法识别" }`.
- `numericEquivalent("process.exit()", "1")` returns `{ equivalent: false, reason: "格式无法识别" }`.
- Empty strings return `{ equivalent: false, reason: "格式无法识别" }`.

- [ ] **Step 5: Implement grader**

Create `src/lib/grading/grader.ts`:

```ts
import type { GradedSubmission, Question, StudentIdentity } from "@/lib/domain/types";
import { numericEquivalent } from "./arithmetic";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function textCorrect(student: string, expected: string): boolean {
  const normalized = normalizeText(student);
  return expected.split(",").some((candidate) => normalizeText(candidate) === normalized);
}

function itemCorrect(mode: string, student: string, expected: string): { correct: boolean; reason?: string } {
  if (mode === "numeric") {
    const result = numericEquivalent(student, expected);
    return { correct: result.equivalent, reason: result.reason };
  }
  if (mode === "matching") return { correct: normalizeText(student) === normalizeText(expected) };
  return { correct: textCorrect(student, expected) };
}

export function gradeSubmission(
  question: Question,
  answers: string[],
  student: StudentIdentity = { seatNo: "", name: "" }
): GradedSubmission {
  const items = question.items.map((item) => {
    const result = itemCorrect(item.gradingMode, answers[item.index] ?? "", item.answer);
    return {
      index: item.index,
      correct: result.correct,
      ...(result.reason ? { reason: result.reason } : {})
    };
  });
  return {
    questionId: question.id,
    student,
    items,
    allCorrect: items.every((item) => item.correct)
  };
}
```

- [ ] **Step 6: Run grading tests**

Run:

```powershell
npm run test -- tests/grading/arithmetic.test.ts tests/grading/grader.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/lib/grading tests/grading
git commit -m "feat: add objective grading engine"
```

## Task 5: SQLite Schema and Repositories

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/repositories.ts`
- Test: `tests/db/repositories.test.ts`

- [ ] **Step 1: Write repository tests**

Create `tests/db/repositories.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "students-tools-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("repositories", () => {
  it("persists a question set, classroom, student and submission", () => {
    const db = openDatabase(join(dir, "test.db"));
    const repos = createRepositories(db);
    const questionSetId = repos.questionSets.create("运算律课堂", [{
      id: "q-1",
      questionNo: "Q1",
      type: "blank",
      prompt: "1/2 = ____",
      itemCount: 1,
      options: [],
      items: [{ index: 0, answer: "0.5", gradingMode: "numeric" }],
      knowledgePoints: ["分数小数互化"],
      difficulty: "基础",
      includeInStats: true,
      explanation: ""
    }]);

    const classroom = repos.classrooms.create(questionSetId, 45);
    repos.classrooms.setStatus(classroom.id, "active");
    const studentId = repos.students.upsert(classroom.id, { seatNo: "01", name: "小明" });
    repos.submissions.save({
      classroomId: classroom.id,
      questionId: "q-1",
      studentId,
      answers: ["1/2"],
      gradedItems: [{ index: 0, correct: true }],
      allCorrect: true
    });

    expect(repos.classrooms.get(classroom.id)?.status).toBe("active");
    expect(repos.submissions.listByClassroom(classroom.id)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/db/repositories.test.ts
```

Expected: FAIL because database modules are missing.

- [ ] **Step 3: Implement schema and client**

Create `src/lib/db/schema.ts` with SQL tables:

```ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
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
  FOREIGN KEY (question_set_id) REFERENCES question_sets(id)
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
  question_id TEXT NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(classroom_id, seat_no),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  graded_items_json TEXT NOT NULL,
  all_correct INTEGER NOT NULL,
  submit_count INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(classroom_id, question_id, student_id),
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL UNIQUE,
  summary_json TEXT NOT NULL,
  ai_text TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);
`;
```

Create `src/lib/db/client.ts`:

```ts
import Database from "better-sqlite3";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { SCHEMA_SQL } from "./schema";

export type AppDatabase = Database.Database;

export function openDatabase(path = process.env.DATABASE_PATH || "./data/app.db"): AppDatabase {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}
```

- [ ] **Step 4: Implement repositories**

Create `src/lib/db/repositories.ts` with:

```ts
import { nanoid } from "nanoid";
import type { ClassroomStatus, GradedItem, Question, StudentIdentity } from "@/lib/domain/types";
import type { AppDatabase } from "./client";

const now = () => new Date().toISOString();
const json = JSON.stringify;
const parse = JSON.parse;

export function createRepositories(db: AppDatabase) {
  return {
    questionSets: {
      create(title: string, questions: Question[]) {
        const id = nanoid();
        const insertSet = db.prepare("INSERT INTO question_sets (id, title, created_at) VALUES (?, ?, ?)");
        const insertQuestion = db.prepare(`INSERT INTO questions
          (id, question_set_id, question_no, type, prompt, item_count, options_json, items_json, knowledge_points_json, difficulty, include_in_stats, explanation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const tx = db.transaction(() => {
          insertSet.run(id, title, now());
          for (const question of questions) {
            insertQuestion.run(
              question.id,
              id,
              question.questionNo,
              question.type,
              question.prompt,
              question.itemCount,
              json(question.options),
              json(question.items),
              json(question.knowledgePoints),
              question.difficulty,
              question.includeInStats ? 1 : 0,
              question.explanation
            );
          }
        });
        tx();
        return id;
      },
      listQuestions(questionSetId: string): Question[] {
        return db.prepare("SELECT * FROM questions WHERE question_set_id = ? ORDER BY question_no").all(questionSetId).map(rowToQuestion);
      }
    },
    classrooms: {
      create(questionSetId: string, expectedCount: number) {
        const id = nanoid();
        const teacherToken = nanoid(32);
        db.prepare(`INSERT INTO classrooms (id, question_set_id, status, expected_count, teacher_token, created_at)
          VALUES (?, ?, 'draft', ?, ?, ?)`).run(id, questionSetId, expectedCount, teacherToken, now());
        return { id, teacherToken, questionSetId, status: "draft" as ClassroomStatus, expectedCount };
      },
      get(id: string) {
        return db.prepare("SELECT * FROM classrooms WHERE id = ?").get(id) as any;
      },
      getByTeacherToken(token: string) {
        return db.prepare("SELECT * FROM classrooms WHERE teacher_token = ?").get(token) as any;
      },
      setStatus(id: string, status: ClassroomStatus) {
        const field = status === "active" ? "started_at" : status === "ended" ? "ended_at" : null;
        if (field) db.prepare(`UPDATE classrooms SET status = ?, ${field} = ? WHERE id = ?`).run(status, now(), id);
        else db.prepare("UPDATE classrooms SET status = ? WHERE id = ?").run(status, id);
      }
    },
    questionTokens: {
      create(classroomId: string, questionId: string) {
        const token = nanoid(32);
        db.prepare("INSERT INTO question_tokens (token, classroom_id, question_id) VALUES (?, ?, ?)").run(token, classroomId, questionId);
        return token;
      },
      get(token: string) {
        return db.prepare("SELECT * FROM question_tokens WHERE token = ?").get(token) as any;
      }
    },
    students: {
      upsert(classroomId: string, student: StudentIdentity) {
        const existing = db.prepare("SELECT * FROM students WHERE classroom_id = ? AND seat_no = ?").get(classroomId, student.seatNo) as any;
        if (existing) {
          db.prepare("UPDATE students SET name = ?, updated_at = ? WHERE id = ?").run(student.name, now(), existing.id);
          return existing.id as string;
        }
        const id = nanoid();
        db.prepare("INSERT INTO students (id, classroom_id, seat_no, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, classroomId, student.seatNo, student.name, now(), now());
        return id;
      },
      listByClassroom(classroomId: string) {
        return db.prepare("SELECT * FROM students WHERE classroom_id = ? ORDER BY seat_no").all(classroomId) as any[];
      }
    },
    submissions: {
      save(input: {
        classroomId: string;
        questionId: string;
        studentId: string;
        answers: string[];
        gradedItems: GradedItem[];
        allCorrect: boolean;
      }) {
        const existing = db.prepare("SELECT submit_count FROM submissions WHERE classroom_id = ? AND question_id = ? AND student_id = ?")
          .get(input.classroomId, input.questionId, input.studentId) as any;
        const submitCount = existing ? existing.submit_count + 1 : 1;
        db.prepare(`INSERT INTO submissions
          (id, classroom_id, question_id, student_id, answers_json, graded_items_json, all_correct, submit_count, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(classroom_id, question_id, student_id) DO UPDATE SET
            answers_json = excluded.answers_json,
            graded_items_json = excluded.graded_items_json,
            all_correct = excluded.all_correct,
            submit_count = excluded.submit_count,
            submitted_at = excluded.submitted_at`)
          .run(nanoid(), input.classroomId, input.questionId, input.studentId, json(input.answers), json(input.gradedItems), input.allCorrect ? 1 : 0, submitCount, now());
      },
      listByClassroom(classroomId: string) {
        return db.prepare("SELECT * FROM submissions WHERE classroom_id = ?").all(classroomId).map((row: any) => ({
          ...row,
          answers: parse(row.answers_json),
          gradedItems: parse(row.graded_items_json),
          allCorrect: row.all_correct === 1
        }));
      }
    }
  };
}

function rowToQuestion(row: any): Question {
  return {
    id: row.id,
    questionNo: row.question_no,
    type: row.type,
    prompt: row.prompt,
    itemCount: row.item_count,
    options: parse(row.options_json),
    items: parse(row.items_json),
    knowledgePoints: parse(row.knowledge_points_json),
    difficulty: row.difficulty,
    includeInStats: row.include_in_stats === 1,
    explanation: row.explanation
  };
}
```

- [ ] **Step 5: Run repository tests**

Run:

```powershell
npm run test -- tests/db/repositories.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/db tests/db
git commit -m "feat: add sqlite repositories"
```

## Task 6: Classroom Service, Tokens, and QR Links

**Files:**
- Create: `src/lib/tokens.ts`
- Create: `src/lib/classroom/service.ts`
- Test: `tests/classroom/service.test.ts`

- [ ] **Step 1: Write service tests**

Create `tests/classroom/service.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import { createClassroomService } from "@/lib/classroom/service";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "students-tools-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("classroom service", () => {
  it("creates question QR links isolated from teacher token", async () => {
    const repos = createRepositories(openDatabase(join(dir, "test.db")));
    const questionSetId = repos.questionSets.create("课堂", [{
      id: "q-1",
      questionNo: "Q1",
      type: "choice",
      prompt: "选择",
      itemCount: 1,
      options: [{ key: "A", text: "A" }, { key: "B", text: "B" }],
      items: [{ index: 0, answer: "A", gradingMode: "text" }],
      knowledgePoints: ["选择"],
      difficulty: "基础",
      includeInStats: true,
      explanation: ""
    }]);
    const service = createClassroomService(repos, "http://localhost:3000");

    const classroom = await service.createClassroom(questionSetId, 40);

    expect(classroom.teacherUrl).toContain("/teacher/report/");
    expect(classroom.questions[0].studentUrl).toContain("/student/");
    expect(classroom.questions[0].studentUrl).not.toContain(classroom.teacherToken);
    expect(classroom.questions[0].qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/classroom/service.test.ts
```

Expected: FAIL because classroom service is missing.

- [ ] **Step 3: Implement token helper and service**

Create `src/lib/tokens.ts`:

```ts
import { nanoid } from "nanoid";

export function createAccessToken(size = 32): string {
  return nanoid(size);
}
```

Create `src/lib/classroom/service.ts`:

```ts
import QRCode from "qrcode";
import type { createRepositories } from "@/lib/db/repositories";

type Repositories = ReturnType<typeof createRepositories>;

export function createClassroomService(repos: Repositories, appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000") {
  return {
    async createClassroom(questionSetId: string, expectedCount: number) {
      const classroom = repos.classrooms.create(questionSetId, expectedCount);
      const questions = repos.questionSets.listQuestions(questionSetId);
      const questionLinks = [];
      for (const question of questions) {
        const token = repos.questionTokens.create(classroom.id, question.id);
        const studentUrl = `${appBaseUrl}/student/${token}`;
        questionLinks.push({
          questionId: question.id,
          questionNo: question.questionNo,
          studentUrl,
          qrDataUrl: await QRCode.toDataURL(studentUrl)
        });
      }
      return {
        ...classroom,
        teacherUrl: `${appBaseUrl}/teacher/report/${classroom.teacherToken}`,
        questions: questionLinks
      };
    },
    startClassroom(classroomId: string) {
      repos.classrooms.setStatus(classroomId, "active");
    },
    endClassroom(classroomId: string) {
      repos.classrooms.setStatus(classroomId, "ended");
    }
  };
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm run test -- tests/classroom/service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/tokens.ts src/lib/classroom tests/classroom
git commit -m "feat: create classroom links and qr codes"
```

## Task 7: Statistics and Layering

**Files:**
- Create: `src/lib/stats/analytics.ts`
- Test: `tests/stats/analytics.test.ts`

- [ ] **Step 1: Write analytics tests**

Create `tests/stats/analytics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/domain/types";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

const questions: Question[] = [
  {
    id: "q-1",
    questionNo: "Q1",
    type: "blank",
    prompt: "",
    itemCount: 2,
    options: [],
    items: [
      { index: 0, answer: "1", gradingMode: "numeric" },
      { index: 1, answer: "2", gradingMode: "numeric" }
    ],
    knowledgePoints: ["加法交换律"],
    difficulty: "基础",
    includeInStats: true,
    explanation: ""
  },
  {
    id: "q-2",
    questionNo: "Q2",
    type: "blank",
    prompt: "",
    itemCount: 1,
    options: [],
    items: [{ index: 0, answer: "3", gradingMode: "numeric" }],
    knowledgePoints: ["乘法分配律"],
    difficulty: "基础",
    includeInStats: true,
    explanation: ""
  }
];

describe("buildClassroomAnalytics", () => {
  it("computes item accuracy, all-correct rate, knowledge points and layers", () => {
    const stats = buildClassroomAnalytics({
      expectedCount: 3,
      questions,
      students: [
        { id: "s1", seatNo: "01", name: "甲" },
        { id: "s2", seatNo: "02", name: "乙" }
      ],
      submissions: [
        { studentId: "s1", questionId: "q-1", gradedItems: [{ index: 0, correct: true }, { index: 1, correct: true }], allCorrect: true },
        { studentId: "s1", questionId: "q-2", gradedItems: [{ index: 0, correct: true }], allCorrect: true },
        { studentId: "s2", questionId: "q-1", gradedItems: [{ index: 0, correct: true }, { index: 1, correct: false }], allCorrect: false }
      ]
    });

    expect(stats.submitRate).toBeCloseTo(2 / 3);
    expect(stats.questions[0].itemAccuracy).toBeCloseTo(3 / 4);
    expect(stats.questions[0].allCorrectRate).toBeCloseTo(1 / 2);
    expect(stats.knowledgePoints).toContainEqual({ name: "加法交换律", accuracy: 0.75, correctItems: 3, totalItems: 4 });
    expect(stats.layers.find((layer) => layer.code === "A")?.count).toBe(1);
    expect(stats.layers.find((layer) => layer.code === "C")?.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test -- tests/stats/analytics.test.ts
```

Expected: FAIL because analytics module is missing.

- [ ] **Step 3: Implement analytics**

Create `src/lib/stats/analytics.ts` with exported function:

```ts
export function buildClassroomAnalytics(input: {
  expectedCount: number;
  questions: Question[];
  students: Array<{ id: string; seatNo: string; name: string }>;
  submissions: Array<{
    studentId: string;
    questionId: string;
    gradedItems: Array<{ index: number; correct: boolean }>;
    allCorrect: boolean;
  }>;
}): ClassroomAnalytics;
```

Required behavior:

- Only questions with `includeInStats=true` affect accuracy, layers, and knowledge points.
- Student personal accuracy equals correct subitems divided by total answered subitems for included questions.
- Layer thresholds use `LAYER_RULES`.
- Question item accuracy uses all submitted subitems.
- Question all-correct rate uses students who submitted that question.
- Knowledge point accuracy uses subitems from all questions bound to that knowledge point.
- `submitRate` equals distinct students with at least one submission divided by `expectedCount`.

- [ ] **Step 4: Run analytics tests**

Run:

```powershell
npm run test -- tests/stats/analytics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/stats tests/stats
git commit -m "feat: compute classroom analytics"
```

## Task 8: Zhipu AI Report Service

**Files:**
- Create: `src/lib/reports/prompt.ts`
- Create: `src/lib/ai/zhipu.ts`
- Test: `tests/ai/zhipu.test.ts`

- [ ] **Step 1: Write AI service tests**

Create `tests/ai/zhipu.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildReportMessages } from "@/lib/reports/prompt";
import { generateZhipuReport } from "@/lib/ai/zhipu";

describe("buildReportMessages", () => {
  it("uses aggregate stats and does not include student-level details", () => {
    const messages = buildReportMessages({
      expectedCount: 40,
      submitRate: 0.8,
      averageAccuracy: 0.72,
      questions: [{ questionNo: "Q1", itemAccuracy: 0.5, allCorrectRate: 0.4 }],
      knowledgePoints: [{ name: "乘法分配律", accuracy: 0.55, correctItems: 11, totalItems: 20 }],
      layers: [{ code: "A", name: "优秀拓展层", count: 5, percentage: 0.125 }]
    } as any);
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain("乘法分配律");
    expect(serialized).not.toContain("seatNo");
    expect(serialized).not.toContain("studentId");
  });
});

describe("generateZhipuReport", () => {
  it("calls chat completions and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "AI 诊断" } }] })
    });
    const content = await generateZhipuReport({
      apiKey: "secret",
      url: "https://example.test/chat/completions",
      model: "GLM-4-Flash-250414",
      messages: [{ role: "user", content: "统计" }],
      fetchImpl: fetchMock as any,
      retryDelayMs: 1
    });

    expect(content).toBe("AI 诊断");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
  });

  it("retries 429 twice then returns failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "limited" });
    await expect(generateZhipuReport({
      apiKey: "secret",
      url: "https://example.test/chat/completions",
      model: "GLM-4-Flash-250414",
      messages: [{ role: "user", content: "统计" }],
      fetchImpl: fetchMock as any,
      retryDelayMs: 1
    })).rejects.toThrow("智谱 API 调用失败: 429");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/ai/zhipu.test.ts
```

Expected: FAIL because prompt and Zhipu modules are missing.

- [ ] **Step 3: Implement report prompt**

Create `src/lib/reports/prompt.ts`:

```ts
export function buildReportMessages(summary: unknown) {
  return [
    {
      role: "system" as const,
      content: [
        "你是小学数学老师的学情分析助手。",
        "只能基于用户提供的汇总统计生成诊断。",
        "不得编造学生、题目、知识点或百分比。",
        "必须区分数据结论和教学建议。",
        "如果样本不足，明确提示样本不足。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: `请根据以下课堂汇总统计生成学情分析报告：\n${JSON.stringify(summary, null, 2)}`
    }
  ];
}
```

- [ ] **Step 4: Implement Zhipu client**

Create `src/lib/ai/zhipu.ts`:

```ts
type Message = { role: "system" | "user" | "assistant"; content: string };

export async function generateZhipuReport(input: {
  apiKey: string;
  url: string;
  model: string;
  messages: Message[];
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retryDelayMs = input.retryDelayMs ?? 1500;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: 0.3,
        max_tokens: 1800,
        stream: false
      })
    });
    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    lastStatus = response.status;
    if (response.status !== 429 || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  throw new Error(`智谱 API 调用失败: ${lastStatus}`);
}

export function readZhipuConfigFromEnv() {
  return {
    apiKey: process.env.ZHIPU_API_KEY || "",
    url: process.env.ZHIPU_CHAT_COMPLETIONS_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: process.env.ZHIPU_MODEL || "GLM-4-Flash-250414"
  };
}
```

- [ ] **Step 5: Run AI tests**

Run:

```powershell
npm run test -- tests/ai/zhipu.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/ai src/lib/reports tests/ai
git commit -m "feat: add zhipu report client"
```

## Task 9: API Routes

**Files:**
- Create API route files under `src/app/api/...`
- Modify: `src/lib/db/client.ts`

- [ ] **Step 1: Add shared database singleton**

Modify `src/lib/db/client.ts` to export:

```ts
let singleton: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!singleton) singleton = openDatabase();
  return singleton;
}
```

- [ ] **Step 2: Implement import route**

Create `src/app/api/question-sets/import/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import { importQuestionsFromWorkbook } from "@/lib/excel/importer";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "课堂题目");
  if (!(file instanceof File)) return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const imported = await importQuestionsFromWorkbook(buffer);
  if (imported.errors.length > 0) return NextResponse.json(imported, { status: 400 });
  const repos = createRepositories(getDatabase());
  const questionSetId = repos.questionSets.create(title, imported.questions);
  return NextResponse.json({ questionSetId, questions: imported.questions });
}
```

- [ ] **Step 3: Implement classroom creation and status routes**

Create:

- `src/app/api/classrooms/route.ts`
- `src/app/api/classrooms/[classroomId]/start/route.ts`
- `src/app/api/classrooms/[classroomId]/end/route.ts`

Required behavior:

- `POST /api/classrooms` accepts `{ questionSetId, expectedCount }`, creates a classroom, question tokens, QR data URLs, and returns teacher URL plus per-question student URLs.
- `POST /api/classrooms/[classroomId]/start` sets status to `active`.
- `POST /api/classrooms/[classroomId]/end` sets status to `ended`.

- [ ] **Step 4: Implement student question and submit routes**

Create:

- `src/app/api/student/questions/[token]/route.ts`
- `src/app/api/student/questions/[token]/submit/route.ts`

Required behavior:

- GET by token returns question prompt, type, options, item count, and classroom status.
- POST by token requires `{ name, seatNo, answers }`.
- Reject submission if classroom status is not `active`.
- Upsert student by `classroomId + seatNo`.
- Grade answers using `gradeSubmission`.
- Save submission, preserving latest answer and submit count.

- [ ] **Step 5: Implement teacher stats and report routes**

Create:

- `src/app/api/teacher/[teacherToken]/stats/route.ts`
- `src/app/api/teacher/[teacherToken]/report/route.ts`

Required behavior:

- Stats route validates teacher token, loads questions/students/submissions, calls `buildClassroomAnalytics`, and returns JSON.
- Report route validates teacher token, builds analytics, builds AI messages, calls Zhipu when `ZHIPU_API_KEY` exists, and returns `{ summary, aiText, aiStatus }`.
- If Zhipu fails, return status 200 with `{ summary, aiText: "", aiStatus: "failed" }`.

- [ ] **Step 6: Add API route smoke tests through service-level tests**

Run all existing unit tests:

```powershell
npm run test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/app/api src/lib/db/client.ts
git commit -m "feat: add classroom api routes"
```

## Task 10: Teacher UI

**Files:**
- Create: `src/app/teacher/page.tsx`
- Create: `src/app/teacher/classrooms/[classroomId]/page.tsx`
- Create: `src/app/teacher/classrooms/[classroomId]/projector/page.tsx`
- Create: `src/app/teacher/report/[teacherToken]/page.tsx`
- Create: `src/components/QuestionEditor.tsx`
- Create: `src/components/QrPanel.tsx`
- Create: `src/components/ClassroomDashboard.tsx`
- Create: `src/components/AnalysisReport.tsx`

- [ ] **Step 1: Implement teacher upload page**

`src/app/teacher/page.tsx` must show:

- Title: `课堂题目导入`
- File input accepting `.xlsx` with `data-testid="excel-file-input"`
- Title input with `data-testid="classroom-title-input"`
- Expected student count input with `data-testid="expected-count-input"`
- Import button with `data-testid="import-button"`
- After import, create classroom by calling `/api/classrooms`
- Navigate to `/teacher/classrooms/{classroomId}`

- [ ] **Step 2: Implement classroom dashboard page**

`src/app/teacher/classrooms/[classroomId]/page.tsx` must show:

- Classroom status controls: start and end.
- Link to projector page.
- Link to report page using teacher token returned by create classroom.
- A polling dashboard component that refreshes stats every 3 seconds.
- Start button must use `data-testid="start-classroom-button"`.
- Submission count element must use `data-testid="submitted-count"`.
- First question student URL link must use `data-testid="student-link-Q1"`.
- Teacher report link must use `data-testid="teacher-report-link"`.

- [ ] **Step 3: Implement projector page**

`src/app/teacher/classrooms/[classroomId]/projector/page.tsx` must show:

- Question list.
- Current selected question.
- QR image for the selected question.
- Student URL text for fallback copying.
- Current question QR image must use `data-testid="current-question-qr"`.

- [ ] **Step 4: Implement report page**

`src/app/teacher/report/[teacherToken]/page.tsx` must show:

- Student layer distribution.
- Knowledge point bars.
- Question accuracy table.
- Button to generate AI report.
- AI report text or failure notice.
- Knowledge point rows must use `data-testid="knowledge-point-{知识点名称}"`, for example `data-testid="knowledge-point-分数小数互化"`.
- AI report button must use `data-testid="generate-ai-report-button"`.

- [ ] **Step 5: Verify UI build**

Run:

```powershell
npm run build
```

Expected: Next build succeeds.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/app/teacher src/components
git commit -m "feat: add teacher workflow ui"
```

## Task 11: Student UI

**Files:**
- Create: `src/app/student/[token]/page.tsx`
- Create: `src/components/QuestionRenderer.tsx`

- [ ] **Step 1: Implement question renderer**

`QuestionRenderer` must render:

- Choice buttons for choice questions.
- Correct/incorrect buttons for judgement questions.
- One input per blank item for blank questions.
- One select per matching item for matching questions.

It must return an `answers: string[]` array in item order.

Renderer test IDs:

- Blank input index 0: `data-testid="answer-input-0"`.
- Choice A button: `data-testid="choice-A"`.
- Matching select index 0: `data-testid="matching-select-0"`.

- [ ] **Step 2: Implement student page**

`src/app/student/[token]/page.tsx` must:

- Fetch question details from `/api/student/questions/{token}`.
- Read `studentIdentity` from `localStorage`.
- Ask for name and seat number if missing.
- Persist identity in `localStorage`.
- Submit answers to `/api/student/questions/{token}/submit`.
- Show submitted state and whether the classroom is ended.
- Student name input must use `data-testid="student-name-input"`.
- Student seat number input must use `data-testid="student-seat-input"`.
- Submit button must use `data-testid="submit-answer-button"`.
- Submitted success state must include the visible text `提交成功`.

- [ ] **Step 3: Verify UI build**

Run:

```powershell
npm run build
```

Expected: Next build succeeds.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/student src/components/QuestionRenderer.tsx
git commit -m "feat: add student answering ui"
```

## Task 12: End-to-End Demo and Final Verification

**Files:**
- Create: `e2e/classroom-flow.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write Playwright classroom flow**

Create `e2e/classroom-flow.spec.ts`:

```ts
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";

async function createWorkbookFixture() {
  const dir = join(tmpdir(), "students-tools-e2e");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `question-template-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题目");
  const headers = [
    "题号", "题型", "题干", "小题/空数量", "选项A", "选项B", "选项C", "选项D",
    "标准答案", "答案分隔符", "判分方式", "知识点", "难度层级", "是否纳入统计", "解析"
  ];
  sheet.addRow(headers);
  sheet.addRow([
    "Q1",
    "填空",
    "1/2 = ____",
    1,
    "",
    "",
    "",
    "",
    "0.5",
    "|",
    "数值等价",
    "分数小数互化",
    "基础",
    "是",
    "分数和小数可以互化"
  ]);
  sheet.addRow([
    "Q2",
    "选择",
    "哪个是乘法交换律？",
    1,
    "a×b=b×a",
    "a×(b+c)=a×b+a×c",
    "a+b=b+a",
    "a-b=b-a",
    "A",
    "|",
    "文本匹配",
    "乘法交换律",
    "基础",
    "是",
    "交换两个因数的位置，积不变"
  ]);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

test("teacher imports excel and student submits answer", async ({ page, context }) => {
  const filePath = await createWorkbookFixture();

  await page.goto("/teacher");
  await expect(page.getByText("课堂题目导入")).toBeVisible();
  await page.getByTestId("classroom-title-input").fill("E2E 运算律课堂");
  await page.getByTestId("expected-count-input").fill("1");
  await page.getByTestId("excel-file-input").setInputFiles(filePath);
  await page.getByTestId("import-button").click();

  await expect(page.getByText("课堂控制台")).toBeVisible();
  await page.getByTestId("start-classroom-button").click();
  const studentHref = await page.getByTestId("student-link-Q1").getAttribute("href");
  expect(studentHref).toBeTruthy();

  const studentPage = await context.newPage();
  await studentPage.goto(studentHref!);
  await studentPage.getByTestId("student-name-input").fill("小明");
  await studentPage.getByTestId("student-seat-input").fill("01");
  await studentPage.getByTestId("answer-input-0").fill("1/2");
  await studentPage.getByTestId("submit-answer-button").click();
  await expect(studentPage.getByText("提交成功")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("submitted-count")).toContainText("1");

  const reportHref = await page.getByTestId("teacher-report-link").getAttribute("href");
  expect(reportHref).toBeTruthy();
  await page.goto(reportHref!);
  await expect(page.getByTestId("knowledge-point-分数小数互化")).toBeVisible();
});
```

- [ ] **Step 2: Add README**

Create `README.md`:

```md
# AI 学情分析课堂工具

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`ZHIPU_API_KEY` must be set in `.env.local` only. Do not commit real API keys.

## Test

```powershell
npm run test
npm run build
npm run e2e
```

## First-Version Flow

1. Open `/teacher`.
2. Upload the Excel template.
3. Create and start a classroom.
4. Show per-question QR codes.
5. Students open `/student/{token}`, enter name and seat number, and submit answers.
6. Teacher opens the report page to view statistics and generate AI diagnosis.
```

- [ ] **Step 3: Run final checks**

Run:

```powershell
npm run test
npm run build
npm run e2e
Select-String -Path '.next\\**\\*' -Pattern $env:ZHIPU_API_KEY -SimpleMatch -ErrorAction SilentlyContinue
```

Expected:

- Unit tests pass.
- Build passes.
- E2E passes.
- The API key scan returns no matches. If `ZHIPU_API_KEY` is empty, also scan for any real key string used during local testing and confirm no matches.

- [ ] **Step 4: Commit**

Run:

```powershell
git add README.md e2e
git commit -m "test: add classroom flow verification"
```

## Self-Review Checklist

- Spec coverage:
  - Excel import: Task 3, Task 9, Task 10.
  - Student identity: Task 5, Task 9, Task 11.
  - QR token separation: Task 6, Task 9, Task 12.
  - Objective grading: Task 4, Task 9, Task 11.
  - Numeric equivalence: Task 4.
  - Real-time dashboard within 3 seconds: Task 10 polling.
  - Student layers and knowledge points: Task 7, Task 10.
  - Zhipu AI report and failure fallback: Task 8, Task 9, Task 10.
  - API key secrecy: Task 1, Task 8, Task 12.
- Placeholder scan: No task may contain placeholder markers or an undefined module path.
- Type consistency:
  - Use `Question`, `QuestionItem`, `StudentIdentity`, and `GradedSubmission` from `src/lib/domain/types.ts`.
  - Use `numericEquivalent` only from `src/lib/grading/arithmetic.ts`.
  - Use `gradeSubmission` only from `src/lib/grading/grader.ts`.
  - Use `buildClassroomAnalytics` only from `src/lib/stats/analytics.ts`.
  - Use `generateZhipuReport` only from `src/lib/ai/zhipu.ts`.
