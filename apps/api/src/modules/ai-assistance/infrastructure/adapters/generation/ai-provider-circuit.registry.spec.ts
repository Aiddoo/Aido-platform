import { Logger } from "@nestjs/common";
import { z } from "zod";

import { ok, status, StubProviderAdapter } from "#test/mocks/ai-provider-adapter.stub";
import { createAiTestConfig, RecordingAiProviderAlert } from "#test/mocks/ai-provider-http.stub";

import { AiProviderCircuitRegistry } from "./ai-provider-circuit.registry.js";
import { AiSdkGenerator } from "./ai-sdk.generator.js";

const START = new Date("2026-11-04T00:00:00.000Z");
const MINUTE = 60_000;

function createChain(anthropic: StubProviderAdapter) {
  const config = createAiTestConfig();
  const alert = new RecordingAiProviderAlert();
  const circuits = new AiProviderCircuitRegistry(config, alert);
  const google = new StubProviderAdapter("google", [ok()], "gemini-3.1-flash-lite");
  const generator = new AiSdkGenerator(config, [anthropic, google], circuits);
  const generate = () =>
    generator.generate({
      task: "quick-plan",
      promptVersion: "quick-plan@test",
      system: "",
      prompt: "x",
      schema: z.object({ title: z.string() }),
      agreedConsentVersion: "2026-11-04",
    });
  return { generate, alert, circuits, anthropic, google };
}

describe("AiProviderCircuitRegistry — 결제·장애 회로 (가짜 시계)", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Claude 402 한 번이면 결제 회로를 열고 알림을 한 번 보낸 뒤 차단 시간 동안 Claude를 건너뛴다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
    );
    // When
    const first = await chain.generate();
    vi.setSystemTime(START.getTime() + 14 * MINUTE);
    const second = await chain.generate();
    // Then
    expect([first.provider, second.provider]).toEqual(["google", "google"]);
    expect(second.fallbackFrom).toBeNull();
    expect(chain.anthropic.callCount).toBe(1);
    expect(chain.alert.events).toEqual([
      {
        provider: "anthropic",
        task: "quick-plan",
        reason: "QUOTA_EXHAUSTED",
        cooldownMs: 15 * MINUTE,
      },
    ]);
    expect(error).toHaveBeenCalledWith({
      event: "ai.provider.circuit.opened",
      provider: "anthropic",
      breaker: "billing",
      reason: "QUOTA_EXHAUSTED",
      cooldownMs: 15 * MINUTE,
    });
  });

  it("차단 시간이 지나면 시험 호출로 Claude를 다시 부르고 성공하면 회로를 닫는다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter("anthropic", [status(402), ok()], "claude-haiku-5-5"),
    );
    await chain.generate();
    // When
    vi.setSystemTime(START.getTime() + 15 * MINUTE);
    const recovered = await chain.generate();
    const next = await chain.generate();
    // Then
    expect([recovered.provider, next.provider]).toEqual(["anthropic", "anthropic"]);
    expect(chain.circuits.openProviders().size).toBe(0);
    expect(chain.alert.events).toHaveLength(1);
    expect(log).toHaveBeenCalledWith({
      event: "ai.provider.circuit.half-open",
      provider: "anthropic",
      breaker: "billing",
    });
    expect(log).toHaveBeenCalledWith({
      event: "ai.provider.circuit.closed",
      provider: "anthropic",
      breaker: "billing",
    });
  });

  it("시험 호출도 크레딧 소진이면 다시 열고 다음 차단 시간 동안 건너뛴다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter("anthropic", [status(402)], "claude-haiku-5-5"),
    );
    await chain.generate();
    vi.setSystemTime(START.getTime() + 15 * MINUTE);
    // When
    await chain.generate();
    // Then
    expect(chain.anthropic.callCount).toBe(2);
    expect(chain.circuits.openProviders()).toEqual(new Set(["anthropic"]));
  });

  it("일시 장애는 연속 다섯 번째에 장애 회로를 30초 열고 네 번까지는 계속 시도한다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter("anthropic", [status(503)], "claude-haiku-5-5"),
    );
    // When
    for (let index = 0; index < 4; index += 1) {
      await chain.generate();
    }
    const beforeThreshold = chain.circuits.openProviders();
    await chain.generate();
    const afterThreshold = chain.circuits.openProviders();
    vi.setSystemTime(START.getTime() + 30_000);
    const afterCooldown = chain.circuits.openProviders();
    // Then
    expect(beforeThreshold.size).toBe(0);
    expect(afterThreshold).toEqual(new Set(["anthropic"]));
    expect(afterCooldown.size).toBe(0);
    expect(chain.alert.events).toEqual([]);
  });

  it("장애 사이에 한 번이라도 성공하면 연속 횟수를 다시 센다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter(
        "anthropic",
        [status(503), status(503), status(503), status(503), ok(), status(503)],
        "claude-haiku-5-5",
      ),
    );
    // When
    for (let index = 0; index < 6; index += 1) {
      await chain.generate();
    }
    // Then
    expect(chain.circuits.openProviders().size).toBe(0);
  });

  it("요청 한도·출력 오류는 회로를 열지 않는다", async () => {
    // Given
    const chain = createChain(
      new StubProviderAdapter("anthropic", [status(429)], "claude-haiku-5-5"),
    );
    // When
    for (let index = 0; index < 6; index += 1) {
      await chain.generate();
    }
    // Then
    expect(chain.circuits.openProviders().size).toBe(0);
    expect(chain.anthropic.callCount).toBe(6);
  });
});
