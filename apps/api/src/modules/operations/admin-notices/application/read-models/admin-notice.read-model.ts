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
  SignupMethod,
  SubscriptionNoticeEvent,
} from "../../domain/admin-notices.constants.js";
import type { AdminNotification } from "./admin-notification.read-model.js";

/**
 * 가입·결제 알림이 함께 쓰는 사용자 블록. 같은 조회로 채워 두 알림의 사용자 칸이 같은 값·같은 순서다.
 * 조회하지 못한 값은 비운다.
 */
export interface AdminNoticeUser {
  readonly userId: string;
  readonly email: string;
  readonly nickname?: string;
  readonly userTag?: string;
  /** 가입 시각(ISO string) */
  readonly joinedAt?: string;
  readonly signupMethod?: SignupMethod;
}

export interface SubscriptionNoticePrice {
  /** 사용자가 낸 통화의 금액 */
  readonly amount?: number;
  readonly currency?: string;
  /** 공급자가 USD로 환산한 금액 */
  readonly usd?: number;
}

export interface SubscriptionNoticePremium {
  readonly source: PremiumSource | null;
  /** 지금 출처 기간의 끝(ISO string) */
  readonly periodEndsAt?: string;
  /** 지금 기간 뒤에 이어질 쌓아 둔 보상 일수 */
  readonly bankedDays: number;
  readonly isTrial: boolean;
}

/** 결제 블록. 공급자 웹훅이 준 값을 그대로 옮기고 표시 형식은 채널 어댑터가 정한다. */
export interface SubscriptionNotice {
  readonly event: SubscriptionNoticeEvent;
  readonly environment?: SubscriptionEnvironment;
  readonly store?: NoticeStore;
  readonly productId?: string;
  readonly planType?: SubscriptionPlanType;
  readonly newProductId?: string;
  readonly newPlanType?: SubscriptionPlanType;
  readonly periodKind?: StorePeriodType;
  readonly price: SubscriptionNoticePrice;
  readonly purchasedAt?: string;
  /** 지금 기간의 끝. 자동 갱신 중이면 다음 갱신, 해지했으면 이용 종료다. */
  readonly expiresAt?: string;
  readonly gracePeriodEndsAt?: string;
  readonly endReason?: NoticeEndReason;
  readonly countryCode?: string;
  readonly isFirstPurchase?: boolean;
  readonly premium?: SubscriptionNoticePremium;
  readonly transfer?: { readonly from: readonly string[]; readonly to: readonly string[] };
  readonly storeSubscriptionId?: string;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  /** 공급자 고객 화면 주소 */
  readonly customerUrl?: string;
}

/** 가입 요청에서 확인한 기기·앱 정보 */
export interface SignupNotice {
  readonly devicePlatform?: DeviceType;
  readonly deviceModel?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly appBuild?: string;
  readonly locale?: string;
  readonly timezone?: string;
}

/**
 * 관리자 채널로 보낼 알림. 채널에 상관없는 사실만 담고 제목·이모지·색·필드 배치·날짜 표시는 채널 어댑터가
 * 렌더링한다. `message`는 이미 조립한 일반 알림(일일 요약·이전 형식 잡)이다.
 */
export type AdminNotice =
  | { readonly type: "message"; readonly message: AdminNotification }
  | {
      readonly type: "user_registered";
      readonly user: AdminNoticeUser;
      readonly signup: SignupNotice;
    }
  | {
      readonly type: "subscription_event";
      readonly user: AdminNoticeUser;
      readonly subscription: SubscriptionNotice;
    };
