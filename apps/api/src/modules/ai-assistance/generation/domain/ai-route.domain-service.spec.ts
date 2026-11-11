import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";

import { resolveConsentedAiProviders } from "./ai-processor-consent.domain-service.js";
import { planAiRoute, resolveAttemptTime } from "./ai-route.domain-service.js";

const ALL = new Set<AiProviderId>(AI_PROVIDER_IDS);
const NONE = new Set<AiProviderId>();

describe("resolveConsentedAiProviders", () => {
  it.each([
    { version: "2026-10-26", expected: ["google"] },
    { version: "2026-11-04", expected: ["anthropic", "google", "openai"] },
    { version: null, expected: ["google"] },
  ] as const)("동의 버전 $version은 $expected만 허용한다", ({ version, expected }) => {
    // When
    const providers = resolveConsentedAiProviders(version);
    // Then
    expect([...providers]).toEqual(expected);
  });
});

describe("planAiRoute", () => {
  it.each([
    {
      name: "새 동의·모든 키·닫힌 회로면 설정 순서 그대로",
      order: ["anthropic", "google", "openai"],
      configured: ALL,
      agreedVersion: "2026-11-04",
      openCircuits: NONE,
      expected: ["anthropic", "google", "openai"],
    },
    {
      name: "출시 앱 동의면 Google만",
      order: ["anthropic", "google", "openai"],
      configured: ALL,
      agreedVersion: "2026-10-26",
      openCircuits: NONE,
      expected: ["google"],
    },
    {
      name: "동의 버전이 없으면(1.13 미만 앱) Google만",
      order: ["anthropic", "google", "openai"],
      configured: ALL,
      agreedVersion: null,
      openCircuits: NONE,
      expected: ["google"],
    },
    {
      name: "회로가 열린 업체는 건너뛴다",
      order: ["anthropic", "google", "openai"],
      configured: ALL,
      agreedVersion: "2026-11-04",
      openCircuits: new Set<AiProviderId>(["anthropic"]),
      expected: ["google", "openai"],
    },
    {
      name: "키가 없는 업체는 건너뛴다",
      order: ["anthropic", "google", "openai"],
      configured: new Set<AiProviderId>(["google", "openai"]),
      agreedVersion: "2026-11-04",
      openCircuits: NONE,
      expected: ["google", "openai"],
    },
    {
      name: "운영 순서를 바꾸면 그 순서를 따른다",
      order: ["openai", "anthropic"],
      configured: ALL,
      agreedVersion: "2026-11-04",
      openCircuits: NONE,
      expected: ["openai", "anthropic"],
    },
    {
      name: "출시 앱 동의에서 Google 회로가 열리면 보낼 업체가 없다",
      order: ["anthropic", "google", "openai"],
      configured: ALL,
      agreedVersion: "2026-10-26",
      openCircuits: new Set<AiProviderId>(["google"]),
      expected: [],
    },
  ] as const)("$name", ({ order, configured, agreedVersion, openCircuits, expected }) => {
    // When
    const route = planAiRoute({ order, configured, agreedVersion, openCircuits });
    // Then
    expect(route).toEqual(expected);
  });
});

describe("resolveAttemptTime", () => {
  const ORDERS: readonly (readonly AiProviderId[])[] = [
    ["anthropic", "google", "openai"],
    ["anthropic", "openai", "google"],
    ["google", "anthropic", "openai"],
    ["google", "openai", "anthropic"],
    ["openai", "anthropic", "google"],
    ["openai", "google", "anthropic"],
  ];
  /** 2026-11 live eval에서 잰 업체별 최댓값(parse-todo 36건, quick-plan 30건, digest 7건) */
  const MEASURED = [
    {
      task: "parse-todo",
      deadlineMs: 12_000,
      slowestMs: { anthropic: 2336, google: 1756, openai: 4751 },
    },
    {
      task: "quick-plan",
      deadlineMs: 24_000,
      slowestMs: { anthropic: 4909, google: 4929, openai: 5184 },
    },
    {
      task: "voice-note-digest",
      deadlineMs: 45_000,
      slowestMs: { anthropic: 5049, google: 6822, openai: 6226 },
    },
  ] as const;
  const SAFETY_MARGIN = 1.2;

  /** 업체가 모두 멈춰 시도마다 받은 시간을 다 쓰는 체인을 따라간다. */
  function stallThrough(route: readonly AiProviderId[], deadlineMs: number) {
    let remainingMs = deadlineMs;
    return route.map((provider, index) => {
      const time = resolveAttemptTime({
        route,
        provider,
        isLast: index === route.length - 1,
        deadlineMs,
        remainingMs,
      });
      remainingMs -= time.budgetMs;
      return { provider, ...time };
    });
  }

  it.each(MEASURED.flatMap((measured) => ORDERS.map((order) => ({ ...measured, order }))))(
    "$task($deadlineMs ms)는 $order 순서로 모두 멈춰도 세 업체가 실측 최댓값의 1.2배 이상을 받는다",
    ({ deadlineMs, slowestMs, order }) => {
      // When
      const attempts = stallThrough(order, deadlineMs);
      // Then
      for (const attempt of attempts) {
        expect(attempt.budgetMs).toBeGreaterThanOrEqual(
          slowestMs[attempt.provider] * SAFETY_MARGIN,
        );
        expect(attempt.hadFullShare).toBe(true);
      }
      expect(attempts.reduce((sum, attempt) => sum + attempt.budgetMs, 0)).toBeLessThanOrEqual(
        deadlineMs,
      );
    },
  );

  it("앞 업체가 빨리 실패하면 남은 시간을 뒤 업체 몫대로 다시 나눈다", () => {
    // When
    const time = resolveAttemptTime({
      route: ["anthropic", "google", "openai"],
      provider: "google",
      isLast: false,
      deadlineMs: 12_000,
      remainingMs: 11_900,
    });
    // Then
    expect(time).toEqual({ budgetMs: 3966, hadFullShare: true });
  });

  it("회로가 열려 경로가 둘이면 두 업체의 몫으로 나눈다", () => {
    // Given
    const route: readonly AiProviderId[] = ["openai", "anthropic"];
    // When
    const attempts = stallThrough(route, 12_000);
    // Then
    expect(attempts.map((attempt) => attempt.budgetMs)).toEqual([8000, 4000]);
  });

  it("뒤에 시도할 업체가 없으면 경로에 업체가 남아 있어도 남은 시간을 모두 쓴다", () => {
    // When
    const time = resolveAttemptTime({
      route: ["anthropic", "google", "openai"],
      provider: "anthropic",
      isLast: true,
      deadlineMs: 60_000,
      remainingMs: 40_000,
    });
    // Then
    expect(time.budgetMs).toBe(40_000);
  });

  it("앞 시도가 몫을 넘게 써 몫보다 적게 받은 업체는 시간 초과를 탓하지 않는다", () => {
    // When
    const time = resolveAttemptTime({
      route: ["anthropic", "google", "openai"],
      provider: "google",
      isLast: false,
      deadlineMs: 12_000,
      remainingMs: 6000,
    });
    // Then
    expect(time).toEqual({ budgetMs: 2000, hadFullShare: false });
  });
});
