import type { SubscriptionStatus, UserRole } from "@aido/api";
import type { PremiumSource } from "@aido/api/vocabulary";

import type { AccountProvider, UserStatus } from "../../../domain/types/auth/auth.types.js";

export const AUTH_CACHE = Symbol("AUTH_CACHE");
export const AUTH_EMAIL_SENDER = Symbol("AUTH_EMAIL_SENDER");
export const AUTH_REGISTRATION_NOTIFIER = Symbol("AUTH_REGISTRATION_NOTIFIER");
export const AUTH_RUNTIME_CONFIG = Symbol("AUTH_RUNTIME_CONFIG");
export const AUTH_USER_ACTIVITY_WRITER = Symbol("AUTH_USER_ACTIVITY_WRITER");

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
}

export interface AuthCachedSession {
  readonly userId: string;
  readonly expiresAt: Date | string;
  readonly revokedAt: Date | string | null;
  readonly userStatus?: string;
  readonly userDeletedAt?: string | null;
}

export interface AuthCachePort {
  getSession(sessionId: string): Promise<AuthCachedSession | undefined>;
  setSession(sessionId: string, session: AuthCachedSession): Promise<void>;
  invalidateSession(sessionId: string): Promise<void>;
  invalidateUserProfile(userId: string): Promise<void>;
  wrapUserProfile(
    userId: string,
    factory: () => Promise<AuthCachedUserProfile | undefined>,
  ): Promise<AuthCachedUserProfile | undefined>;
}

export interface AuthEmailResult {
  success: boolean;
  error?: string;
}

export interface AuthEmailSenderPort {
  sendVerificationCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailResult>;
  sendPasswordResetCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailResult>;
  sendPasswordSetupCode(
    to: string,
    data: { code: string; expiryMinutes: number },
  ): Promise<AuthEmailResult>;
}

export interface AuthUserRegisteredNotification {
  userId: string;
  email: string;
  provider: "credential" | "apple" | "google" | "kakao" | "naver";
  registeredAt: string;
}

export interface AuthRegistrationNotifierPort {
  notifyUserRegistered(payload: AuthUserRegisteredNotification): void;
}

export interface AuthRuntimeConfigPort {
  readonly isDevelopment: boolean;
}

export interface AuthUserActivityWriterPort {
  /**
   * 마지막 활동 시각과 활동일을 남긴다. appVersion(SemVer)이 있으면 요청한 앱 버전도 함께 남겨,
   * 요청 헤더가 없는 예약 작업이 사용자의 앱이 지원하는 동작을 고를 수 있게 한다.
   */
  updateLastActiveAt(userId: string, timezone: string, appVersion?: string): Promise<void>;
}
