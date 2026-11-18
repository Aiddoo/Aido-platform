import { assessWeatherProviderBudget } from "./weather-provider-budget.domain-service.js";

describe("assessWeatherProviderBudget — 날씨 공급자 월 호출 예산", () => {
  const monthlyCallLimit = 500_000;

  it.each([
    { usedCalls: 0, expected: "normal" },
    { usedCalls: 449_999, expected: "normal" },
    { usedCalls: 450_000, expected: "saving" },
    { usedCalls: 499_999, expected: "saving" },
    { usedCalls: 500_000, expected: "exhausted" },
    { usedCalls: 500_001, expected: "exhausted" },
  ])("$usedCalls회를 쓰면 $expected다", ({ usedCalls, expected }) => {
    // When
    const state = assessWeatherProviderBudget({ usedCalls, monthlyCallLimit });

    // Then
    expect(state).toBe(expected);
  });
});
