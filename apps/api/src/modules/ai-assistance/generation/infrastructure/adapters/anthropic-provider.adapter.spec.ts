import type { MockInstance } from "vitest";
import { z } from "zod";

import {
  aiProviderErrorResponse,
  captureProviderError,
  createAiTestConfig,
  createAiSdkGenerator,
} from "#test/mocks/ai-provider-http.stub";

import { quickPlanPrompt } from "../../../planning/application/messages/quick-plan-prompt.messages.js";
import { AnthropicProviderAdapter } from "./anthropic-provider.adapter.js";

const schema = z.object({ title: z.string() });

/** jsonTool 방식의 구조화 출력은 json 도구 호출로 온다. */
function messageResponse(input: unknown): Response {
  return Response.json({
    id: "msg_fixture",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "tool_use", id: "toolu_fixture", name: "json", input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
      cache_read_input_tokens: 800,
      cache_creation_input_tokens: 100,
    },
  });
}

const POLICY = {
  maxOutputTokens: 1024,
  deadlineMs: 1000,
  lastProviderMaxRetries: 1,
  maxModelCalls: 4,
} as const;

describe("AnthropicProviderAdapter — 설치된 SDK·기록된 오류 본문, 외부 네트워크 없음", () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { fixture: "billing-error.402.json", kind: "QUOTA_EXHAUSTED" },
    { fixture: "credit-balance-too-low.400.json", kind: "QUOTA_EXHAUSTED" },
    { fixture: "authentication-error.401.json", kind: "AUTH" },
    { fixture: "rate-limit-error.429.json", kind: "RATE_LIMITED" },
    { fixture: "overloaded-error.529.json", kind: "OVERLOADED" },
    { fixture: "api-error.500.json", kind: "UPSTREAM" },
    { fixture: "invalid-request-error.400.json", kind: "BAD_REQUEST" },
    { fixture: "not-found-error.404.json", kind: "UPSTREAM" },
  ] as const)("Claude $fixture 응답은 $kind로 분류한다", async ({ fixture, kind }) => {
    // Given
    fetchSpy.mockResolvedValue(aiProviderErrorResponse("anthropic", fixture));
    const adapter = new AnthropicProviderAdapter(createAiTestConfig());
    // When
    const error = await captureProviderError(adapter);
    // Then
    expect(adapter.classifyError(error)).toBe(kind);
  });

  it("키가 없으면 모델이 없어 경로에서 빠진다", () => {
    // Given
    const config = createAiTestConfig({ ANTHROPIC_API_KEY: "" });
    // When
    const model = new AnthropicProviderAdapter(config).getModel();
    // Then
    expect(model).toBeNull();
  });

  it("JSON 도구·effort low·긴 고정 지시문 캐시를 Messages API로 보내고 캐시 단가로 비용을 계산한다", async () => {
    // Given
    fetchSpy.mockResolvedValue(messageResponse({ title: "독서" }));
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "anthropic" });
    const generator = createAiSdkGenerator(config, [
      new AnthropicProviderAdapter(config),
    ]).generator;
    const system = "규칙 ".repeat(2000);
    // When
    const result = await generator.generate({
      task: "parse-todo",
      taskClass: "interactive",
      userId: null,
      maxInputChars: 5000,
      promptVersion: "parse-todo@test",
      system,
      prompt: "독서",
      schema,
      agreedConsentVersion: "2026-11-04",
    });
    // Then
    expect(result).toMatchObject({
      output: { title: "독서" },
      provider: "anthropic",
      model: "anthropic:claude-haiku-5-5",
      attempts: 1,
      fallbackFrom: null,
      inputTokens: 1900,
      cachedInputTokens: 800,
      cacheWriteInputTokens: 100,
      outputTokens: 200,
      estimatedCostMicroUsd: Math.round(1000 * 0.1 + 800 * 0.01 + 100 * 0.125 + 200 * 0.5),
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      tools: [{ name: "json" }],
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [{ type: "text", text: "독서" }] }],
    });
  });

  it.each([
    { length: 511, cached: false },
    { length: 512, cached: true },
  ])(
    "고정 지시문이 $length자면 Haiku 5.5 최소 512토큰 기준으로 캐시 표시 $cached다",
    ({ length, cached }) => {
      // Given
      const adapter = new AnthropicProviderAdapter(createAiTestConfig());
      // When
      const options = adapter.getSystemProviderOptions("가".repeat(length));
      // Then
      expect(options != null).toBe(cached);
    },
  );

  it.each([
    { thinking: "minimal", expected: { effort: "low", thinking: { type: "disabled" } } },
    { thinking: "low", expected: { effort: "low" } },
    { thinking: "medium", expected: { effort: "medium" } },
  ] as const)("추론 단계 $thinking은 JSON 도구와 $expected로 보낸다", ({ thinking, expected }) => {
    // Given
    const adapter = new AnthropicProviderAdapter(createAiTestConfig());
    // When
    const options = adapter.getProviderOptions({ ...POLICY, thinking });
    // Then
    expect(options["anthropic"]).toEqual({ structuredOutputMode: "jsonTool", ...expected });
  });

  it("JSON 도구 입력의 배열 칸을 문자열로 보낸 응답은 다시 묻지 않고 그대로 받는다", async () => {
    // Given - 실제 평가에서 받은 모양처럼 배열 칸이 JSON 문자열이다
    const memo = { title: "와이파이 비밀번호", content: "거실 공유기 뒷면" };
    fetchSpy.mockImplementation(async () =>
      messageResponse({ todos: JSON.stringify([]), memo: JSON.stringify(memo) }),
    );
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "anthropic" });
    const { generator } = createAiSdkGenerator(config, [new AnthropicProviderAdapter(config)]);
    // When
    const result = await generator.generate({
      task: "quick-plan",
      taskClass: "interactive",
      userId: null,
      maxInputChars: quickPlanPrompt.maxInputChars,
      promptVersion: quickPlanPrompt.version,
      system: "규칙",
      prompt: "입력",
      schema: quickPlanPrompt.schema,
      agreedConsentVersion: "2026-11-04",
    });
    // Then
    expect(result).toMatchObject({ output: { todos: [], memo }, attempts: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
