import { STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";

import {
  type StoreLifecycleEvent,
  classifySubscriptionLifecycle,
  periodTypeAfterEvent,
} from "./subscription-lifecycle.domain-service.js";
import type { StoreSubscriptionEventKind } from "./subscriptions.constants.js";

function event(overrides: Partial<StoreLifecycleEvent> = {}): StoreLifecycleEvent {
  return {
    kind: "STARTED",
    isOneTime: false,
    periodType: null,
    isTrialConversion: false,
    ...overrides,
  };
}

/** 일회성 구매는 STARTED + isOneTime이다 */
const EVENT_TYPES = [
  "STARTED",
  "ONE_TIME",
  "RENEWED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
  "UNCANCELLED",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE_SCHEDULED",
  "EXTENDED",
  "IGNORED",
] as const;

function kindOf(
  type: (typeof EVENT_TYPES)[number],
): Pick<StoreLifecycleEvent, "kind" | "isOneTime"> {
  return type === "ONE_TIME"
    ? { kind: "STARTED", isOneTime: true }
    : { kind: type satisfies StoreSubscriptionEventKind, isOneTime: false };
}

const PERIOD_TYPES: readonly (StorePeriodType | null)[] = [...STORE_PERIOD_TYPES, null];

/** 표의 기대값. 여기 없는 조합은 모두 null이다. */
function expectedLifecycle(type: string, periodType: StorePeriodType | null, conversion: boolean) {
  if (type === "STARTED" && periodType === "TRIAL") {
    return "trial_started";
  }
  if ((type === "CANCELLED" || type === "REFUNDED") && periodType === "TRIAL") {
    return "trial_cancelled";
  }
  if (type === "EXPIRED" && periodType === "TRIAL") {
    return "trial_expired";
  }
  if (type === "RENEWED" && conversion) {
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

describe("SubscriptionLifecycleDomainService", () => {
  describe("classify", () => {
    it.each(TABLE)(
      "$type · 기간 유형=$periodType · 체험 전환=$isTrialConversion → $expected",
      ({ type, periodType, isTrialConversion, expected }) => {
        // Given
        const input = event({ ...kindOf(type), periodType, isTrialConversion });

        // When
        const lifecycle = classifySubscriptionLifecycle(input);

        // Then
        expect(lifecycle).toBe(expected);
      },
    );

    it("표는 이벤트 11종 × 기간 유형 6종 × 전환 여부 2종을 모두 덮는다", () => {
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
      { type: "STARTED", periodType: "TRIAL", conversion: false, expected: "TRIAL" },
      { type: "STARTED", periodType: "NORMAL", conversion: false, expected: "NORMAL" },
      { type: "STARTED", periodType: null, conversion: false, expected: undefined },
      { type: "ONE_TIME", periodType: "NORMAL", conversion: false, expected: undefined },
      { type: "RENEWED", periodType: "NORMAL", conversion: true, expected: "NORMAL" },
      // 전환 갱신에 기간 유형이 빠져도 체험으로 남지 않는다
      { type: "RENEWED", periodType: null, conversion: true, expected: "NORMAL" },
      { type: "RENEWED", periodType: "INTRO", conversion: false, expected: "INTRO" },
      { type: "CANCELLED", periodType: "TRIAL", conversion: false, expected: undefined },
      { type: "EXPIRED", periodType: "TRIAL", conversion: false, expected: undefined },
      { type: "UNCANCELLED", periodType: "TRIAL", conversion: false, expected: undefined },
    ] as const)(
      "$type · $periodType · 전환 $conversion이면 저장할 유형은 $expected다",
      ({ type, periodType, conversion, expected }) => {
        // Given
        const input = event({ ...kindOf(type), periodType, isTrialConversion: conversion });

        // When
        const periodTypeAfter = periodTypeAfterEvent(input);

        // Then
        expect(periodTypeAfter).toBe(expected);
      },
    );
  });
});
