import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { importQuestionsFromWorkbook } from "@/lib/excel/importer";

const DEFAULT_HEADERS = [
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

async function workbookBuffer(
  rows: Record<string, string | number>[],
  headers = DEFAULT_HEADERS,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题目");
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
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "7/8",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "加法交换律|加法结合律",
        难度层级: "基础",
        是否纳入统计: "是",
        解析: "凑整",
      },
      {
        题号: "Q2",
        题型: "配对",
        题干: "配对",
        "小题/空数量": 2,
        标准答案: "①-b|②-a",
        答案分隔符: "|",
        判分方式: "配对匹配",
        知识点: "乘法分配律",
        难度层级: "基础",
        是否纳入统计: "是",
        解析: "",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].items).toEqual([
      { index: 0, answer: "7/8", gradingMode: "numeric" },
    ]);
    expect(result.questions[0].knowledgePoints).toEqual(["加法交换律", "加法结合律"]);
    expect(result.questions[1].items).toEqual([
      { index: 0, answer: "①-b", gradingMode: "matching" },
      { index: 1, answer: "②-a", gradingMode: "matching" },
    ]);
  });

  it("reports answer and grading count mismatch", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "多空题",
        "小题/空数量": 2,
        标准答案: "1",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数凑整",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "标准答案",
      message: "标准答案数量必须等于小题/空数量 2",
    });
  });

  it("reports unsupported difficulty values", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "7/8",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数凑整",
        难度层级: "超纲",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "难度层级",
      message: "不支持的难度层级 超纲",
    });
  });

  it("imports required headers without optional columns", async () => {
    const buffer = await workbookBuffer(
      [
        {
          题号: "Q1",
          题型: "填空",
          题干: "1/8 + ____ = 1",
          "小题/空数量": 1,
          标准答案: "7/8",
          判分方式: "数值等价",
          知识点: "分数凑整",
          是否纳入统计: "否",
        },
      ],
      ["题号", "题型", "题干", "小题/空数量", "标准答案", "判分方式", "知识点", "是否纳入统计"],
    );

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.errors).toEqual([]);
    expect(result.questions[0]).toMatchObject({
      difficulty: "基础",
      options: [],
      explanation: "",
      includeInStats: false,
    });
  });
});
