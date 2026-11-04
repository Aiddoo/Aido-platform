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
import { OpenAiProviderAdapter } from "./openai.provider-adapter.js";

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
  ] as const)("OpenAI $fixture 응답은 $kind로 분류한다", async ({ fixture, kind }) => {
    // Given
    fetchSpy.mockResolvedValue(aiProviderErrorResponse("openai", fixture));
    const adapter = new OpenAiProviderAdapter(createAiTestConfig());
    // When
    const error = await captureProviderError(adapter);
    // Then
    expect(adapter.classifyError(error)).toBe(kind);
  });

  it("reasoning low·저장 안 함·구조화 출력을 Responses API로 보내고 사고 토큰과 비용을 돌려준다", async () => {
    // Given
    fetchSpy.mockResolvedValue(responsesResponse(JSON.stringify({ title: "독서" })));
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "openai" });
    const generator = new AiSdkGenerator(
      config,
      [new OpenAiProviderAdapter(config)],
      new AiProviderCircuitRegistry(config, new RecordingAiProviderAlert()),
    );
    // When
    const result = await generator.generate({
      task: "report",
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
      max_output_tokens: 2048,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", strict: false } },
    });
  });
});
