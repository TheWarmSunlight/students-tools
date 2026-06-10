import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

async function createWorkbookFixture() {
  const dir = join(tmpdir(), "students-tools-e2e");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `question-template-${Date.now()}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题目");
  const headers = [
    "题号",
    "题型",
    "题干",
    "小题/空数量",
    "选项A",
    "选项B",
    "选项C",
    "选项D",
    "标准答案",
    "答案分隔符",
    "判分方式",
    "知识点",
    "难度层级",
    "是否纳入统计",
    "解析",
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
    "分数和小数可以互化",
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
    "交换两个因数的位置，积不变",
  ]);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

function requireBox(
  box: { x: number; y: number; width: number; height: number } | null,
  label: string,
) {
  expect(box, `${label} should be visible`).not.toBeNull();
  return box as { x: number; y: number; width: number; height: number };
}

test("teacher imports excel and student submits answer", async ({ page, context }) => {
  const filePath = await createWorkbookFixture();

  await page.goto("/teacher");
  await expect(page.getByText("课堂题目导入")).toBeVisible();
  await page.getByTestId("classroom-title-input").fill("E2E 运算律课堂");
  await page.getByTestId("expected-count-input").fill("1");
  await page.getByTestId("excel-file-input").setInputFiles(filePath);
  await page.getByTestId("import-button").click();

  await expect(page.getByText("课堂实时学情")).toBeVisible();
  await page.getByTestId("start-classroom-button").click();

  const studentHref = await page.getByTestId("student-link-Q1").getAttribute("href");
  expect(studentHref).toBeTruthy();
  const studentPath = new URL(studentHref!).pathname;

  const studentPage = await context.newPage();
  await studentPage.goto(studentPath);
  const desktopQuestionBox = requireBox(
    await studentPage.getByTestId("student-question-pane").boundingBox(),
    "desktop question pane",
  );
  const desktopAnswerBox = requireBox(
    await studentPage.getByTestId("student-answer-pane").boundingBox(),
    "desktop answer pane",
  );
  expect(desktopQuestionBox.x + desktopQuestionBox.width).toBeLessThan(desktopAnswerBox.x);

  const mobileStudentPage = await context.newPage();
  await mobileStudentPage.setViewportSize({ width: 390, height: 900 });
  await mobileStudentPage.goto(studentPath);
  const mobileQuestionBox = requireBox(
    await mobileStudentPage.getByTestId("student-question-pane").boundingBox(),
    "mobile question pane",
  );
  const mobileAnswerBox = requireBox(
    await mobileStudentPage.getByTestId("student-answer-pane").boundingBox(),
    "mobile answer pane",
  );
  expect(mobileQuestionBox.y + mobileQuestionBox.height).toBeLessThanOrEqual(
    mobileAnswerBox.y,
  );
  await mobileStudentPage.close();

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
