"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { normalizeAnswers, type StudentQuestion } from "@/components/QuestionRenderer";
import StudentAnswerLayout from "@/components/StudentAnswerLayout";
import {
  createLoadedQuestionState,
  emptyStudentIdentity,
  getBrowserStudentStorage,
  loadStudentIdentity,
  readError,
  readJson,
  saveStudentIdentity,
  submitStudentAnswers,
  type StudentIdentity,
  type SubmitResult,
} from "@/components/studentPageModel";

const questionTypes = ["choice", "judgement", "blank", "matching"];
const classroomStatuses = ["draft", "active", "ended"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function statusText(status: StudentQuestion["status"]) {
  if (status === "active") {
    return "课堂进行中";
  }

  if (status === "ended") {
    return "课堂已结束";
  }

  return "课堂未开始";
}

export default function StudentPage() {
  const params = useParams<{ token?: string | string[] }>();
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : (tokenParam ?? "");
  const [identity, setIdentity] = useState<StudentIdentity>(emptyStudentIdentity);
  const [question, setQuestion] = useState<StudentQuestion | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    setIdentity(loadStudentIdentity(getBrowserStudentStorage()));
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
          const loadedState = createLoadedQuestionState(body);
          setQuestion(loadedState.question);
          setAnswers(loadedState.answers);
          setSubmitResult(loadedState.submitResult);
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
    setSubmitResult(null);
    setIsSubmitting(true);
    setAnswers(orderedAnswers);

    try {
      saveStudentIdentity(getBrowserStudentStorage(), trimmedIdentity);
      const result = await submitStudentAnswers({
        token,
        identity: trimmedIdentity,
        answers: orderedAnswers,
      });

      if (result.status === "error") {
        setFormError(result.error);
        return;
      }

      setIdentity(trimmedIdentity);
      setSubmitResult(result.submission);
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

      <StudentAnswerLayout
        question={question}
        identity={identity}
        answers={answers}
        canSubmit={canSubmit}
        isEnded={isEnded}
        isDraft={question.status === "draft"}
        isSubmitting={isSubmitting}
        formError={formError}
        submitResult={submitResult}
        onSubmit={handleSubmit}
        onIdentityChange={setIdentity}
        onAnswersChange={updateAnswers}
      />
    </main>
  );
}
