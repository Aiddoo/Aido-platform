import type {
  DeviceType,
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type {
  AdminNotificationChannel,
  AdminNotificationSeverity,
  NoticeEndReason,
  NoticeStore,
  SignupMethod,
  SubscriptionNoticeEvent,
} from "./admin-notices.constants.js";
import { AdminNotificationMessage } from "./admin-notification-message.vo.js";

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

export type AdminNotificationFieldValue =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "datetime"; readonly iso: string };

export interface AdminNotificationField {
  readonly label: string;
  readonly value: AdminNotificationFieldValue;
  readonly inline?: boolean;
}

/** 이미 조립한 일반 알림(일일 요약 등). 표시 형식은 채널 어댑터가 정한다. */
export interface AdminNotification {
  readonly title: string;
  readonly body: string;
  readonly severity: AdminNotificationSeverity;
  readonly fields?: readonly AdminNotificationField[];
  readonly link?: string;
}

/**
 * 관리자 채널로 보낼 알림의 값. `admin-notification.v1` 작업 payload의 `notice`와 같은 모양이라 큐에 쌓인
 * 옛 작업도 그대로 읽는다. 제목·이모지·색·필드 배치·날짜 표시는 채널 어댑터가 렌더링한다.
 */
export type AdminNoticePrimitives =
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

interface AdminNoticeProps {
  readonly content: AdminNoticePrimitives;
  readonly deduplicationKey: string | null;
}

interface CreateAdminNoticeParams {
  readonly content: AdminNoticePrimitives;
  /** 같은 알림을 한 번만 보내게 하는 발송 작업 key. 없으면 매번 보낸다 */
  readonly deduplicationKey?: string;
}

// 저장하지 않는다. 다른 Context의 일이나 일일 집계를 운영자 채널로 보내는 동안만 존재한다
export class AdminNotice extends AggregateRoot<null, AdminNoticeProps> {
  static create(params: CreateAdminNoticeParams): AdminNotice {
    if (params.content.type === "message") {
      AdminNotificationMessage.create(params.content.message);
    }
    return new AdminNotice(null, {
      content: params.content,
      deduplicationKey: params.deduplicationKey ?? null,
    });
  }

  /** 결제 알림은 결제 채널, 가입·운영 알림은 운영 채널로 간다 */
  get channel(): AdminNotificationChannel {
    return match(this.props.content.type)
      .returnType<AdminNotificationChannel>()
      .with("subscription_event", () => "payment")
      .with("user_registered", "message", () => "admin")
      .exhaustive();
  }

  get deduplicationKey(): string | null {
    return this.props.deduplicationKey;
  }

  toPrimitives(): AdminNoticePrimitives {
    return this.props.content;
  }
}
