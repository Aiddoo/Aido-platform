import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";
import { Logger } from "@nestjs/common";
import { z } from "zod";

import { DateClock } from "#test/doubles/platform/date-clock";
import { ok, status, StubProviderAdapter } from "#test/mocks/ai-provider-adapter.stub";
import { createAiSdkGenerator, createAiTestConfig } from "#test/mocks/ai-provider-http.stub";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { AiAlerts } from "../../application/ai-generation.alerts.js";
import { AiGenerationError, isTransientAiFailure } from "../../application/ai-generation.errors.js";
import type { AiGenerationRequest } from "../../application/ports/ai-generator.port.js";
import { AiSpendBudgetAdapter } from "./ai-spend-budget.adapter.js";

const schema = z.object({ title: z.string() });
const NOW = new Date("2026-11-05T03:00:00.000Z");

interface ChainInput {
  readonly anthropic?: StubProviderAdapter;
  readonly google?: StubProviderAdapter;
  readonly openai?: StubProviderAdapter;
  readonly env?: Record<string, string>;
  readonly meter?: InMemoryUsageMeterAdapter;
}

function createChain(input: ChainInput) {
  const anthropic =
    input.anthropic ?? new StubProviderAdapter("anthropic", [ok()], "claude-haiku-5-5");
  const google = input.google ?? new StubProviderAdapter("google", [ok()], "gemini-3.1-flash-lite");
  const openai = input.openai ?? new StubProviderAdapter("openai", [ok()], "gpt-6-luna");
  const meter = input.meter ?? new InMemoryUsageMeterAdapter();
  const config = createAiTestConfig(input.env);
  const { generator, alert, registry } = createAiSdkGenerator(config, [anthropic, google, openai], {
    meter,
  });
  return { generator, alert, registry, meter, anthropic, google, openai };
}

function request(
  overrides: Partial<AiGenerationRequest<{ title: string }>> = {},
): AiGenerationRequest<{ title: string }> {
  return {
    task: "parse-todo",
    taskClass: "interactive",
    userId: "user-1",
    maxInputChars: 5000,
    promptVersion: "parse-todo@test",
    system: "규칙",
    prompt: "PRIVATE_PROMPT",
    schema,
    agreedConsentVersion: "2026-11-04",
    ...overrides,
  };
}

function generate(
  generator: ReturnType<typeof createChain>["generator"],
  agreedConsentVersion: AiDataSharingConsentVersion | null = "2026-11-04",
) {
  return generator.generate(request({ agreedConsentVersion }));
}

const spendKey = (periodKey: string, subject = "*") => ({
  meter: "ai.spend",
  periodKey,
  subject,
});

describe("AiSpendBudgetAdapter — 기동 검사", () => {
  it("가격표에 없는 모델이 설정되면 기동 때 경보를 올린다", () => {
    // Given
    const config = createAiTestConfig({ AI_MODEL_ANTHROPIC: "claude-unknown-9" });
    const alert = new RecordingOperationalAlert();
    const guard = new AiSpendBudgetAdapter(
      config,
      new InMemoryUsageMeterAdapter(),
      alert,
      new DateClock(),
    );
    // When
    guard.onModuleInit();
    // Then
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "ai.spend.model-pricing-unknown",
        details: { providers: "anthropic" },
      }),
    ]);
  });

  it("기본 모델은 경보를 올리지 않는다", () => {
    // Given
    const alert = new RecordingOperationalAlert();
    const guard = new AiSpendBudgetAdapter(
      createAiTestConfig(),
      new InMemoryUsageMeterAdapter(),
      alert,
      new DateClock(),
    );
    // When
    guard.onModuleInit();
    // Then
    expect(alert.alerts).toEqual([]);
  });
});

describe("AiSdkGeneratorAdapter — 업체 체인·폴백·제한 시간", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
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

  it("스키마에 맞지 않는 출력은 첫 업체에 한 번 더 묻고 그래도 틀리면 다음 업체로 넘긴다", async () => {
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

  it("스키마 불일치 재질문은 첫 업체에만 하고 다음 업체는 한 번만 부른다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok("{}")], "claude-haiku-5-5"),
      google: new StubProviderAdapter("google", [ok("{}")], "gemini-3.1-flash-lite"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result).toMatchObject({ provider: "openai", attempts: 4 });
    expect([chain.anthropic.callCount, chain.google.callCount, chain.openai.callCount]).toEqual([
      2, 1, 1,
    ]);
  });

  it("배경 작업은 한 요청에서 모델을 세 번까지만 부른다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok("{}")], "claude-haiku-5-5"),
      google: new StubProviderAdapter("google", [ok("{}")], "gemini-3.1-flash-lite"),
    });
    // When
    const failure = await chain.generator
      .generate(request({ task: "report", taskClass: "background", maxInputChars: 16_000 }))
      .catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "INVALID_OUTPUT", attempts: 3 });
    expect(chain.openai.callCount).toBe(0);
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
      env: { AI_DEADLINE_PARSE_TODO_MS: "30", AI_PROVIDER_ORDER: "anthropic" },
    });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "TIMEOUT", errorCode: "AI_1301", provider: "anthropic" });
    expect(chain.google.callCount).toBe(0);
  });

  it("앞 업체가 응답하지 않으면 자기 몫에서 끊고 다음 업체로 넘긴다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_DEADLINE_PARSE_TODO_MS: "200" },
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result).toMatchObject({ provider: "google", fallbackFrom: "anthropic", attempts: 2 });
    expect(result.latencyMs).toBeLessThan(200);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.provider.fallback", errorType: "TIMEOUT" }),
    );
  });

  it.each([
    { order: "anthropic,google,openai", providers: ["anthropic", "google", "openai"] },
    { order: "openai,anthropic,google", providers: ["openai", "anthropic", "google"] },
    { order: "google,openai,anthropic", providers: ["google", "openai", "anthropic"] },
  ] as const)(
    "$order 순서에서 앞 두 업체가 모두 멈춰도 세 번째 업체가 불려 답한다",
    async ({ order, providers }) => {
      // Given
      const [first, second, third] = providers;
      const adapters = {
        anthropic: new StubProviderAdapter(
          "anthropic",
          [third === "anthropic" ? ok() : { type: "hang" }],
          "claude-haiku-5-5",
        ),
        google: new StubProviderAdapter(
          "google",
          [third === "google" ? ok() : { type: "hang" }],
          "gemini-3.1-flash-lite",
        ),
        openai: new StubProviderAdapter(
          "openai",
          [third === "openai" ? ok() : { type: "hang" }],
          "gpt-6-luna",
        ),
      };
      const chain = createChain({
        ...adapters,
        env: { AI_DEADLINE_PARSE_TODO_MS: "400", AI_PROVIDER_ORDER: order },
      });
      // When
      const result = await generate(chain.generator);
      // Then
      expect(result).toMatchObject({ provider: third, fallbackFrom: first, attempts: 3 });
      expect([adapters[first].callCount, adapters[second].callCount]).toEqual([1, 1]);
      expect(result.latencyMs).toBeLessThan(400);
    },
  );

  it("앞 업체가 멈춰도 자기 몫을 받은 뒤 업체의 TIMEOUT은 장애 회로에 쌓는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      google: new StubProviderAdapter("google", [{ type: "hang" }], "gemini-3.1-flash-lite"),
      env: { AI_DEADLINE_PARSE_TODO_MS: "400", AI_BREAKER_HEALTH_THRESHOLD: "2" },
    });
    // When
    for (const prompt of ["첫 요청", "둘째 요청"]) {
      await chain.generator.generate(request({ prompt }));
    }
    // Then
    expect(chain.google.callCount).toBe(2);
    expect(chain.openai.callCount).toBe(2);
    expect(chain.registry.getStates()["ai:google"]?.openBreakers).toEqual(["health"]);
  });

  it("앞 업체의 재질문에 시간을 뺏겨 몫보다 적게 받은 업체의 TIMEOUT은 장애 회로에 쌓지 않는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter(
        "anthropic",
        [{ type: "ok", text: "not json", delayMs: 160 }, { type: "hang" }],
        "claude-haiku-5-5",
      ),
      google: new StubProviderAdapter("google", [{ type: "hang" }], "gemini-3.1-flash-lite"),
      env: {
        AI_PROVIDER_ORDER: "anthropic,google",
        AI_DEADLINE_PARSE_TODO_MS: "400",
        AI_BREAKER_HEALTH_THRESHOLD: "1",
      },
    });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "TIMEOUT", provider: "google" });
    expect(chain.google.callCount).toBe(1);
    expect(chain.registry.getStates()["ai:google"]?.openBreakers).toEqual([]);
  });

  it("정해진 시간을 온전히 받은 업체의 TIMEOUT은 장애 회로에 쌓는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: {
        AI_PROVIDER_ORDER: "anthropic",
        AI_DEADLINE_PARSE_TODO_MS: "20",
        AI_BREAKER_HEALTH_THRESHOLD: "2",
      },
    });
    // When
    for (const prompt of ["첫 요청", "둘째 요청"]) {
      await chain.generator.generate(request({ prompt })).catch((cause: unknown) => cause);
    }
    // Then
    expect(chain.registry.getStates()["ai:anthropic"]?.openBreakers).toEqual(["health"]);
  });

  it("호출자가 끊은 시도는 업체 장애로 세지 않는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic", AI_BREAKER_HEALTH_THRESHOLD: "1" },
    });
    const controller = new AbortController();
    // When
    const pending = chain.generator
      .generate(request({ signal: controller.signal }))
      .catch((cause: unknown) => cause);
    await vi.waitFor(() => expect(chain.anthropic.callCount).toBe(1));
    controller.abort();
    const failure = await pending;
    // Then
    expect(failure).toMatchObject({ kind: "TIMEOUT" });
    expect(chain.registry.getStates()["ai:anthropic"]?.openBreakers).toEqual([]);
  });

  it("추론 토큰이 상한을 다 써 본문 없이 끝나면 TRUNCATED이고 다시 묻지도 넘기지도 않는다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter(
        "anthropic",
        [{ type: "finish", reason: "length", text: "" }],
        "claude-haiku-5-5",
      ),
    });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "TRUNCATED", errorCode: "AI_1302", attempts: 1 });
    expect([chain.anthropic.callCount, chain.google.callCount]).toEqual([1, 0]);
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

  it("같은 사용자의 같은 요청이 동시에 오면 업체 호출 하나를 나눠 쓴다", async () => {
    // Given
    const chain = createChain({});
    // When
    const [first, second] = await Promise.all([
      generate(chain.generator),
      generate(chain.generator),
    ]);
    // Then
    expect(first.output).toEqual(second.output);
    expect(chain.anthropic.callCount).toBe(1);
  });

  it("제한 시간은 대기열을 지난 뒤부터 재므로 기다린 요청도 업체를 부른다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic", AI_DEADLINE_REPORT_MS: "30" },
    });
    // When
    await Promise.all(
      [1, 2, 3].map((index) =>
        chain.generator
          .generate(request({ task: "report", taskClass: "background", prompt: `리포트 ${index}` }))
          .catch((cause: unknown) => cause),
      ),
    );
    // Then
    expect(chain.anthropic.callCount).toBe(3);
  });

  it("앱이 대기열에서 끊으면 업체를 부르지 않고 TIMEOUT으로 끝낸다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic", AI_DEADLINE_REPORT_MS: "50" },
    });
    const controller = new AbortController();
    const running = [1, 2].map((index) =>
      chain.generator
        .generate(request({ task: "report", taskClass: "background", prompt: `앞선 ${index}` }))
        .catch((cause: unknown) => cause),
    );
    // When
    const queued = chain.generator
      .generate(
        request({
          task: "report",
          taskClass: "background",
          prompt: "기다리는 요청",
          signal: controller.signal,
        }),
      )
      .catch((cause: unknown) => cause);
    controller.abort();
    // Then
    await expect(queued).resolves.toMatchObject({ kind: "TIMEOUT" });
    await Promise.all(running);
    expect(chain.anthropic.callCount).toBe(2);
  });

  it("동시 호출과 대기열을 넘친 사용자 요청은 업체를 부르지 않고 RATE_LIMITED(AI_1310)로 끝낸다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic", AI_DEADLINE_PARSE_TODO_MS: "30" },
    });
    // When
    const failures = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        chain.generator
          .generate(request({ prompt: `요청 ${index}` }))
          .catch((cause: unknown) => cause),
      ),
    );
    // Then
    const limited = failures.filter(
      (failure) => failure instanceof AiGenerationError && failure.kind === "RATE_LIMITED",
    );
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({ errorCode: "AI_1310", attempts: 0 });
    expect(chain.anthropic.callCount).toBeLessThanOrEqual(24);
  });

  it("같은 요청을 합쳐도 실패는 기다리던 요청 모두에 같은 종류로 전해진다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic" },
    });
    // When
    const failures = await Promise.all([
      generate(chain.generator).catch((cause: unknown) => cause),
      generate(chain.generator).catch((cause: unknown) => cause),
    ]);
    // Then
    expect(failures).toEqual([
      expect.objectContaining({ kind: "QUOTA_EXHAUSTED" }),
      expect.objectContaining({ kind: "QUOTA_EXHAUSTED" }),
    ]);
    expect(chain.anthropic.callCount).toBe(1);
  });

  it("다른 사용자의 같은 프롬프트는 합치지 않는다", async () => {
    // Given
    const chain = createChain({});
    // When
    await Promise.all([
      chain.generator.generate(request({ userId: "user-1" })),
      chain.generator.generate(request({ userId: "user-2" })),
    ]);
    // Then
    expect(chain.anthropic.callCount).toBe(2);
  });
});

describe("AiSdkGeneratorAdapter — 입력 상한·킬 스위치·비용 예산", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("user 턴이 작업 입력 상한을 넘으면 업체를 부르지 않고 BAD_REQUEST(AI_1302)로 끝내고 error로 남긴다", async () => {
    // Given
    const chain = createChain({});
    // When
    const failure = await chain.generator
      .generate(request({ prompt: "가".repeat(11), maxInputChars: 10 }))
      .catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "BAD_REQUEST", errorCode: "AI_1302", attempts: 0 });
    expect(chain.anthropic.callCount).toBe(0);
    expect(error).toHaveBeenCalledWith({
      event: "ai.generation.input-rejected",
      task: "parse-todo",
      inputChars: 11,
      maxInputChars: 10,
    });
  });

  it.each([
    { mode: "off", taskClass: "interactive", task: "parse-todo" },
    { mode: "off", taskClass: "background", task: "report" },
    { mode: "interactive-only", taskClass: "background", task: "suggestion" },
  ] as const)(
    "AI_GENERATION_MODE=$mode이면 $taskClass 생성은 업체를 부르지 않고 HALTED(AI_1301)다",
    async ({ mode, taskClass, task }) => {
      // Given
      const chain = createChain({ env: { AI_GENERATION_MODE: mode } });
      // When
      const failure = await chain.generator
        .generate(request({ task, taskClass, maxInputChars: 16_000 }))
        .catch((cause: unknown) => cause);
      // Then
      expect(failure).toMatchObject({ kind: "HALTED", errorCode: "AI_1301", attempts: 0 });
      expect(chain.anthropic.callCount).toBe(0);
      expect(warn).toHaveBeenCalledWith({
        event: "ai.spend.halted",
        task,
        taskClass,
        reason: "kill-switch",
      });
    },
  );

  it("AI_GENERATION_MODE=interactive-only여도 사용자 요청은 그대로 생성한다", async () => {
    // Given
    const chain = createChain({ env: { AI_GENERATION_MODE: "interactive-only" } });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result.provider).toBe("anthropic");
  });

  it("오늘 전역 추정 비용이 전체 중단 기준선에 닿았으면 호출 없이 HALTED다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    await meter.add([{ key: spendKey("2026-11-05"), amount: 3_000_000 }]);
    const chain = createChain({ meter });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "HALTED", errorCode: "AI_1301" });
    expect(chain.anthropic.callCount).toBe(0);
  });

  it("배경 중단 기준선(일 $2)을 넘으면 배경 작업만 멈추고 사용자 요청은 계속 받는다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    await meter.add([{ key: spendKey("2026-11-05"), amount: 2_000_000 }]);
    const chain = createChain({ meter });
    // When
    const background = await chain.generator
      .generate(request({ task: "report", taskClass: "background", maxInputChars: 16_000 }))
      .catch((cause: unknown) => cause);
    const interactive = await generate(chain.generator);
    // Then
    expect(background).toMatchObject({ kind: "HALTED" });
    expect(interactive.provider).toBe("anthropic");
  });

  it("이번 달 전역 추정 비용이 월 상한에 닿았으면 HALTED다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    await meter.add([{ key: spendKey("2026-11"), amount: 30_000_000 }]);
    const chain = createChain({ meter });
    // When
    const failure = await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ kind: "HALTED" });
  });

  it("사용자 일 예산을 다 쓰면 그 사용자만 USER_SPEND_LIMITED(AI_1310)이고 다른 사용자는 계속 쓴다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    await meter.add([{ key: spendKey("2026-11-05", "user-1"), amount: 250_000 }]);
    const chain = createChain({ meter });
    // When
    const limited = await chain.generator
      .generate(request({ userId: "user-1" }))
      .catch((cause: unknown) => cause);
    const other = await chain.generator.generate(request({ userId: "user-2" }));
    // Then
    expect(limited).toMatchObject({ kind: "USER_SPEND_LIMITED", errorCode: "AI_1310" });
    expect(other.provider).toBe("anthropic");
    expect(chain.anthropic.callCount).toBe(1);
  });

  it("요청이 끝나면 실패한 시도까지 더한 추정 비용을 전역 일·월·사용자 일에 한 번씩 더한다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok("{}")], "claude-haiku-5-5"),
    });
    // When
    await generate(chain.generator);
    // Then
    const expected = 2 * (1000 * 0.1 + 200 * 0.5) + 1000 * 0.25 + 200 * 1.5;
    expect(
      await chain.meter.read([
        spendKey("2026-11-05"),
        spendKey("2026-11"),
        spendKey("2026-11-05", "user-1"),
      ]),
    ).toEqual([expected, expected, expected]);
  });

  it("단가를 모르는 모델은 최고 단가로 출력 상한까지 쓴 것으로 예산에 더한다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [ok()], "claude-unknown"),
    });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result.estimatedCostMicroUsd).toBeNull();
    const [daily] = await chain.meter.read([spendKey("2026-11-05")]);
    expect(daily).toBe(Math.round("규칙PRIVATE_PROMPT".length * 0.25 + 1024 * 1.5));
  });

  it("계량 저장소가 실패해도 생성은 막지 않고 원인 종류만 error로 남긴다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    vi.spyOn(meter, "read").mockRejectedValue(new TypeError("db down"));
    vi.spyOn(meter, "add").mockRejectedValue(new TypeError("db down"));
    const chain = createChain({ meter });
    // When
    const result = await generate(chain.generator);
    // Then
    expect(result.provider).toBe("anthropic");
    expect(error).toHaveBeenCalledWith({ event: "ai.spend.read-failed", errorType: "TypeError" });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.spend.record-failed", errorType: "TypeError" }),
    );
  });

  it("사용량 없이 시간 초과로 끝난 호출은 입력 글자 수만큼 입력 비용을 예산에 더한다", async () => {
    // Given
    const chain = createChain({
      anthropic: new StubProviderAdapter("anthropic", [{ type: "hang" }], "claude-haiku-5-5"),
      env: { AI_PROVIDER_ORDER: "anthropic", AI_DEADLINE_PARSE_TODO_MS: "30" },
    });
    // When
    await generate(chain.generator).catch((cause: unknown) => cause);
    // Then
    const [daily] = await chain.meter.read([spendKey("2026-11-05")]);
    expect(daily).toBe(Math.round("규칙PRIVATE_PROMPT".length * 0.1));
  });

  it("경고 기준선을 처음 넘긴 요청 하나만 운영 경보를 올린다", async () => {
    // Given
    const meter = new InMemoryUsageMeterAdapter();
    await meter.add([{ key: spendKey("2026-11-05"), amount: 999_900 }]);
    const chain = createChain({ meter });
    // When
    await generate(chain.generator);
    await chain.generator.generate(request({ prompt: "다른 요청" }));
    // Then
    expect(chain.alert.alerts).toEqual([
      expect.objectContaining({
        key: "ai.spend.threshold-reached",
        severity: "warning",
        tags: { tier: "alert", window: "daily" },
      }),
    ]);
  });
});

describe("AiSdkGeneratorAdapter — 업체 회로 (공용 OutboundPolicy, 가짜 시계)", () => {
  const MINUTE = 60_000;
  let log: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  function createCircuitChain(anthropic: StubProviderAdapter) {
    const chain = createChain({ anthropic });
    const generateQuickPlan = () =>
      chain.generator.generate(
        request({ task: "quick-plan", promptVersion: "quick-plan@test", maxInputChars: 12_000 }),
      );
    return { ...chain, generateQuickPlan };
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("401은 한 번으로 열지 않고 연속 세 번째에 인증 회로를 열고 경보를 올린다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(401)], "claude-haiku-5-5"),
    );
    // When
    const providers: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      vi.setSystemTime(NOW.getTime() + (index + 1) * MINUTE);
      providers.push((await chain.generateQuickPlan()).provider);
    }
    // Then
    expect(providers).toEqual(["google", "google", "google", "google"]);
    expect(chain.anthropic.callCount).toBe(3);
    expect(chain.alert.alerts).toEqual([
      expect.objectContaining({
        key: "ai.provider.auth-circuit-opened",
        tags: expect.objectContaining({ breaker: "auth", reason: "AUTH" }),
      }),
    ]);
  });

  it("Claude 402 한 번이면 결제 회로를 열고 경보를 한 번 올린 뒤 차단 시간 동안 Claude를 건너뛴다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
    );
    // When
    const first = await chain.generateQuickPlan();
    vi.setSystemTime(NOW.getTime() + 14 * MINUTE);
    const second = await chain.generateQuickPlan();
    // Then
    expect([first.provider, second.provider]).toEqual(["google", "google"]);
    expect(second.fallbackFrom).toBeNull();
    expect(chain.anthropic.callCount).toBe(1);
    expect(chain.alert.alerts).toEqual([
      {
        ...AiAlerts.PROVIDER_BILLING_CIRCUIT_OPENED,
        tags: {
          policy: "ai:anthropic",
          breaker: "billing",
          reason: "QUOTA_EXHAUSTED",
          task: "quick-plan",
        },
        details: { cooldownMs: 15 * MINUTE },
      },
    ]);
    expect(warn).toHaveBeenCalledWith({
      event: "outbound.circuit.opened",
      policy: "ai:anthropic",
      breaker: "billing",
      cooldownMs: 15 * MINUTE,
      reason: "QUOTA_EXHAUSTED",
      task: "quick-plan",
    });
  });

  it("차단 시간이 지나면 시험 호출로 Claude를 다시 부르고 성공하면 회로를 닫는다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(402), ok()], "claude-haiku-5-5"),
    );
    await chain.generateQuickPlan();
    // When
    vi.setSystemTime(NOW.getTime() + 15 * MINUTE);
    const recovered = await chain.generateQuickPlan();
    const next = await chain.generator.generate(
      request({ task: "quick-plan", prompt: "다음", maxInputChars: 12_000 }),
    );
    // Then
    expect([recovered.provider, next.provider]).toEqual(["anthropic", "anthropic"]);
    expect(chain.alert.alerts).toHaveLength(1);
    expect(log).toHaveBeenCalledWith({
      event: "outbound.circuit.half-open",
      policy: "ai:anthropic",
      breaker: "billing",
    });
    expect(log).toHaveBeenCalledWith({
      event: "outbound.circuit.closed",
      policy: "ai:anthropic",
      breaker: "billing",
    });
  });

  it("시험 호출도 크레딧 소진이면 다시 열고 다음 차단 시간 동안 건너뛴다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
    );
    await chain.generateQuickPlan();
    vi.setSystemTime(NOW.getTime() + 15 * MINUTE);
    await chain.generateQuickPlan();
    // When
    const skipped = await chain.generator.generate(
      request({ task: "quick-plan", prompt: "다음", maxInputChars: 12_000 }),
    );
    // Then
    expect(chain.anthropic.callCount).toBe(2);
    expect(skipped).toMatchObject({ provider: "google", fallbackFrom: null });
  });

  it("일시 장애는 연속 다섯 번째에 장애 회로를 30초 열고 네 번까지는 계속 시도한다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(503)], "claude-haiku-5-5"),
    );
    const call = (index: number) =>
      chain.generator.generate(
        request({ task: "quick-plan", prompt: `요청 ${index}`, maxInputChars: 12_000 }),
      );
    // When
    for (let index = 0; index < 5; index += 1) {
      await call(index);
    }
    await call(5);
    const duringCooldown = chain.anthropic.callCount;
    vi.setSystemTime(NOW.getTime() + 30_000);
    await call(6);
    // Then
    expect(duringCooldown).toBe(5);
    expect(chain.anthropic.callCount).toBe(6);
    expect(chain.alert.alerts).toEqual([]);
  });

  it("장애 사이에 한 번이라도 성공하면 연속 횟수를 다시 센다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter(
        "anthropic",
        [status(503), status(503), status(503), status(503), ok(), status(503), ok()],
        "claude-haiku-5-5",
      ),
    );
    // When
    for (let index = 0; index < 7; index += 1) {
      await chain.generator.generate(
        request({ task: "quick-plan", prompt: `요청 ${index}`, maxInputChars: 12_000 }),
      );
    }
    // Then
    expect(chain.anthropic.callCount).toBe(7);
  });

  it("요청 한도·출력 오류는 회로를 열지 않는다", async () => {
    // Given
    const chain = createCircuitChain(
      new StubProviderAdapter("anthropic", [status(429)], "claude-haiku-5-5"),
    );
    // When
    for (let index = 0; index < 6; index += 1) {
      await chain.generator.generate(
        request({ task: "quick-plan", prompt: `요청 ${index}`, maxInputChars: 12_000 }),
      );
    }
    // Then
    expect(chain.anthropic.callCount).toBe(6);
  });

  it("보낼 업체의 회로가 모두 열려 있으면 일시 실패 CIRCUIT_OPEN이고 키가 없는 경우와 구분한다", async () => {
    // Given
    const chain = createChain({
      google: new StubProviderAdapter("google", [status(402)], "gemini-3.1-flash-lite"),
    });
    const noKey = createChain({
      google: new StubProviderAdapter("google", [ok()], "gemini-3.1-flash-lite", false),
    });
    await generate(chain.generator, "2026-10-26").catch((cause: unknown) => cause);
    // When
    const open = await generate(chain.generator, "2026-10-26").catch((cause: unknown) => cause);
    const unavailable = await generate(noKey.generator, "2026-10-26").catch(
      (cause: unknown) => cause,
    );
    // Then
    expect(open).toMatchObject({ kind: "CIRCUIT_OPEN", errorCode: "AI_1301", attempts: 0 });
    expect(isTransientAiFailure("CIRCUIT_OPEN")).toBe(true);
    expect(chain.alert.alerts.map((alert) => alert.key)).toEqual([
      AiAlerts.PROVIDER_BILLING_CIRCUIT_OPENED.key,
      AiAlerts.ALL_PROVIDERS_CIRCUIT_OPEN.key,
    ]);
    expect(noKey.alert.alerts).toEqual([]);
    expect(unavailable).toMatchObject({ kind: "UNAVAILABLE", errorCode: "AI_1301" });
    expect(isTransientAiFailure("UNAVAILABLE")).toBe(false);
    expect(chain.google.callCount).toBe(1);
  });

  it("리포트의 시험 호출이 끝나지 않아도 짧은 요청은 기다리지 않고 다음 업체로 간다", async () => {
    // Given
    const anthropic = new StubProviderAdapter(
      "anthropic",
      [status(402), { type: "hang" }],
      "claude-haiku-5-5",
    );
    const chain = createCircuitChain(anthropic);
    await chain.generateQuickPlan();
    vi.setSystemTime(NOW.getTime() + 15 * MINUTE);
    const controller = new AbortController();
    const probe = chain.generator
      .generate(
        request({
          task: "report",
          taskClass: "background",
          prompt: "리포트",
          maxInputChars: 16_000,
          signal: controller.signal,
        }),
      )
      .catch((cause: unknown) => cause);
    await vi.waitFor(() => expect(anthropic.callCount).toBe(2));
    // When
    const startedAt = performance.now();
    const short = await chain.generator.generate(request({ prompt: "짧은 요청" }));
    const waitedMs = performance.now() - startedAt;
    controller.abort();
    await probe;
    // Then
    expect(short).toMatchObject({ provider: "google", fallbackFrom: null });
    expect(waitedMs).toBeLessThan(1000);
    expect(anthropic.callCount).toBe(2);
  });
});
