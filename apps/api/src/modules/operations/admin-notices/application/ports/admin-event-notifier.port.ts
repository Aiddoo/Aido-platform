import type {
  DeviceType,
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";

import type {
  NoticeEndReason,
  NoticeStore,
  SignupEventProvider,
  SubscriptionAlertKind,
  SubscriptionAlertLifecycle,
} from "../../domain/admin-notices.constants.js";

/** 가입 알림 입력. 가입을 커밋한 identity가 요청에서 확인한 값을 넘긴다. */
export interface UserRegisteredAlertInput {
  readonly userId: string;
  readonly email: string;
  readonly provider: SignupEventProvider;
  /** 가입 시각(ISO string) */
  readonly registeredAt: string;
  readonly name?: string;
  readonly devicePlatform?: DeviceType;
  readonly deviceModel?: string;
  /** X-OS-Version */
  readonly osVersion?: string;
  /** X-App-Version */
  readonly appVersion?: string;
  /** X-App-Build */
  readonly appBuild?: string;
  /** Accept-Language 첫 항목 */
  readonly locale?: string;
  /** X-Timezone(IANA) */
  readonly timezone?: string;
}

/** 결제 채널 구독 알림 입력. 부가 필드는 없으면 알림에서 "—"로 표시하거나 생략한다. */
export interface SubscriptionNoticeInput {
  readonly userId: string;
  readonly email: string;
  readonly name?: string;
  readonly kind: SubscriptionAlertKind;
  /** 기간 없는 일회성 구매(STARTED만) */
  readonly isOneTime?: boolean;
  readonly productId: string;
  readonly planType?: SubscriptionPlanType;
  readonly store: NoticeStore | null;
  readonly environment?: SubscriptionEnvironment;
  readonly storeSubscriptionId?: string;
  readonly purchasedAt?: string;
  readonly expiresAt?: string;
  readonly gracePeriodEndsAt?: string;
  readonly endReason?: NoticeEndReason;
  readonly priceUsd?: number;
  readonly priceInPurchasedCurrency?: number;
  readonly purchasedCurrency?: string;
  readonly newProductId?: string;
  readonly newPlanType?: SubscriptionPlanType;
  readonly transfer?: { readonly from: readonly string[]; readonly to: readonly string[] };
  /** 공급자 고객 화면 주소 */
  readonly providerCustomerUrl?: string;
  /** 공급자 이벤트 ID. 알림 작업 멱등 key로 쓴다 */
  readonly eventId?: string;
  readonly countryCode?: string;
  readonly periodKind?: StorePeriodType;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  /** 무료 체험 단계(시작·해지·전환·종료). 체험과 관계없는 이벤트는 비운다 */
  readonly lifecycle?: SubscriptionAlertLifecycle;
  readonly isFirstPurchase?: boolean;
  /** 이 이벤트를 반영한 뒤의 프리미엄 상태 */
  readonly premium?: {
    readonly source: PremiumSource | null;
    readonly periodEndsAt: string | null;
    readonly bankedDays: number;
    readonly isTrial: boolean;
  };
}

/**
 * 다른 Context가 운영 흐름과 격리해 관리자 알림을 요청하는 문. 요청은 기다리지 않고(fire-and-forget)
 * 실패해도 호출한 업무를 되돌리지 않는다.
 */
export abstract class AdminEventNotifierPort {
  abstract notifyUserRegistered(input: UserRegisteredAlertInput): void;
  abstract notifySubscriptionEvent(input: SubscriptionNoticeInput): void;
}
