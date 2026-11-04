import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";

import { resolveConsentedAiProviders } from "./ai-processor-consent.policy.js";
import { planAiRoute } from "./ai-route.policy.js";

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
