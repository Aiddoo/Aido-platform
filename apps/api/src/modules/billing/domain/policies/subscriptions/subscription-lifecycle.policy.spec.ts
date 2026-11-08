import { STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";

import {
  type StoreLifecycleEvent,
  SubscriptionLifecyclePolicy,
  toStorePeriodType,
} from "./subscription-lifecycle.policy.js";

function event(overrides: Partial<StoreLifecycleEvent> = {}): StoreLifecycleEvent {
  return { type: "INITIAL_PURCHASE", periodType: null, isTrialConversion: false, ...overrides };
}

const EVENT_TYPES = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "EXPIRATION",
  "UNCANCELLATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "NEW_UNKNOWN_EVENT",
] as const;

const PERIOD_TYPES: readonly (StorePeriodType | null)[] = [...STORE_PERIOD_TYPES, null];

/** 표의 기대값. 여기 없는 조합은 모두 null이다. */
function expectedLifecycle(type: string, periodType: StorePeriodType | null, conversion: boolean) {
  if (type === "INITIAL_PURCHASE" && periodType === "TRIAL") {
    return "trial_started";
  }
  if (type === "CANCELLATION" && periodType === "TRIAL") {
    return "trial_cancelled";
  }
  if (type === "EXPIRATION" && periodType === "TRIAL") {
    return "trial_expired";
  }
  if (type === "RENEWAL" && conversion) {
    return "trial_converted";
  }
  return null;
}

const TABLE = EVENT_TYPES.flatMap((type) =>
  PERIOD_TYPES.flatMap((periodType) =>
    [false, true].map((isTrialConversion) => ({
      type,
      periodType,
      isTrialConversion,
      expected: expectedLifecycle(type, periodType, isTrialConversion),
    })),
  ),
);

describe("SubscriptionLifecyclePolicy", () => {
  describe("classify", () => {
    it.each(TABLE)(
      "$type · period_type=$periodType · is_trial_conversion=$isTrialConversion → $expected",
      ({ type, periodType, isTrialConversion, expected }) => {
        // Given
        const input = event({ type, periodType, isTrialConversion });

        // When
        const lifecycle = SubscriptionLifecyclePolicy.classify(input);

        // Then
        expect(lifecycle).toBe(expected);
      },
    );

    it("표는 이벤트 9종 × 기간 유형 6종 × 전환 여부 2종을 모두 덮는다", () => {
      // Given
      const combinations = new Set(
        TABLE.map((row) => `${row.type}:${row.periodType}:${row.isTrialConversion}`),
      );

      // When
      const count = combinations.size;

      // Then
      expect(count).toBe(EVENT_TYPES.length * PERIOD_TYPES.length * 2);
    });
  });

  describe("periodTypeAfter", () => {
    it.each([
      { type: "INITIAL_PURCHASE", periodType: "TRIAL", conversion: false, expected: "TRIAL" },
      { type: "INITIAL_PURCHASE", periodType: "NORMAL", conversion: false, expected: "NORMAL" },
      { type: "INITIAL_PURCHASE", periodType: null, conversion: false, expected: undefined },
      { type: "RENEWAL", periodType: "NORMAL", conversion: true, expected: "NORMAL" },
      // 전환 갱신에 period_type이 빠져도 체험으로 남지 않는다
      { type: "RENEWAL", periodType: null, conversion: true, expected: "NORMAL" },
      { type: "RENEWAL", periodType: "INTRO", conversion: false, expected: "INTRO" },
      { type: "CANCELLATION", periodType: "TRIAL", conversion: false, expected: undefined },
      { type: "EXPIRATION", periodType: "TRIAL", conversion: false, expected: undefined },
      { type: "UNCANCELLATION", periodType: "TRIAL", conversion: false, expected: undefined },
    ] as const)(
      "$type · $periodType · 전환 $conversion이면 저장할 유형은 $expected다",
      ({ type, periodType, conversion, expected }) => {
        // Given
        const input = event({ type, periodType, isTrialConversion: conversion });

        // When
        const periodTypeAfter = SubscriptionLifecyclePolicy.periodTypeAfter(input);

        // Then
        expect(periodTypeAfter).toBe(expected);
      },
    );
  });

  describe("toStorePeriodType", () => {
    it.each([
      { value: "TRIAL", expected: "TRIAL" },
      { value: "PREPAID", expected: "PREPAID" },
      { value: "trial", expected: null },
      { value: "", expected: null },
      { value: undefined, expected: null },
    ])("$value → $expected", ({ value, expected }) => {
      // Given
      const raw = value;

      // When
      const periodType = toStorePeriodType(raw);

      // Then
      expect(periodType).toBe(expected);
    });
  });
});
