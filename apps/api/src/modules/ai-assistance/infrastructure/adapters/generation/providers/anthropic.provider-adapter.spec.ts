import type { MockInstance } from "vitest";
import { z } from "zod";

import {
  aiProviderErrorResponse,
  captureProviderError,
  createAiTestConfig,
  RecordingAiProviderAlert,
} from "#test/mocks/ai-provider-http.stub";

import { AiProviderCircuitRegistry } from "../ai-provider-circuit.registry.js";
import { AiSdkGenerator } from "../ai-sdk.generator.js";
import { AnthropicProviderAdapter } from "./anthropic.provider-adapter.js";

const schema = z.object({ title: z.string() });

function messageResponse(text: string): Response {
  return Response.json({
    id: "msg_fixture",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200 },
  });
}

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
    { fixture: "authentication-error.401.json", kind: "AUTH" },
    { fixture: "rate-limit-error.429.json", kind: "RATE_LIMITED" },
    { fixture: "overloaded-error.529.json", kind: "OVERLOADED" },
    { fixture: "api-error.500.json", kind: "UPSTREAM" },
    { fixture: "invalid-request-error.400.json", kind: "BAD_REQUEST" },
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

  it("effort low·긴 고정 지시문 캐시·구조화 출력을 Messages API로 보내고 단가로 비용을 계산한다", async () => {
    // Given
    fetchSpy.mockResolvedValue(messageResponse(JSON.stringify({ title: "독서" })));
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "anthropic" });
    const generator = new AiSdkGenerator(
      config,
      [new AnthropicProviderAdapter(config)],
      new AiProviderCircuitRegistry(config, new RecordingAiProviderAlert()),
    );
    const system = "규칙 ".repeat(2000);
    // When
    const result = await generator.generate({
      task: "parse-todo",
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
      inputTokens: 1000,
      outputTokens: 200,
      estimatedCostMicroUsd: 1000 * 0.1 + 200 * 0.5,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema" } },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [{ type: "text", text: "독서" }] }],
    });
  });

  it("짧은 고정 지시문에는 캐시 표시를 붙이지 않는다", () => {
    // Given
    const adapter = new AnthropicProviderAdapter(createAiTestConfig());
    // When
    const options = adapter.getSystemProviderOptions("짧은 지시");
    // Then
    expect(options).toBeUndefined();
  });
});
