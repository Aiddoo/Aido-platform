import { STORE_PERIOD_TYPE, STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";
import { match, P } from "ts-pattern";

import type { StoreSubscriptionEventKind } from "./subscriptions.constants.js";

/** 무료 체험의 단계. 스토어에 체험 전용 이벤트가 없어 이벤트 종류와 기간 유형으로 판단한다. */
const SUBSCRIPTION_LIFECYCLES = [
  "trial_started",
  "trial_cancelled",
  "trial_converted",
  "trial_expired",
] as const;

export type SubscriptionLifecycle = (typeof SUBSCRIPTION_LIFECYCLES)[number];

/** 체험 판단에 필요한 스토어 이벤트의 값 */
export interface StoreLifecycleEvent {
  readonly kind: StoreSubscriptionEventKind;
  /** 기간 없는 일회성 구매인지(STARTED만) */
  readonly isOneTime: boolean;
  /** 이벤트가 알려 준 지금 기간의 유형. 없거나 모르는 값이면 null이다. */
  readonly periodType: StorePeriodType | null;
  readonly isTrialConversion: boolean;
}

const LIFECYCLE_EVENT_KINDS = [
  "PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "EXPIRATION",
  "OTHER",
] as const;

type LifecycleEventKind = (typeof LIFECYCLE_EVENT_KINDS)[number];

// 환불도 해지의 한 가지라 체험 단계는 해지와 같다(알림은 환불을 먼저 고른다)
function eventKindOf(event: StoreLifecycleEvent): LifecycleEventKind {
  return match(event.kind)
    .returnType<LifecycleEventKind>()
    .with("STARTED", () => (event.isOneTime ? "OTHER" : "PURCHASE"))
    .with("RENEWED", () => "RENEWAL")
    .with("CANCELLED", "REFUNDED", () => "CANCELLATION")
    .with("EXPIRED", () => "EXPIRATION")
    .with(
      "UNCANCELLED",
      "BILLING_ISSUE",
      "PRODUCT_CHANGE_SCHEDULED",
      "EXTENDED",
      "TRANSFERRED",
      "IGNORED",
      () => "OTHER",
    )
    .exhaustive();
}

/** 저장·공급자의 기간 유형 문자열을 알려진 값으로 읽는다. 모르는 값은 null이다. */
export function toStorePeriodType(value: string | null | undefined): StorePeriodType | null {
  return STORE_PERIOD_TYPES.find((periodType) => periodType === value) ?? null;
}

/**
 * 체험 시작 = 시작 + TRIAL, 체험 중 해지 = 해지·환불 + TRIAL,
 * 결제 전환 = 체험 전환 갱신, 전환 없이 끝남 = 만료 + TRIAL.
 */
export function classifySubscriptionLifecycle(
  event: StoreLifecycleEvent,
): SubscriptionLifecycle | null {
  return match({
    kind: eventKindOf(event),
    isTrial: event.periodType === STORE_PERIOD_TYPE.TRIAL,
    isTrialConversion: event.isTrialConversion,
  })
    .returnType<SubscriptionLifecycle | null>()
    .with({ kind: "PURCHASE", isTrial: true }, () => "trial_started")
    .with({ kind: "CANCELLATION", isTrial: true }, () => "trial_cancelled")
    .with({ kind: "EXPIRATION", isTrial: true }, () => "trial_expired")
    .with({ kind: "RENEWAL", isTrialConversion: true }, () => "trial_converted")
    .with({ kind: P.union("PURCHASE", "CANCELLATION", "EXPIRATION"), isTrial: false }, () => null)
    .with({ kind: "RENEWAL", isTrialConversion: false }, () => null)
    .with({ kind: "OTHER" }, () => null)
    .exhaustive();
}

/**
 * 이 이벤트 뒤 저장할 기간 유형. 새 기간을 여는 구매·갱신만 바꾸고(undefined면 저장값 유지)
 * 해지·만료 등은 지금 기간의 유형을 그대로 둔다. 체험 전환 갱신은 값이 없어도 NORMAL이다.
 */
export function periodTypeAfterEvent(event: StoreLifecycleEvent): StorePeriodType | undefined {
  return match(eventKindOf(event))
    .returnType<StorePeriodType | undefined>()
    .with("PURCHASE", "RENEWAL", () =>
      event.isTrialConversion
        ? (event.periodType ?? STORE_PERIOD_TYPE.NORMAL)
        : (event.periodType ?? undefined),
    )
    .with("CANCELLATION", "EXPIRATION", "OTHER", () => undefined)
    .exhaustive();
}
