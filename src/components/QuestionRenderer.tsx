"use client";

import type { ClassroomStatus, QuestionOption, QuestionType } from "@/lib/domain/types";

export type StudentQuestion = {
  questionId: string;
  questionNo: string;
  prompt: string;
  type: QuestionType;
  options: QuestionOption[];
  itemCount: number;
  status: ClassroomStatus;
};

type QuestionRendererProps = {
  question: Pick<StudentQuestion, "type" | "options" | "itemCount">;
  answers: string[];
  onAnswersChange: (answers: string[]) => void;
  disabled?: boolean;
};

type JudgementOption = {
  value: "正确" | "错误";
  label: string;
  testId: string;
};

const judgementOptions: JudgementOption[] = [
  { value: "正确", label: "正确", testId: "judgement-correct" },
  { value: "错误", label: "错误", testId: "judgement-incorrect" },
];

export function createEmptyAnswers(itemCount: number): string[] {
  const length = Number.isInteger(itemCount) && itemCount > 0 ? itemCount : 0;
  return Array.from({ length }, () => "");
}

export function normalizeAnswers(answers: string[], itemCount: number): string[] {
  const normalized = createEmptyAnswers(itemCount);

  for (let index = 0; index < normalized.length; index += 1) {
    normalized[index] = answers[index] ?? "";
  }

  return normalized;
}

export function updateAnswerAtIndex(
  answers: string[],
  itemCount: number,
  index: number,
  value: string,
): string[] {
  const nextAnswers = normalizeAnswers(answers, itemCount);

  if (index >= 0 && index < nextAnswers.length) {
    nextAnswers[index] = value;
  }

  return nextAnswers;
}

function selectedClassName(isSelected: boolean) {
  return isSelected ? "answerOption selected" : "answerOption";
}

export default function QuestionRenderer({
  question,
  answers,
  onAnswersChange,
  disabled = false,
}: QuestionRendererProps) {
  const currentAnswers = normalizeAnswers(answers, question.itemCount);

  function updateAnswer(index: number, value: string) {
    onAnswersChange(updateAnswerAtIndex(currentAnswers, question.itemCount, index, value));
  }

  if (question.type === "choice") {
    return (
      <div className="questionRenderer">
        <div className="choiceGrid" role="group" aria-label="选择答案">
          {question.options.map((option) => (
            <button
              key={option.key}
              data-testid={`choice-${option.key}`}
              className={selectedClassName(currentAnswers[0] === option.key)}
              type="button"
              aria-pressed={currentAnswers[0] === option.key}
              disabled={disabled}
              onClick={() => updateAnswer(0, option.key)}
            >
              <strong>{option.key}</strong>
              <span>{option.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "judgement") {
    return (
      <div className="questionRenderer">
        <div className="choiceGrid twoColumns" role="group" aria-label="判断答案">
          {judgementOptions.map((option) => (
            <button
              key={option.value}
              data-testid={option.testId}
              className={selectedClassName(currentAnswers[0] === option.value)}
              type="button"
              aria-pressed={currentAnswers[0] === option.value}
              disabled={disabled}
              onClick={() => updateAnswer(0, option.value)}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "matching") {
    return (
      <div className="questionRenderer answerList">
        {currentAnswers.map((answer, index) => (
          <label className="studentAnswerField" key={index}>
            <span>第 {index + 1} 项</span>
            <select
              data-testid={`matching-select-${index}`}
              value={answer}
              disabled={disabled}
              onChange={(event) => updateAnswer(index, event.currentTarget.value)}
            >
              <option value="">请选择匹配项</option>
              {question.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}. {option.text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="questionRenderer answerList">
      {currentAnswers.map((answer, index) => (
        <label className="studentAnswerField" key={index}>
          <span>第 {index + 1} 空</span>
          <input
            data-testid={`answer-input-${index}`}
            type="text"
            value={answer}
            disabled={disabled}
            autoComplete="off"
            inputMode="text"
            onChange={(event) => updateAnswer(index, event.currentTarget.value)}
          />
        </label>
      ))}
    </div>
  );
}
