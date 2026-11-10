import type { MockInstance } from "vitest";
import { z } from "zod";

import {
  aiProviderErrorResponse,
  captureProviderError,
  createAiTestConfig,
  createAiSdkGenerator,
} from "#test/mocks/ai-provider-http.stub";

import { OpenAiProviderAdapter } from "./openai-provider.adapter.js";

const schema = z.object({ title: z.string() });

function responsesResponse(text: string): Response {
  return Response.json({
    id: "resp_fixture",
    object: "response",
    created_at: 1_793_750_400,
    status: "completed",
    model: "gpt-6-luna",
    output: [
      {
        type: "message",
        id: "msg_fixture",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    incomplete_details: null,
    usage: {
      input_tokens: 800,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 120,
      output_tokens_details: { reasoning_tokens: 40 },
      total_tokens: 920,
    },
  });
}

describe("OpenAiProviderAdapter — 설치된 SDK·기록된 오류 본문, 외부 네트워크 없음", () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { fixture: "insufficient-quota.429.json", kind: "QUOTA_EXHAUSTED" },
    { fixture: "rate-limit-exceeded.429.json", kind: "RATE_LIMITED" },
    { fixture: "invalid-api-key.401.json", kind: "AUTH" },
    { fixture: "content-policy-violation.400.json", kind: "BLOCKED" },
    { fixture: "engine-overloaded.503.json", kind: "OVERLOADED" },
    { fixture: "server-error.500.json", kind: "UPSTREAM" },
    { fixture: "invalid-request.400.json", kind: "BAD_REQUEST" },
    { fixture: "not-found.404.json", kind: "UPSTREAM" },
    { fixture: "refusal.200.json", kind: "BLOCKED" },
  ] as const)("OpenAI $fixture 응답은 $kind로 분류한다", async ({ fixture, kind }) => {
    // Given
    fetchSpy.mockResolvedValue(aiProviderErrorResponse("openai", fixture));
    const adapter = new OpenAiProviderAdapter(createAiTestConfig());
    // When
    const error = await captureProviderError(adapter);
    // Then
    expect(adapter.classifyError(error)).toBe(kind);
  });

  it.each([
    { thinking: "minimal", effort: "none" },
    { thinking: "low", effort: "low" },
    { thinking: "medium", effort: "medium" },
  ] as const)(
    "추론 단계 $thinking은 gpt-6-luna가 받는 $effort로 보낸다",
    ({ thinking, effort }) => {
      // Given
      const adapter = new OpenAiProviderAdapter(createAiTestConfig());
      // When
      const options = adapter.getProviderOptions({
        thinking,
        maxOutputTokens: 1_024,
        deadlineMs: 1_000,
        lastProviderMaxRetries: 1,
        maxModelCalls: 4,
      });
      // Then
      expect(options["openai"]).toMatchObject({
        reasoningEffort: effort,
        strictJsonSchema: true,
        store: false,
      });
    },
  );

  it("reasoning low·저장 안 함·구조화 출력을 Responses API로 보내고 사고 토큰과 비용을 돌려준다", async () => {
    // Given
    fetchSpy.mockResolvedValue(responsesResponse(JSON.stringify({ title: "독서" })));
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "openai" });
    const generator = createAiSdkGenerator(config, [new OpenAiProviderAdapter(config)]).generator;
    // When
    const result = await generator.generate({
      task: "report",
      taskClass: "background",
      userId: null,
      maxInputChars: 16_000,
      promptVersion: "report@test",
      system: "규칙",
      prompt: "독서",
      schema,
      agreedConsentVersion: "2026-11-04",
    });
    // Then
    expect(result).toMatchObject({
      output: { title: "독서" },
      provider: "openai",
      model: "openai:gpt-6-luna",
      inputTokens: 800,
      outputTokens: 120,
      reasoningTokens: 40,
      estimatedCostMicroUsd: 800 * 0.1 + 120 * 0.5,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      store: false,
      max_output_tokens: 2_048,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", strict: true } },
    });
  });

  it("모델 거절(refusal)은 BLOCKED로 끝내고 다시 묻지 않으며 장애 회로에 쌓지 않는다", async () => {
    // Given
    fetchSpy.mockImplementation(async () => aiProviderErrorResponse("openai", "refusal.200.json"));
    const config = createAiTestConfig({
      AI_PROVIDER_ORDER: "openai",
      AI_BREAKER_HEALTH_THRESHOLD: "1",
    });
    const { generator, registry } = createAiSdkGenerator(config, [
      new OpenAiProviderAdapter(config),
    ]);
    // When
    const failure = await generator
      .generate({
        task: "parse-todo",
        taskClass: "interactive",
        userId: null,
        maxInputChars: 5_000,
        promptVersion: "parse-todo@test",
        system: "규칙",
        prompt: "독서",
        schema,
        agreedConsentVersion: "2026-11-04",
      })
      .catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "BLOCKED", errorCode: "AI_1302", attempts: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(registry.getStates()["ai:openai"]?.openBreakers).toEqual([]);
  });

  it("insufficient_quota 429는 마지막 업체여도 SDK가 다시 부르지 않는다", async () => {
    // Given
    fetchSpy.mockImplementation(async () =>
      aiProviderErrorResponse("openai", "insufficient-quota.429.json"),
    );
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "openai" });
    const { generator } = createAiSdkGenerator(config, [new OpenAiProviderAdapter(config)]);
    // When
    const failure = await generator
      .generate({
        task: "parse-todo",
        taskClass: "interactive",
        userId: null,
        maxInputChars: 5_000,
        promptVersion: "parse-todo@test",
        system: "규칙",
        prompt: "독서",
        schema,
        agreedConsentVersion: "2026-11-04",
      })
      .catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "QUOTA_EXHAUSTED" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
