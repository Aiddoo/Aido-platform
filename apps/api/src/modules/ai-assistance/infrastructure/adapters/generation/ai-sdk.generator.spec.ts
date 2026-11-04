import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";
import { Logger } from "@nestjs/common";
import { z } from "zod";

import { ok, status, StubProviderAdapter } from "#test/mocks/ai-provider-adapter.stub";
import { createAiTestConfig, RecordingAiProviderAlert } from "#test/mocks/ai-provider-http.stub";

import { AiGenerationError } from "../../../application/ports/generation/ai-generation.errors.js";
import { AiProviderCircuitRegistry } from "./ai-provider-circuit.registry.js";
import { AiSdkGenerator } from "./ai-sdk.generator.js";

const schema = z.object({ title: z.string() });

interface ChainInput {
  readonly anthropic?: StubProviderAdapter;
  readonly google?: StubProviderAdapter;
  readonly openai?: StubProviderAdapter;
  readonly env?: Record<string, string>;
}

function createChain(input: ChainInput) {
  const anthropic =
    input.anthropic ?? new StubProviderAdapter("anthropic", [ok()], "claude-haiku-5-5");
  const google = input.google ?? new StubProviderAdapter("google", [ok()], "gemini-3.1-flash-lite");
  const openai = input.openai ?? new StubProviderAdapter("openai", [ok()], "gpt-6-luna");
  const config = createAiTestConfig(input.env);
  const generator = new AiSdkGenerator(
    config,
    [anthropic, google, openai],
    new AiProviderCircuitRegistry(config, new RecordingAiProviderAlert()),
  );
  return { generator, anthropic, google, openai };
}

function generate(
  generator: AiSdkGenerator,
  agreedConsentVersion: AiDataSharingConsentVersion | null = "2026-11-04",
) {
  return generator.generate({
    task: "parse-todo",
    promptVersion: "parse-todo@test",
    system: "규칙",
    prompt: "PRIVATE_PROMPT",
    schema,
    agreedConsentVersion,
  });
}

describe("AiSdkGenerator — 업체 체인·폴백·제한 시간", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("첫 업체가 성공하면 다음 업체를 부르지 않고 업체·모델·비용을 돌려준다", async () => {
    // Given
    const chain = createChain({});
    // When
    const result = await generate(chain.generator);
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
    expect([chain.google.callCount, chain.openai.callCount]).toEqual([0, 0]);
  });

  it("Claude 크레딧 소진(402)이면 Gemini로 넘기고 폴백 이벤트에 업체와 실패 종류만 남긴다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result).toMatchObject({
      provider: "google",
      model: "google:gemini-3.1-flash-lite",
      attempts: 2,
      fallbackFrom: "anthropic",
      estimatedCostMicroUsd: 1000 * 0.25 + 200 * 1.5,
    });
    expect(warn).toHaveBeenCalledWith({
      event: "ai.provider.fallback",
      task: "parse-todo",
      from: "anthropic",
      to: "google",
      errorType: "QUOTA_EXHAUSTED",
      statusCode: 402,
    });
    expect(JSON.stringify([warn.mock.calls, error.mock.calls])).not.toContain("PRIVATE_PROMPT");
  });

  it.each([
    { name: "429·503", steps: [status(429), status(503)], kind: "OVERLOADED" },
    { name: "요청 오류(400)", steps: [status(400), status(400)], kind: "BAD_REQUEST" },
  ] as const)(
    "$name가 이어지면 세 업체를 차례로 시도하고 마지막 실패 종류로 끝낸다",
    async ({ steps, kind }) => {
      // Given
      const chain = createChain({
        anthropic: new StubProviderAdapter("anthropic", [status(503)], "claude-haiku-5-5"),
        google: new StubProviderAdapter("google", [steps[0]], "gemini-3.1-flash-lite"),
        openai: new StubProviderAdapter("openai", [steps[1]], "gpt-6-luna"),
      });
      // When
      const failure = await generate(chain.generator).catch((cause: unknown) => cause);
      // Then
      expect(failure).toBeInstanceOf(AiGenerationError);
      expect(failure).toMatchObject({
        kind,
        provider: "openai",
        attempts: 3,
        fallbackFrom: "anthropic",
      });
      expect([chain.anthropic.callCount, chain.google.callCount, chain.openai.callCount]).toEqual([
        1, 1, 1,
      ]);
    },
  );

  it("모든 업체가 요청 한도(429)에 걸리면 RATE_LIMITED이고 AI_1310으로 응답한다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [status(429)], "claude-haiku-5-5"),
      google: new StubProviderAdapter("google", [status(429)], "gemini-3.1-flash-lite"),
      openai: new StubProviderAdapter("openai", [status(429)], "gpt-6-luna"),
    });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "RATE_LIMITED", errorCode: "AI_1310" });
  });

  it("요청 오류(400)로 넘길 때는 사람이 확인하도록 error로 남긴다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [status(400)], "claude-haiku-5-5"),
    });
    // When
    await generate(chain.generator);
    // Then
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.provider.fallback", errorType: "BAD_REQUEST" }),
    );
  });

  it.each([
    { reason: "content-filter", kind: "BLOCKED" },
    { reason: "length", kind: "TRUNCATED" },
  ] as const)(
    "$kind는 다른 업체도 같게 실패하므로 넘기지 않고 AI_1302로 끝낸다",
    async ({ reason, kind }) => {
      // Given
      const chain = createChain({
        anthropic: new StubProviderAdapter(
          "anthropic",
          [{ type: "finish", reason, text: '{"title":"독' }],
          "claude-haiku-5-5",
        ),
      });
      // When
      const failure = await generate(chain.generator).catch((cause: unknown) => cause);
      // Then
      expect(failure).toMatchObject({ kind, errorCode: "AI_1302", attempts: 1 });
      expect([chain.anthropic.callCount, chain.google.callCount]).toEqual([1, 0]);
    },
  );

  it("스키마에 맞지 않는 출력은 업체마다 한 번 더 묻고 그래도 틀리면 다음 업체로 넘긴다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok("{}")], "claude-haiku-5-5"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result).toMatchObject({ provider: "google", attempts: 3, fallbackFrom: "anthropic" });
    expect([chain.anthropic.callCount, chain.google.callCount]).toEqual([2, 1]);
    // 출력 검증에 실패한 두 번의 Claude 호출 토큰도 비용에 더한다.
    expect(result.estimatedCostMicroUsd).toBe(
      2 * (1000 * 0.1 + 200 * 0.5) + 1000 * 0.25 + 200 * 1.5,
    );
  });

  it("빈 출력은 INVALID_OUTPUT으로 보고 같은 업체에 한 번 더 묻는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok(" "), ok()], "claude-haiku-5-5"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result).toMatchObject({ provider: "anthropic", attempts: 2 });
  });

  it("체인 전체 제한 시간이 지나면 남은 업체를 부르지 않고 TIMEOUT으로 끝낸다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_DEADLINE_PARSE_TODO_MS: "30" },
    });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "TIMEOUT", errorCode: "AI_1301", provider: "anthropic" });
    expect(chain.google.callCount).toBe(0);
  });

  it.each([
    { consent: "2026-10-26", expected: "google" },
    { consent: null, expected: "google" },
    { consent: "2026-11-04", expected: "anthropic" },
  ] as const)("동의 버전 $consent이면 $expected부터 보낸다", async ({ consent, expected }) => {
    // Given
    const chain = createChain({});
    // When
    const result = await generate(chain.generator, consent);
    // Then
    expect(result.provider).toBe(expected);
    if (expected === "google") {
      expect(chain.anthropic.callCount).toBe(0);
    }
  });

  it("출시 앱 동의 사용자는 Gemini가 실패해도 동의하지 않은 업체로 넘기지 않는다", async () => {
    // Given
    const chain = createChain({
      google: new StubProviderAdapter("google", [status(503)], "gemini-3.1-flash-lite"),
    });
    // When
    const failure = await generate(chain.generator, "2026-10-26").catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "OVERLOADED", provider: "google", attempts: 1 });
    expect([chain.anthropic.callCount, chain.openai.callCount]).toEqual([0, 0]);
  });

  it("동의 범위 안에 키가 있는 업체가 없으면 호출 없이 UNAVAILABLE(AI_1301)이다", async () => {
    // Given
    const chain = createChain({
      google: new StubProviderAdapter("google", [ok()], "gemini-3.1-flash-lite", false),
    });
    // When
    const failure = await generate(chain.generator, "2026-10-26").catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "UNAVAILABLE", errorCode: "AI_1301", attempts: 0 });
    expect(chain.anthropic.callCount).toBe(0);
  });

  it("AI_PROVIDER_ORDER 순서를 따른다", async () => {
    // Given
    const chain = createChain({ env: { AI_PROVIDER_ORDER: "openai,anthropic" } });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result.provider).toBe("openai");
  });

  it("앞 업체는 재시도 가능한 오류도 SDK 재시도 없이 바로 다음 업체로 넘긴다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [status(503, true)], "claude-haiku-5-5"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result.provider).toBe("google");
    expect(chain.anthropic.callCount).toBe(1);
  });
});
