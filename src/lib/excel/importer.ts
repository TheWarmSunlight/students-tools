import ExcelJS from "exceljs";
import { QUESTION_DIFFICULTIES } from "@/lib/domain/constants";
import type {
  GradingMode,
  Question,
  QuestionDifficulty,
  QuestionOption,
  QuestionType,
} from "@/lib/domain/types";

export type QuestionImportError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type QuestionImportResult = {
  questions: Question[];
  errors: QuestionImportError[];
};

const REQUIRED_HEADERS = [
  "题号",
  "题型",
  "题干",
  "小题/空数量",
  "标准答案",
  "判分方式",
  "知识点",
  "是否纳入统计",
] as const;

const TYPE_MAP: Readonly<Partial<Record<string, QuestionType>>> = {
  选择: "choice",
  选择题: "choice",
  判断: "judgement",
  判断题: "judgement",
  填空: "blank",
  填空题: "blank",
  配对: "matching",
  连线: "matching",
  连线配对: "matching",
};

const GRADING_MAP: Readonly<Partial<Record<string, GradingMode>>> = {
  文本匹配: "text",
  数值等价: "numeric",
  配对匹配: "matching",
};

const DEFAULT_DELIMITER = "|";
const KNOWLEDGE_POINT_DELIMITER = "|";
const DEFAULT_DIFFICULTY: QuestionDifficulty = "基础";

export async function importQuestionsFromWorkbook(
  buffer: Buffer,
): Promise<QuestionImportResult> {
  const workbook = new ExcelJS.Workbook();
  const workbookData = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(workbookData);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      questions: [],
      errors: [{ rowNumber: 0, field: "工作表", message: "Excel 中没有工作表" }],
    };
  }

  const errors: QuestionImportError[] = [];
  const headerColumns = getHeaderColumns(worksheet);
  for (const header of REQUIRED_HEADERS) {
    if (!headerColumns.has(header)) {
      errors.push({
        rowNumber: 1,
        field: header,
        message: `缺少必填表头 ${header}`,
      });
    }
  }

  if (errors.length > 0) {
    return { questions: [], errors };
  }

  const questions: Question[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (isBlankRow(row, headerColumns)) {
      continue;
    }

    const rowErrors: QuestionImportError[] = [];
    const getField = (field: string) => {
      const columnNumber = headerColumns.get(field);
      return columnNumber ? cellText(row.getCell(columnNumber).value) : "";
    };

    const questionNo = getField("题号");
    if (!questionNo) {
      rowErrors.push({ rowNumber, field: "题号", message: "题号不能为空" });
    }

    const typeRaw = getField("题型");
    const type = TYPE_MAP[typeRaw];
    if (!type) {
      rowErrors.push({
        rowNumber,
        field: "题型",
        message: `不支持的题型 ${typeRaw}`,
      });
    }

    const prompt = getField("题干");
    if (!prompt) {
      rowErrors.push({ rowNumber, field: "题干", message: "题干不能为空" });
    }

    const itemCountRaw = getField("小题/空数量");
    const itemCount = Number(itemCountRaw);
    const hasPositiveIntegerItemCount = Number.isInteger(itemCount) && itemCount > 0;
    if (!hasPositiveIntegerItemCount) {
      rowErrors.push({
        rowNumber,
        field: "小题/空数量",
        message: "小题/空数量必须是正整数",
      });
    }

    const delimiter = getField("答案分隔符") || DEFAULT_DELIMITER;
    const answerRaw = getField("标准答案");
    if (!answerRaw) {
      rowErrors.push({ rowNumber, field: "标准答案", message: "标准答案不能为空" });
    }

    const answers = splitBy(answerRaw, delimiter);
    if (answerRaw && hasPositiveIntegerItemCount && answers.length !== itemCount) {
      rowErrors.push({
        rowNumber,
        field: "标准答案",
        message: `标准答案数量必须等于小题/空数量 ${itemCount}`,
      });
    }

    const gradingRaw = getField("判分方式");
    if (!gradingRaw) {
      rowErrors.push({ rowNumber, field: "判分方式", message: "判分方式不能为空" });
    }

    const gradingLabels = splitBy(gradingRaw, delimiter);
    if (gradingRaw && gradingLabels.length !== 1 && gradingLabels.length !== answers.length) {
      rowErrors.push({
        rowNumber,
        field: "判分方式",
        message: `判分方式数量必须为 1 或等于标准答案数量 ${answers.length}`,
      });
    }

    const gradingModes: GradingMode[] = [];
    for (const label of gradingLabels) {
      const mode = GRADING_MAP[label];
      if (!mode) {
        rowErrors.push({
          rowNumber,
          field: "判分方式",
          message: `不支持的判分方式 ${label}`,
        });
      } else {
        gradingModes.push(mode);
      }
    }

    const knowledgePoints = splitBy(getField("知识点"), KNOWLEDGE_POINT_DELIMITER);
    if (knowledgePoints.length === 0) {
      rowErrors.push({ rowNumber, field: "知识点", message: "知识点不能为空" });
    }

    const includeInStatsRaw = getField("是否纳入统计");
    if (includeInStatsRaw !== "是" && includeInStatsRaw !== "否") {
      rowErrors.push({
        rowNumber,
        field: "是否纳入统计",
        message: "是否纳入统计必须为 是 或 否",
      });
    }

    const difficultyRaw = getField("难度层级");
    let difficulty = DEFAULT_DIFFICULTY;
    if (difficultyRaw) {
      if (isQuestionDifficulty(difficultyRaw)) {
        difficulty = difficultyRaw;
      } else {
        rowErrors.push({
          rowNumber,
          field: "难度层级",
          message: `不支持的难度层级 ${difficultyRaw}`,
        });
      }
    }

    const options = getOptions(row, headerColumns);
    if (type === "choice") {
      if (hasPositiveIntegerItemCount && itemCount !== 1) {
        rowErrors.push({
          rowNumber,
          field: "小题/空数量",
          message: "选择题小题/空数量必须为 1",
        });
      }

      const optionKeys = new Set(options.map((option) => option.key));
      if (!optionKeys.has("A") || !optionKeys.has("B")) {
        rowErrors.push({
          rowNumber,
          field: "选项",
          message: "选择题至少需要选项A和选项B",
        });
      }

      if (!answers.every((answer) => optionKeys.has(answer))) {
        rowErrors.push({
          rowNumber,
          field: "标准答案",
          message: "选择题答案必须匹配已有选项",
        });
      }

      if (
        hasSupportedGradingLabels(gradingLabels, gradingModes) &&
        !gradingModes.every((mode) => mode === "text")
      ) {
        rowErrors.push({
          rowNumber,
          field: "判分方式",
          message: "选择题判分方式必须为 文本匹配",
        });
      }
    }

    if (type === "judgement") {
      if (hasPositiveIntegerItemCount && itemCount !== 1) {
        rowErrors.push({
          rowNumber,
          field: "小题/空数量",
          message: "判断题小题/空数量必须为 1",
        });
      }

      if (!answers.every((answer) => answer === "正确" || answer === "错误")) {
        rowErrors.push({
          rowNumber,
          field: "标准答案",
          message: "判断题答案必须为 正确 或 错误",
        });
      }

      if (
        hasSupportedGradingLabels(gradingLabels, gradingModes) &&
        !gradingModes.every((mode) => mode === "text")
      ) {
        rowErrors.push({
          rowNumber,
          field: "判分方式",
          message: "判断题判分方式必须为 文本匹配",
        });
      }
    }

    if (
      type === "matching" &&
      hasSupportedGradingLabels(gradingLabels, gradingModes) &&
      !gradingModes.every((mode) => mode === "matching")
    ) {
      rowErrors.push({
        rowNumber,
        field: "判分方式",
        message: "配对题判分方式必须为 配对匹配",
      });
    }

    if (
      type === "blank" &&
      hasSupportedGradingLabels(gradingLabels, gradingModes) &&
      gradingModes.some((mode) => mode === "matching")
    ) {
      rowErrors.push({
        rowNumber,
        field: "判分方式",
        message: "填空题判分方式不能为 配对匹配",
      });
    }

    if (rowErrors.length > 0 || !type) {
      errors.push(...rowErrors);
      continue;
    }

    const items = answers.map((answer, index) => ({
      index,
      answer,
      gradingMode:
        gradingModes.length === 1
          ? gradingModes[0]
          : gradingModes[index],
    }));

    questions.push({
      id: `q-${questionNo}`,
      questionNo,
      type,
      prompt,
      itemCount,
      options,
      items,
      knowledgePoints,
      difficulty,
      includeInStats: includeInStatsRaw === "是",
      explanation: getField("解析"),
    });
  }

  if (errors.length > 0) {
    return { questions: [], errors };
  }

  return { questions, errors };
}

function getHeaderColumns(worksheet: ExcelJS.Worksheet) {
  const headerColumns = new Map<string, number>();
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = cellText(cell.value);
    if (header) {
      headerColumns.set(header, columnNumber);
    }
  });
  return headerColumns;
}

function isBlankRow(row: ExcelJS.Row, headerColumns: Map<string, number>) {
  return Array.from(headerColumns.values()).every((columnNumber) => !cellText(row.getCell(columnNumber).value));
}

function getOptions(row: ExcelJS.Row, headerColumns: Map<string, number>): QuestionOption[] {
  return ["A", "B", "C", "D"].flatMap((key) => {
    const columnNumber = headerColumns.get(`选项${key}`);
    if (!columnNumber) {
      return [];
    }

    const text = cellText(row.getCell(columnNumber).value);
    return text ? [{ key, text }] : [];
  });
}

function splitBy(raw: string, delimiter: string) {
  return raw
    .split(delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasSupportedGradingLabels(labels: string[], modes: GradingMode[]) {
  return labels.length > 0 && labels.length === modes.length;
}

function cellText(value: ExcelJS.CellValue | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((entry) => ("text" in entry && typeof entry.text === "string" ? entry.text : ""))
        .join("")
        .trim();
    }
  }

  return "";
}

function isQuestionDifficulty(value: string): value is QuestionDifficulty {
  return QUESTION_DIFFICULTIES.some((difficulty) => difficulty === value);
}
