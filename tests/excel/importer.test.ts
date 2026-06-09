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

  it("reports blank required row values", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "7/8",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "",
        难度层级: "基础",
        是否纳入统计: "",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { rowNumber: 2, field: "题号", message: "题号不能为空" },
        { rowNumber: 2, field: "知识点", message: "知识点不能为空" },
        { rowNumber: 2, field: "是否纳入统计", message: "是否纳入统计必须为 是 或 否" },
      ]),
    );
  });

  it("reports invalid include-in-stats values", async () => {
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
        难度层级: "基础",
        是否纳入统计: "maybe",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "是否纳入统计",
      message: "是否纳入统计必须为 是 或 否",
    });
  });

  it("reports choice questions missing option B", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "选择",
        题干: "选择正确答案",
        "小题/空数量": 1,
        选项A: "1/2",
        选项B: "",
        标准答案: "A",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "选项",
      message: "选择题至少需要选项A和选项B",
    });
  });

  it("reports choice answers that do not match non-empty options", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "选择",
        题干: "选择正确答案",
        "小题/空数量": 1,
        选项A: "1/2",
        选项B: "3/4",
        标准答案: "C",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "标准答案",
      message: "选择题答案必须匹配已有选项",
    });
  });

  it("reports judgement answers outside 正确 or 错误", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "判断",
        题干: "1/2 大于 3/4",
        "小题/空数量": 1,
        标准答案: "不确定",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "标准答案",
      message: "判断题答案必须为 正确 或 错误",
    });
  });

  it("returns no questions when any imported row has validation errors", async () => {
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
        难度层级: "基础",
        是否纳入统计: "是",
      },
      {
        题号: "Q2",
        题型: "填空",
        题干: "1/4 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "3/4",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数凑整",
        难度层级: "基础",
        是否纳入统计: "maybe",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 3,
      field: "是否纳入统计",
      message: "是否纳入统计必须为 是 或 否",
    });
  });

  it("splits knowledge points by pipe even when answers use another delimiter", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ + ____ = 2",
        "小题/空数量": 2,
        标准答案: "7/8;1",
        答案分隔符: ";",
        判分方式: "数值等价",
        知识点: "加法交换律|分数凑整",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].knowledgePoints).toEqual(["加法交换律", "分数凑整"]);
  });

  it("reports blank standard answers", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "",
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
      message: "标准答案不能为空",
    });
  });

  it("reports blank grading modes", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "7/8",
        答案分隔符: "|",
        判分方式: "",
        知识点: "分数凑整",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "判分方式",
      message: "判分方式不能为空",
    });
  });

  it("reports choice questions with multiple items", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "选择",
        题干: "选择正确答案",
        "小题/空数量": 2,
        选项A: "1/2",
        选项B: "3/4",
        标准答案: "A|B",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "小题/空数量",
      message: "选择题小题/空数量必须为 1",
    });
  });

  it("reports choice questions with numeric grading", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "选择",
        题干: "选择正确答案",
        "小题/空数量": 1,
        选项A: "1/2",
        选项B: "3/4",
        标准答案: "A",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "判分方式",
      message: "选择题判分方式必须为 文本匹配",
    });
  });

  it("reports judgement questions with multiple items", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "判断",
        题干: "判断下列说法",
        "小题/空数量": 2,
        标准答案: "正确|错误",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "小题/空数量",
      message: "判断题小题/空数量必须为 1",
    });
  });

  it("reports judgement questions with numeric grading", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "判断",
        题干: "1/2 小于 3/4",
        "小题/空数量": 1,
        标准答案: "正确",
        答案分隔符: "|",
        判分方式: "数值等价",
        知识点: "分数比较",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "判分方式",
      message: "判断题判分方式必须为 文本匹配",
    });
  });

  it("reports matching questions with text grading", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "配对",
        题干: "配对",
        "小题/空数量": 2,
        标准答案: "①-b|②-a",
        答案分隔符: "|",
        判分方式: "文本匹配",
        知识点: "乘法分配律",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "判分方式",
      message: "配对题判分方式必须为 配对匹配",
    });
  });

  it("reports blank questions with matching grading", async () => {
    const buffer = await workbookBuffer([
      {
        题号: "Q1",
        题型: "填空",
        题干: "1/8 + ____ = 1",
        "小题/空数量": 1,
        标准答案: "7/8",
        答案分隔符: "|",
        判分方式: "配对匹配",
        知识点: "分数凑整",
        难度层级: "基础",
        是否纳入统计: "是",
      },
    ]);

    const result = await importQuestionsFromWorkbook(buffer);

    expect(result.questions).toEqual([]);
    expect(result.errors).toContainEqual({
      rowNumber: 2,
      field: "判分方式",
      message: "填空题判分方式不能为 配对匹配",
    });
  });
});
