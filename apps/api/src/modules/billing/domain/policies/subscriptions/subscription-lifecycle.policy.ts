import { STORE_PERIOD_TYPE, STORE_PERIOD_TYPES, type StorePeriodType } from "@aido/api/vocabulary";
import { match, P } from "ts-pattern";

/** 무료 체험의 단계. 스토어에 체험 전용 이벤트가 없어 이벤트 종류와 기간 유형으로 판단한다. */
export const SUBSCRIPTION_LIFECYCLES = [
  "trial_started",
  "trial_cancelled",
  "trial_converted",
  "trial_expired",
] as const;

export type SubscriptionLifecycle = (typeof SUBSCRIPTION_LIFECYCLES)[number];

/** 체험 판단에 필요한 스토어 이벤트의 값 */
export interface StoreLifecycleEvent {
  readonly type: string;
  /** 이벤트가 알려 준 지금 기간의 유형. 없거나 모르는 값이면 null이다. */
  readonly periodType: StorePeriodType | null;
  readonly isTrialConversion: boolean;
}

type LifecycleEventKind = "INITIAL_PURCHASE" | "RENEWAL" | "CANCELLATION" | "EXPIRATION" | "OTHER";

function eventKindOf(type: string): LifecycleEventKind {
  return match(type)
    .returnType<LifecycleEventKind>()
    .with("INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION", (kind) => kind)
    .otherwise(() => "OTHER");
}

/** 웹훅의 period_type 문자열을 알려진 값으로 읽는다. 모르는 값은 null이다. */
export function toStorePeriodType(value: string | null | undefined): StorePeriodType | null {
  return STORE_PERIOD_TYPES.find((periodType) => periodType === value) ?? null;
}

export const SubscriptionLifecyclePolicy = {
  /**
   * 체험 시작 = INITIAL_PURCHASE + TRIAL, 체험 중 해지 = CANCELLATION + TRIAL,
   * 결제 전환 = RENEWAL + is_trial_conversion, 전환 없이 끝남 = EXPIRATION + TRIAL.
   */
  classify(event: StoreLifecycleEvent): SubscriptionLifecycle | null {
    return match({
      kind: eventKindOf(event.type),
      isTrial: event.periodType === STORE_PERIOD_TYPE.TRIAL,
      isTrialConversion: event.isTrialConversion,
    })
      .returnType<SubscriptionLifecycle | null>()
      .with({ kind: "INITIAL_PURCHASE", isTrial: true }, () => "trial_started")
      .with({ kind: "CANCELLATION", isTrial: true }, () => "trial_cancelled")
      .with({ kind: "EXPIRATION", isTrial: true }, () => "trial_expired")
      .with({ kind: "RENEWAL", isTrialConversion: true }, () => "trial_converted")
      .with(
        { kind: P.union("INITIAL_PURCHASE", "CANCELLATION", "EXPIRATION"), isTrial: false },
        () => null,
      )
      .with({ kind: "RENEWAL", isTrialConversion: false }, () => null)
      .with({ kind: "OTHER" }, () => null)
      .exhaustive();
  },

  /**
   * 이 이벤트 뒤 저장할 기간 유형. 새 기간을 여는 구매·갱신만 바꾸고(undefined면 저장값 유지)
   * 해지·만료 등은 지금 기간의 유형을 그대로 둔다. 체험 전환 갱신은 값이 없어도 NORMAL이다.
   */
  periodTypeAfter(event: StoreLifecycleEvent): StorePeriodType | undefined {
    return match(eventKindOf(event.type))
      .returnType<StorePeriodType | undefined>()
      .with("INITIAL_PURCHASE", "RENEWAL", () =>
        event.isTrialConversion
          ? (event.periodType ?? STORE_PERIOD_TYPE.NORMAL)
          : (event.periodType ?? undefined),
      )
      .with("CANCELLATION", "EXPIRATION", "OTHER", () => undefined)
      .exhaustive();
  },
};
