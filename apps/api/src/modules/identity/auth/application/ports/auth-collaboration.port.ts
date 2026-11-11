import type { DeviceType, SubscriptionStatus, UserRole } from "@aido/api/vocabulary";
import type { PremiumSource, SubscriptionPlanType } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider, UserStatus } from "../../domain/auth.constants.js";
import type { SessionId } from "../../domain/session-id.vo.js";

export interface AuthCachedUserProfile {
  id: string;
  email: string;
  userTag: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  name: string | null;
  profileImage: string | null;
  createdAt: string;
  providers: AccountProvider[];
  /** 1.13.0 이전 캐시에는 없다. 없으면 응답에서도 생략한다. */
  premiumSource?: PremiumSource | null;
  premiumEndsAt?: string | null;
  premiumPeriodEndsAt?: string | null;
  willRenew?: boolean;
  bankedPremiumDays?: number;
  premiumGrantEndedAt?: string | null;
  /** 1.15.0 이전 캐시에는 없다. 없으면 응답에서도 생략한다. */
  premiumIsTrial?: boolean;
  premiumPlanType?: SubscriptionPlanType | null;
}

export interface AuthCachedSession {
  readonly userId: string;
  readonly expiresAt: Date | string;
  readonly revokedAt: Date | string | null;
  readonly userStatus?: string;
  readonly userDeletedAt?: string | null;
}

export abstract class AuthCachePort {
  abstract getSession(sessionId: SessionId): Promise<AuthCachedSession | undefined>;
  abstract setSession(sessionId: SessionId, session: AuthCachedSession): Promise<void>;
  abstract invalidateSession(sessionId: SessionId): Promise<void>;
  abstract invalidateUserProfile(userId: UserId): Promise<void>;
  abstract wrapUserProfile(
    userId: UserId,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined>;
}

/** 인증 메일 발송 요청의 결과. queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기다. */
export type AuthEmailDispatch =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: string };

export abstract class AuthEmailSenderPort {
  abstract sendVerificationCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailDispatch>;
  abstract sendPasswordResetCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailDispatch>;
  abstract sendPasswordSetupCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailDispatch>;
}

export interface AuthUserRegisteredNotification {
  userId: string;
  email: string;
  provider: Lowercase<AccountProvider>;
  registeredAt: string;
  name?: string;
  devicePlatform?: DeviceType;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  appBuild?: string;
  locale?: string;
  timezone?: string;
}

export abstract class AuthRegistrationNotifierPort {
  abstract notifyUserRegistered(payload: AuthUserRegisteredNotification): void;
}

export abstract class AuthRuntimeConfigPort {
  /** 개발 빌드의 OAuth 복귀 주소(aido-dev://·localhost·exp://)를 받는다. 스테이징·운영은 false다 */
  abstract readonly allowsDevRedirects: boolean;
}

export abstract class AuthUserActivityWriterPort {
  /**
   * 마지막 활동 시각과 활동일을 남긴다. appVersion(SemVer)이 있으면 요청한 앱 버전도 함께 남겨,
   * 요청 헤더가 없는 예약 작업이 사용자의 앱이 지원하는 동작을 고를 수 있게 한다.
   */
  abstract updateLastActiveAt(activity: {
    readonly userId: UserId;
    readonly timezone: string;
    readonly seenAt: Temporal.Instant;
    readonly appVersion?: string;
  }): Promise<void>;
}
