import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateZhipuReport, readZhipuConfigFromEnv } from "@/lib/ai/zhipu";
import { buildReportMessages } from "@/lib/reports/prompt";
import type { ClassroomAnalytics } from "@/lib/stats/analytics";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function saveZhipuEnv(): Record<string, string | undefined> {
  return {
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
    ZHIPU_CHAT_COMPLETIONS_URL: process.env.ZHIPU_CHAT_COMPLETIONS_URL,
    ZHIPU_MODEL: process.env.ZHIPU_MODEL,
  };
}

function restoreZhipuEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("buildReportMessages", () => {
  it("keeps the zhipu API client server-only", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/ai/zhipu.ts"), "utf8");

    expect(source).toMatch(/^import "server-only";/);
  });

  it("projects classroom analytics into aggregate-only prompt messages", () => {
    const rawQuestion = {
      questionId: "q-1",
      questionNo: "第1题",
      itemAccuracy: 3 / 4,
      errorRate: 1 / 4,
      allCorrectRate: 1 / 2,
      submittedCount: 1,
      correctItems: 3,
      totalItems: 4,
      itemStats: [{ index: 0, correct: 1, total: 1, accuracy: 1, errorRate: 0 }],
      prompt: "泄露题干",
      options: [{ key: "A", text: "泄露选项" }],
      items: [{ index: 0, answer: "真实答案", gradingMode: "数值等价" }],
      explanation: "泄露解析",
      standardAnswer: "标准答案",
    };
    const rawStudent: ClassroomAnalytics["students"][number] & { studentId: string } = {
      id: "s-1",
      studentId: "s-1",
      seatNo: "01",
      name: "小明",
      accuracy: 1,
      correctItems: 4,
      totalItems: 4,
      layerCode: "A",
    };
    const analytics: ClassroomAnalytics & {
      questions: typeof rawQuestion[];
      students: typeof rawStudent[];
    } = {
      expectedCount: 30,
      studentCount: 2,
      submittedStudentCount: 1,
      submitRate: 1 / 2,
      averageAccuracy: 3 / 4,
      questions: [rawQuestion],
      knowledgePoints: [
        { name: "分数加法", accuracy: 3 / 4, correctItems: 3, totalItems: 4 },
      ],
      layers: [{ code: "A", name: "优秀拓展层", count: 1, percentage: 1 / 2 }],
      students: [rawStudent],
    };

    const messages = buildReportMessages(analytics);

    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[0].content).toContain("只基于汇总统计");
    expect(messages[0].content).toContain("不得编造");
    expect(messages[0].content).toContain("不得改写");
    expect(messages[0].content).toContain("数据结论");
    expect(messages[0].content).toContain("教学建议");
    expect(messages[0].content).toContain("样本不足");

    const serialized = JSON.stringify(messages);
    expect(serialized).toContain("expectedCount");
    expect(serialized).toContain("studentCount");
    expect(serialized).toContain("submittedStudentCount");
    expect(serialized).toContain("submitRate");
    expect(serialized).toContain("averageAccuracy");
    expect(serialized).toContain("questions");
    expect(serialized).toContain("knowledgePoints");
    expect(serialized).toContain("layers");
    expect(serialized).toContain("分数加法");
    expect(serialized).toContain("第1题");

    expect(serialized).not.toContain("students");
    expect(serialized).not.toContain("studentId");
    expect(serialized).not.toContain("seatNo");
    expect(serialized).not.toContain("小明");
    expect(serialized).not.toContain("s-1");
    expect(serialized).not.toContain("泄露题干");
    expect(serialized).not.toContain("泄露选项");
    expect(serialized).not.toContain("真实答案");
    expect(serialized).not.toContain("泄露解析");
    expect(serialized).not.toContain("标准答案");
  });
});

describe("generateZhipuReport", () => {
  it("posts chat completion request and returns message content", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { choices: [{ message: { content: "报告内容" } }] }),
    );
    const messages = [{ role: "user" as const, content: "请生成报告" }];

    const content = await generateZhipuReport({
      apiKey: "secret-key",
      url: "https://example.test/chat/completions",
      model: "glm-test",
      messages,
      fetchImpl,
    });

    expect(content).toBe("报告内容");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.test/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-key",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "glm-test",
      messages,
      temperature: 0.3,
      max_tokens: 1800,
      stream: false,
    });
  });

  it("retries 429 exactly three attempts then throws status", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(429, { error: "rate_limit" }));

    let error: unknown;
    try {
      await generateZhipuReport({
        apiKey: "top-secret",
        url: "https://example.test/chat/completions",
        model: "glm-test",
        messages: [{ role: "user", content: "请生成报告" }],
        fetchImpl,
        retryDelayMs: 1,
      });
    } catch (caught) {
      error = caught;
    }

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("智谱 API 调用失败: 429");
    expect((error as Error).message).not.toContain("top-secret");
  });

  it("does not retry non-429 API errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(500, { error: "server_error" }));

    await expect(
      generateZhipuReport({
        apiKey: "top-secret",
        url: "https://example.test/chat/completions",
        model: "glm-test",
        messages: [{ role: "user", content: "请生成报告" }],
        fetchImpl,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow("智谱 API 调用失败: 500");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns an empty string when the response message content is missing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { choices: [{}] }));

    await expect(
      generateZhipuReport({
        apiKey: "secret-key",
        url: "https://example.test/chat/completions",
        model: "glm-test",
        messages: [{ role: "user", content: "请生成报告" }],
        fetchImpl,
      }),
    ).resolves.toBe("");
  });
});

describe("readZhipuConfigFromEnv", () => {
  it("uses official defaults when environment variables are absent", () => {
    const saved = saveZhipuEnv();

    try {
      delete process.env.ZHIPU_API_KEY;
      delete process.env.ZHIPU_CHAT_COMPLETIONS_URL;
      delete process.env.ZHIPU_MODEL;

      expect(readZhipuConfigFromEnv()).toEqual({
        apiKey: "",
        url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        model: "GLM-4-Flash-250414",
      });
    } finally {
      restoreZhipuEnv(saved);
    }
  });

  it("uses Zhipu environment variable overrides", () => {
    const saved = saveZhipuEnv();

    try {
      process.env.ZHIPU_API_KEY = "env-key";
      process.env.ZHIPU_CHAT_COMPLETIONS_URL = "https://example.test/custom";
      process.env.ZHIPU_MODEL = "custom-model";

      expect(readZhipuConfigFromEnv()).toEqual({
        apiKey: "env-key",
        url: "https://example.test/custom",
        model: "custom-model",
      });
    } finally {
      restoreZhipuEnv(saved);
    }
  });
});
