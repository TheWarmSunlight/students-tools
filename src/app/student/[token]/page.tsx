"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QuestionRenderer, {
  createEmptyAnswers,
  normalizeAnswers,
  type StudentQuestion,
} from "@/components/QuestionRenderer";

type StudentIdentity = {
  name: string;
  seatNo: string;
};

type SubmitResult = {
  questionId: string;
  allCorrect: boolean;
  gradedItems: Array<{ index: number; correct: boolean; reason?: string }>;
  submitCount: number;
  submittedAt: string;
};

const STUDENT_IDENTITY_KEY = "studentIdentity";
const emptyIdentity: StudentIdentity = { name: "", seatNo: "" };
const questionTypes = ["choice", "judgement", "blank", "matching"];
const classroomStatuses = ["draft", "active", "ended"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isStringOption(value: unknown): value is { key: string; text: string } {
  return isRecord(value) && typeof value.key === "string" && typeof value.text === "string";
}

function isStudentQuestion(value: unknown): value is StudentQuestion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.questionId === "string" &&
    typeof value.questionNo === "string" &&
    typeof value.prompt === "string" &&
    typeof value.type === "string" &&
    questionTypes.includes(value.type) &&
    Array.isArray(value.options) &&
    value.options.every(isStringOption) &&
    Number.isInteger(value.itemCount) &&
    typeof value.status === "string" &&
    classroomStatuses.includes(value.status)
  );
}

function loadStudentIdentity(): StudentIdentity {
  if (typeof window === "undefined") {
    return emptyIdentity;
  }

  const raw = window.localStorage.getItem(STUDENT_IDENTITY_KEY);
  if (!raw) {
    return emptyIdentity;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isRecord(parsed) &&
      typeof parsed.name === "string" &&
      typeof parsed.seatNo === "string"
    ) {
      return { name: parsed.name, seatNo: parsed.seatNo };
    }
  } catch {
    return emptyIdentity;
  }

  return emptyIdentity;
}

function saveStudentIdentity(identity: StudentIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STUDENT_IDENTITY_KEY, JSON.stringify(identity));
}

function statusText(status: StudentQuestion["status"]) {
  if (status === "active") {
    return "课堂进行中";
  }

  if (status === "ended") {
    return "课堂已结束";
  }

  return "课堂未开始";
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export default function StudentPage() {
  const params = useParams<{ token?: string | string[] }>();
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : (tokenParam ?? "");
  const [identity, setIdentity] = useState<StudentIdentity>(emptyIdentity);
  const [question, setQuestion] = useState<StudentQuestion | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    setIdentity(loadStudentIdentity());
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadQuestion() {
      if (!token) {
        setIsLoading(false);
        setLoadError("题目链接无效");
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch(`/api/student/questions/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const body = await readJson(response);

        if (!response.ok) {
          throw new Error(readError(body, "题目读取失败"));
        }

        if (!isStudentQuestion(body)) {
          throw new Error("题目数据无效");
        }

        if (isCurrent) {
          setQuestion(body);
          setAnswers(createEmptyAnswers(body.itemCount));
        }
      } catch (caught) {
        if (isCurrent) {
          setLoadError(caught instanceof Error ? caught.message : "题目读取失败");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadQuestion();

    return () => {
      isCurrent = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question) {
      return;
    }

    const trimmedIdentity = {
      name: identity.name.trim(),
      seatNo: identity.seatNo.trim(),
    };

    if (!trimmedIdentity.name || !trimmedIdentity.seatNo) {
      setFormError("请填写姓名和座号");
      return;
    }

    const orderedAnswers = normalizeAnswers(answers, question.itemCount);
    setFormError("");
    setIsSubmitting(true);
    setAnswers(orderedAnswers);
    saveStudentIdentity(trimmedIdentity);

    try {
      const response = await fetch(`/api/student/questions/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedIdentity.name,
          seatNo: trimmedIdentity.seatNo,
          answers: orderedAnswers,
        }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body, "提交失败，请稍后重试"));
      }

      setIdentity(trimmedIdentity);
      setSubmitResult(body as SubmitResult);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "提交失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateAnswers(nextAnswers: string[]) {
    setAnswers(nextAnswers);
    setSubmitResult(null);
  }

  if (isLoading) {
    return (
      <main className="studentShell">
        <section className="studentCard">
          <p className="mutedText">正在读取题目...</p>
        </section>
      </main>
    );
  }

  if (loadError || !question) {
    return (
      <main className="studentShell">
        <section className="studentCard">
          <h1>题目无法打开</h1>
          <p className="errorText">{loadError || "题目读取失败"}</p>
        </section>
      </main>
    );
  }

  const canSubmit = question.status === "active" && !isSubmitting;
  const isEnded = question.status === "ended";
  const statusClass = `statusBadge ${question.status}`;

  return (
    <main className="studentShell">
      <header className="studentHeader">
        <div>
          <p className="teacherEyebrow">学生端答题</p>
          <h1>{question.questionNo}</h1>
        </div>
        <span className={statusClass}>{statusText(question.status)}</span>
      </header>

      <form className="studentCard" onSubmit={handleSubmit}>
        <section className="identityGrid" aria-label="学生信息">
          <label className="formField">
            <span>姓名</span>
            <input
              data-testid="student-name-input"
              type="text"
              value={identity.name}
              placeholder="请输入姓名"
              onChange={(event) => setIdentity({ ...identity, name: event.currentTarget.value })}
            />
          </label>
          <label className="formField">
            <span>座号</span>
            <input
              data-testid="student-seat-input"
              type="text"
              value={identity.seatNo}
              placeholder="例如 01"
              inputMode="numeric"
              onChange={(event) => setIdentity({ ...identity, seatNo: event.currentTarget.value })}
            />
          </label>
        </section>

        <section className="questionBlock">
          <div className="questionPrompt">{question.prompt}</div>
          <QuestionRenderer
            question={question}
            answers={answers}
            onAnswersChange={updateAnswers}
            disabled={!canSubmit}
          />
        </section>

        {isEnded ? <p className="noticeText">课堂已结束，当前无法提交。</p> : null}
        {question.status === "draft" ? <p className="noticeText">课堂未开始，请等待老师开始。</p> : null}
        {formError ? <p className="errorText">{formError}</p> : null}
        {submitResult ? (
          <div className="submittedState" role="status">
            <strong>提交成功</strong>
            <span>{submitResult.allCorrect ? "全部正确" : "已提交"}</span>
            <span>第 {submitResult.submitCount} 次提交</span>
          </div>
        ) : null}

        <div className="actionRow">
          <button
            data-testid="submit-answer-button"
            className="primaryButton largeButton"
            type="submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? "提交中" : submitResult ? "再次提交" : "提交答案"}
          </button>
        </div>
      </form>
    </main>
  );
}
