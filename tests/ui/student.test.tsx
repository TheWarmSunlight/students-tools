import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuestionRenderer, {
  createEmptyAnswers,
  updateMatchingAnswerAtIndex,
  updateAnswerAtIndex,
  type StudentQuestion,
} from "@/components/QuestionRenderer";

function question(overrides: Partial<StudentQuestion>): StudentQuestion {
  return {
    questionId: "q-1",
    questionNo: "Q1",
    prompt: "计算并作答",
    type: "blank",
    options: [],
    itemCount: 1,
    status: "active",
    ...overrides,
  };
}

describe("student UI components", () => {
  it("renders answer controls for blank, choice, and matching questions", () => {
    const noop = () => undefined;
    const blankHtml = renderToStaticMarkup(
      <QuestionRenderer
        question={question({ type: "blank", itemCount: 2 })}
        answers={["", ""]}
        onAnswersChange={noop}
      />,
    );
    const choiceHtml = renderToStaticMarkup(
      <QuestionRenderer
        question={question({
          type: "choice",
          options: [
            { key: "A", text: "1/2" },
            { key: "B", text: "2/3" },
          ],
        })}
        answers={[""]}
        onAnswersChange={noop}
      />,
    );
    const matchingHtml = renderToStaticMarkup(
      <QuestionRenderer
        question={question({
          type: "matching",
          itemCount: 2,
          options: [
            { key: "A", text: "加法交换律" },
            { key: "B", text: "乘法交换律" },
          ],
        })}
        answers={["", ""]}
        onAnswersChange={noop}
      />,
    );

    expect(blankHtml).toContain('data-testid="answer-input-0"');
    expect(choiceHtml).toContain('data-testid="choice-A"');
    expect(matchingHtml).toContain('data-testid="matching-select-0"');
  });

  it("renders judgement buttons for correct and incorrect answers", () => {
    const html = renderToStaticMarkup(
      <QuestionRenderer
        question={question({ type: "judgement" })}
        answers={[""]}
        onAnswersChange={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="judgement-correct"');
    expect(html).toContain('data-testid="judgement-incorrect"');
    expect(html).toContain("正确");
    expect(html).toContain("错误");
  });

  it("keeps answers arrays in item order when an item changes", () => {
    const initial = createEmptyAnswers(3);
    const withSecond = updateAnswerAtIndex(initial, 3, 1, "B");
    const withFirst = updateAnswerAtIndex(withSecond, 3, 0, "A");
    const withThird = updateAnswerAtIndex(withFirst, 3, 2, "C");

    expect(withThird).toEqual(["A", "B", "C"]);
    expect(initial).toEqual(["", "", ""]);
  });

  it("stores matching answers as full ordered matching segments", () => {
    const initial = createEmptyAnswers(2);
    const updated = updateMatchingAnswerAtIndex(initial, 2, 0, "A");
    const twentyFirst = updateMatchingAnswerAtIndex(createEmptyAnswers(21), 21, 20, "C");

    expect(updated).toEqual(["①-A", ""]);
    expect(updateMatchingAnswerAtIndex(createEmptyAnswers(20), 20, 19, "B")[19]).toBe("⑳-B");
    expect(twentyFirst[20]).toBe("21-C");
    expect(updated[0]).not.toBe("A");
  });
});
