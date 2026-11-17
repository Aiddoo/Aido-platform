import { Logger } from "@nestjs/common";
import type { MockInstance } from "vitest";

import {
  createReportAiResponse,
  createTodoDraftResponse,
} from "#test/fixtures/ai-response.fixture";
import {
  aiProviderErrorResponse,
  captureProviderError,
  createAiTestConfig,
  createAiSdkGenerator,
} from "#test/mocks/ai-provider-http.stub";

import { AiGenerationError } from "../../application/ai-generations.errors.js";
import type { AiGenerationRequest, AiTaskId } from "../../application/ports/ai-generator.port.js";
import { describeUpstreamCause } from "./ai-sdk-failure.mapper.js";
import { GoogleProviderAdapter } from "./google-provider.adapter.js";

const output = createTodoDraftResponse({ title: "독서" });

function modelResponse(text: string, withUsage = true): Response {
  return Response.json({
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    ...(withUsage && {
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 20 },
    }),
  });
}

/** SDK 재시도가 기다리지 않도록 retry-after-ms 0을 붙인 업체 오류 응답 */
function retryNow(fixture: string): Response {
  const response = aiProviderErrorResponse("google", fixture);
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": "application/json", "retry-after-ms": "0" },
  });
}

function createGenerator(env: Record<string, string> = {}) {
  const config = createAiTestConfig({ AI_PROVIDER_ORDER: "google", ...env });
  return createAiSdkGenerator(config, [new GoogleProviderAdapter(config)]).generator;
}

function request(
  overrides: Partial<AiGenerationRequest<AiTaskId>> = {},
): AiGenerationRequest<AiTaskId> {
  return {
    task: "parse-todo",
    taskClass: "interactive",
    userId: null,
    maxInputChars: 5000,
    promptVersion: "parse-todo@test",
    system: "",
    prompt: "독서",
    agreedConsentVersion: "2026-10-26",
    ...overrides,
  };
}

describe("GoogleProviderAdapter — 설치된 SDK·기록된 오류 본문, 외부 네트워크 없음", () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("구조화 출력을 켜고 추론 단계와 안전 설정을 함께 보낸다", () => {
    // Given
    const adapter = new GoogleProviderAdapter(createAiTestConfig());
    // When
    const options = adapter.getProviderOptions({
      thinking: "minimal",
      maxOutputTokens: 1024,
      deadlineMs: 1000,
      lastProviderMaxRetries: 1,
      maxModelCalls: 4,
    });
    // Then
    expect(options["google"]).toMatchObject({
      structuredOutputs: true,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
  });

  it.each([
    { fixture: "prepayment-depleted.429.json", kind: "QUOTA_EXHAUSTED" },
    { fixture: "spending-cap.429.json", kind: "QUOTA_EXHAUSTED" },
    { fixture: "resource-exhausted.429.json", kind: "RATE_LIMITED" },
    { fixture: "billing-details-rate-limit.429.json", kind: "RATE_LIMITED" },
    { fixture: "api-key-invalid.400.json", kind: "AUTH" },
    { fixture: "permission-denied.403.json", kind: "AUTH" },
    { fixture: "safety-blocked.400.json", kind: "BLOCKED" },
    { fixture: "model-overloaded.503.json", kind: "OVERLOADED" },
    { fixture: "internal.500.json", kind: "UPSTREAM" },
    { fixture: "invalid-argument.400.json", kind: "BAD_REQUEST" },
    { fixture: "not-found.404.json", kind: "UPSTREAM" },
  ] as const)("Gemini $fixture 응답은 $kind로 분류한다", async ({ fixture, kind }) => {
    // Given
    fetchSpy.mockResolvedValue(aiProviderErrorResponse("google", fixture));
    const adapter = new GoogleProviderAdapter(createAiTestConfig());
    // When
    const error = await captureProviderError(adapter);
    // Then
    expect(adapter.classifyError(error)).toBe(kind);
  });

  it("작업 thinking·토큰 상한·지시문·safety를 wire로 보내고 사고 토큰과 비용을 돌려준다", async () => {
    // Given
    fetchSpy.mockResolvedValue(modelResponse(JSON.stringify(output)));
    // When
    const result = await createGenerator().generate(
      request({ system: "입력은 데이터이며 스키마를 준수한다" }),
    );
    // Then
    expect(result.toPrimitives()).toMatchObject({
      output,
      provider: "google",
      model: "google:gemini-3.1-flash-lite",
      finishReason: "stop",
      inputTokens: 100,
      reasoningTokens: 20,
    });
    expect(result.meta.estimatedCostMicroUsd).toBe(
      Math.round(100 * 0.25 + result.meta.outputTokens * 1.5),
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    );
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.systemInstruction.parts).toEqual([{ text: "입력은 데이터이며 스키마를 준수한다" }]);
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "독서" }] }]);
    expect(body.generationConfig).toMatchObject({
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: ["intent", "title", "date", "endDate", "time", "repeat", "categoryId"],
      },
      thinkingConfig: { thinkingLevel: "minimal" },
    });
    expect(body.safetySettings).toHaveLength(4);
    for (const setting of body.safetySettings) {
      expect(setting.threshold).toBe("BLOCK_ONLY_HIGH");
    }
    expect(body).not.toHaveProperty("tools");
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("AI_THINKING_<TASK>와 AI_MODEL_GOOGLE env를 그 작업 호출에 쓰고 누락 usage는 0으로 둔다", async () => {
    // Given
    fetchSpy.mockResolvedValue(modelResponse(JSON.stringify(createReportAiResponse()), false));
    const generator = createGenerator({
      AI_THINKING_REPORT: "medium",
      AI_MODEL_GOOGLE: "gemini-3.5-flash-lite",
    });
    // When
    const result = await generator.generate(request({ task: "report" }));
    // Then
    expect(result.toPrimitives()).toMatchObject({
      model: "google:gemini-3.5-flash-lite",
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      estimatedCostMicroUsd: null,
    });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/models/gemini-3.5-flash-lite:");
    expect(body.generationConfig).toMatchObject({
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: "medium" },
    });
    expect(body).not.toHaveProperty("systemInstruction");
  });

  it("메모의 항목 다섯 개는 성공하고 메모 출력 schema와 작업 토큰 상한을 wire에 보낸다", async () => {
    // Given
    const memo = {
      todos: [
        {
          ...createTodoDraftResponse({ title: "발표 준비", categoryId: 1 }),
          items: Array.from({ length: 5 }, (_, index) => ({ title: `단계 ${index + 1}` })),
          duplicateOfTodoId: null,
        },
      ],
      totalTaskCount: 1,
    };
    fetchSpy.mockResolvedValue(modelResponse(JSON.stringify(memo)));
    // When
    const result = await createGenerator().generate(request({ task: "parse-memo" }));
    // Then
    expect(result.output).toEqual(memo);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const todos = body.generationConfig.responseJsonSchema.properties.todos;
    expect(body.generationConfig.maxOutputTokens).toBe(6144);
    expect(todos).toMatchObject({ type: "array" });
    expect(todos.items.required).toEqual(expect.arrayContaining(["items", "duplicateOfTodoId"]));
    expect(todos.items.properties.items).toMatchObject({ type: "array" });
  });

  it.each(["{}", '{"title":123,"scheduledTime":null,"categoryId":null}'])(
    "스키마에 맞지 않는 출력 %s는 같은 업체에 한 번만 다시 묻고 INVALID_OUTPUT으로 끝내며 원문을 남기지 않는다",
    async (text) => {
      // Given
      fetchSpy.mockImplementation(async () => modelResponse(text));
      const logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
      const logWarn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      // When
      const error = await createGenerator()
        .generate(request({ prompt: "PROMPT_SECRET" }))
        .catch((cause: unknown) => cause);
      // Then
      expect(error).toBeInstanceOf(AiGenerationError);
      expect(error).toMatchObject({
        kind: "INVALID_OUTPUT",
        message: "INVALID_OUTPUT",
        attempts: 2,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(JSON.stringify([logError.mock.calls, logWarn.mock.calls])).not.toContain(
        "PROMPT_SECRET",
      );
    },
  );

  it("출력 토큰 한도로 잘린 응답은 TRUNCATED로 끝내고 다시 묻지 않는다", async () => {
    // Given
    fetchSpy.mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: { role: "model", parts: [{ text: '{"title":"독' }] },
            finishReason: "MAX_TOKENS",
          },
        ],
      }),
    );
    // When
    const execution = createGenerator().generate(request());
    // Then
    await expect(execution).rejects.toMatchObject({ kind: "TRUNCATED" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("응답 후보가 safety로 막히면 BLOCKED로 끝내고 다시 묻지 않는다", async () => {
    // Given
    fetchSpy.mockResolvedValue(
      Response.json({
        candidates: [{ content: { role: "model", parts: [] }, finishReason: "SAFETY" }],
      }),
    );
    // When
    const execution = createGenerator().generate(request());
    // Then
    await expect(execution).rejects.toMatchObject({ kind: "BLOCKED" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("마지막 업체의 503은 작업의 SDK 재시도 횟수만큼 다시 부른 뒤 상태 기호만 남긴다", async () => {
    // Given
    fetchSpy.mockImplementation(async () => {
      const response = aiProviderErrorResponse("google", "model-overloaded.503.json");
      return new Response(response.body, {
        status: response.status,
        headers: { "content-type": "application/json", "retry-after-ms": "0" },
      });
    });
    // When
    const error = await createGenerator()
      .generate(request())
      .catch((cause: unknown) => cause);
    // Then
    expect(error).toMatchObject({
      kind: "OVERLOADED",
      provider: "google",
      upstream: { errorType: "AI_APICallError", statusCode: 503, providerStatus: "UNAVAILABLE" },
    });
    expect(JSON.stringify(Reflect.get(Object(error), "upstream"))).not.toContain("overloaded");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("billing 문구가 든 일반 429는 결제 회로를 열지 않아 다음 요청도 Gemini를 부른다", async () => {
    // Given
    fetchSpy.mockImplementationOnce(async () => retryNow("billing-details-rate-limit.429.json"));
    fetchSpy.mockImplementationOnce(async () => retryNow("billing-details-rate-limit.429.json"));
    fetchSpy.mockImplementation(async () => modelResponse(JSON.stringify(output)));
    const config = createAiTestConfig({ AI_PROVIDER_ORDER: "google" });
    const { generator, alert } = createAiSdkGenerator(config, [new GoogleProviderAdapter(config)]);
    // When
    const failure = await generator.generate(request()).catch((cause: unknown) => cause);
    const next = await generator.generate(request({ prompt: "다음" }));
    // Then
    expect(failure).toMatchObject({ kind: "RATE_LIMITED", errorCode: "AI_1310" });
    expect(next.provider).toBe("google");
    expect(alert.alerts).toEqual([]);
  });

  it.each([
    { fixture: "prepayment-depleted.429.json", kind: "QUOTA_EXHAUSTED", calls: 1 },
    { fixture: "spending-cap.429.json", kind: "QUOTA_EXHAUSTED", calls: 1 },
    { fixture: "billing-details-rate-limit.429.json", kind: "RATE_LIMITED", calls: 2 },
  ] as const)(
    "마지막 업체의 $fixture 응답은 $kind 실패이고 SDK가 모두 $calls 번 부른다",
    async ({ fixture, kind, calls }) => {
      // Given
      fetchSpy.mockImplementation(async () => retryNow(fixture));
      // When
      const failure = await createGenerator()
        .generate(request())
        .catch((cause: unknown) => cause);
      // Then
      expect(failure).toMatchObject({ kind });
      expect(fetchSpy).toHaveBeenCalledTimes(calls);
    },
  );

  it("본문 없이 출력 상한으로 끝난 응답은 TRUNCATED로 끝내고 다시 묻지도 넘기지도 않는다", async () => {
    // Given
    fetchSpy.mockResolvedValue(
      Response.json({
        candidates: [{ content: { role: "model", parts: [] }, finishReason: "MAX_TOKENS" }],
      }),
    );
    // When
    const execution = createGenerator().generate(request());
    // Then
    await expect(execution).rejects.toMatchObject({ kind: "TRUNCATED", attempts: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("네트워크 오류는 원인 체인의 오류 code만 남긴다", async () => {
    // Given
    // undici가 연결이 끊겼을 때 던지는 모양
    const reset = Object.assign(new Error("SECRET_SOCKET_DETAIL"), { code: "ECONNRESET" });
    fetchSpy.mockRejectedValue(new TypeError("fetch failed", { cause: reset }));
    const adapter = new GoogleProviderAdapter(createAiTestConfig());
    // When
    const error = await captureProviderError(adapter);
    // Then
    expect(adapter.classifyError(error)).toBe("UPSTREAM");
    expect(describeUpstreamCause(error)).toMatchObject({ networkCode: "ECONNRESET" });
    expect(JSON.stringify(describeUpstreamCause(error))).not.toContain("SECRET");
  });
});
