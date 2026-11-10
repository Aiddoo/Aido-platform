import { type AiSpendLimits, decideAiSpend } from "./ai-spend.domain-service.js";

const limits: AiSpendLimits = {
  alert: { dailyMicroUsd: 1_000_000, monthlyMicroUsd: 10_000_000 },
  background: { dailyMicroUsd: 2_000_000, monthlyMicroUsd: 20_000_000 },
  halt: { dailyMicroUsd: 3_000_000, monthlyMicroUsd: 30_000_000 },
  userDailyMicroUsd: 250_000,
};
const NO_SPEND = {
  globalDailyMicroUsd: 0,
  globalMonthlyMicroUsd: 0,
  userDailyMicroUsd: 0,
};

describe("decideAiSpend", () => {
  it.each([
    {
      name: "쓴 비용이 없으면 허용",
      taskClass: "interactive",
      enabled: true,
      spend: NO_SPEND,
      expected: { type: "allowed" },
    },
    {
      name: "킬 스위치가 끄면 비용과 무관하게 중단",
      taskClass: "interactive",
      enabled: false,
      spend: NO_SPEND,
      expected: { type: "halted", reason: "kill-switch" },
    },
    {
      name: "경고 기준선은 막지 않는다",
      taskClass: "background",
      enabled: true,
      spend: { ...NO_SPEND, globalDailyMicroUsd: 1_999_999 },
      expected: { type: "allowed" },
    },
    {
      name: "배경 일 기준선에 닿으면 배경만 중단",
      taskClass: "background",
      enabled: true,
      spend: { ...NO_SPEND, globalDailyMicroUsd: 2_000_000 },
      expected: { type: "halted", reason: "daily-budget" },
    },
    {
      name: "배경 일 기준선에서 사용자 요청은 계속",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, globalDailyMicroUsd: 2_000_000 },
      expected: { type: "allowed" },
    },
    {
      name: "배경 월 기준선에 닿으면 배경만 중단",
      taskClass: "background",
      enabled: true,
      spend: { ...NO_SPEND, globalMonthlyMicroUsd: 20_000_000 },
      expected: { type: "halted", reason: "monthly-budget" },
    },
    {
      name: "전체 일 상한에 닿으면 사용자 요청도 중단",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, globalDailyMicroUsd: 3_000_000 },
      expected: { type: "halted", reason: "daily-budget" },
    },
    {
      name: "전체 월 상한에 닿으면 사용자 요청도 중단",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, globalMonthlyMicroUsd: 30_000_000 },
      expected: { type: "halted", reason: "monthly-budget" },
    },
    {
      name: "사용자 일 예산에 닿으면 그 사용자만 제한",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, userDailyMicroUsd: 250_000 },
      expected: { type: "user-limited" },
    },
    {
      name: "사용자 일 예산 바로 아래는 허용",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, userDailyMicroUsd: 249_999 },
      expected: { type: "allowed" },
    },
    {
      name: "시스템 호출은 사용자 예산을 보지 않는다",
      taskClass: "background",
      enabled: true,
      spend: { ...NO_SPEND, userDailyMicroUsd: null },
      expected: { type: "allowed" },
    },
    {
      name: "전역 중단이 사용자 제한보다 먼저다",
      taskClass: "interactive",
      enabled: true,
      spend: { ...NO_SPEND, globalDailyMicroUsd: 3_000_000, userDailyMicroUsd: 250_000 },
      expected: { type: "halted", reason: "daily-budget" },
    },
  ] as const)("$name", ({ taskClass, enabled, spend, expected }) => {
    // When
    const decision = decideAiSpend({ taskClass, isEnabled: enabled, spend, limits });
    // Then
    expect(decision).toEqual(expected);
  });
});
