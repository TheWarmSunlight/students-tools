"use client";

import type { FormEventHandler } from "react";
import QuestionRenderer, { type StudentQuestion } from "@/components/QuestionRenderer";
import type { StudentIdentity, SubmitResult } from "@/components/studentPageModel";

type StudentAnswerLayoutProps = {
  question: StudentQuestion;
  identity: StudentIdentity;
  answers: string[];
  canSubmit: boolean;
  isEnded: boolean;
  isDraft: boolean;
  isSubmitting: boolean;
  formError: string;
  submitResult: SubmitResult | null;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onIdentityChange: (identity: StudentIdentity) => void;
  onAnswersChange: (answers: string[]) => void;
};

function submitButtonText({
  isSubmitting,
  submitResult,
}: Pick<StudentAnswerLayoutProps, "isSubmitting" | "submitResult">) {
  if (isSubmitting) {
    return "提交中";
  }

  return submitResult ? "再次提交" : "提交答案";
}

export default function StudentAnswerLayout({
  question,
  identity,
  answers,
  canSubmit,
  isEnded,
  isDraft,
  isSubmitting,
  formError,
  submitResult,
  onSubmit,
  onIdentityChange,
  onAnswersChange,
}: StudentAnswerLayoutProps) {
  return (
    <form className="studentWorkspace" onSubmit={onSubmit}>
      <section
        className="studentQuestionPane"
        data-testid="student-question-pane"
        aria-label="题目内容"
      >
        <div className="questionPrompt">{question.prompt}</div>
      </section>

      <section
        className="studentAnswerPane"
        data-testid="student-answer-pane"
        aria-label="作答区域"
      >
        <section className="identityGrid" aria-label="学生信息">
          <label className="formField">
            <span>姓名</span>
            <input
              data-testid="student-name-input"
              type="text"
              value={identity.name}
              placeholder="请输入姓名"
              onChange={(event) =>
                onIdentityChange({ ...identity, name: event.currentTarget.value })
              }
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
              onChange={(event) =>
                onIdentityChange({ ...identity, seatNo: event.currentTarget.value })
              }
            />
          </label>
        </section>

        <QuestionRenderer
          question={question}
          answers={answers}
          onAnswersChange={onAnswersChange}
          disabled={!canSubmit}
        />

        {isEnded ? <p className="noticeText">课堂已结束，当前无法提交。</p> : null}
        {isDraft ? <p className="noticeText">课堂未开始，请等待老师开始。</p> : null}
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
            {submitButtonText({ isSubmitting, submitResult })}
          </button>
        </div>
      </section>
    </form>
  );
}
