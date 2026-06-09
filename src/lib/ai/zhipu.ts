export type ZhipuMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_ZHIPU_MODEL = "GLM-4-Flash-250414";
const MAX_ATTEMPTS = 3;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function contentFromResponseBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    return "";
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return "";
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    return "";
  }

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export async function generateZhipuReport(input: {
  apiKey: string;
  url: string;
  model: string;
  messages: ZhipuMessage[];
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retryDelayMs = input.retryDelayMs ?? 1500;
  const body = JSON.stringify({
    model: input.model,
    messages: input.messages,
    temperature: 0.3,
    max_tokens: 1800,
    stream: false,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchImpl(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body,
    });

    if (response.ok) {
      const responseBody = await response.json().catch(() => undefined);
      return contentFromResponseBody(responseBody);
    }

    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      await wait(retryDelayMs);
      continue;
    }

    throw new Error(`智谱 API 调用失败: ${response.status}`);
  }

  return "";
}

export function readZhipuConfigFromEnv(): { apiKey: string; url: string; model: string } {
  return {
    apiKey: process.env.ZHIPU_API_KEY || "",
    url: process.env.ZHIPU_CHAT_COMPLETIONS_URL || DEFAULT_ZHIPU_URL,
    model: process.env.ZHIPU_MODEL || DEFAULT_ZHIPU_MODEL,
  };
}
