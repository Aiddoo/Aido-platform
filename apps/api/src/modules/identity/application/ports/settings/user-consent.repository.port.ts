import type { UserConsentRecord } from "../../../domain/records/settings/user-consent.record.js";

export type { UserConsentRecord };

/** 배치 조회용 동의 레코드 (사용자 식별자 포함). */
export type UserConsentRecordWithId = UserConsentRecord & { userId: string };

/** 회원가입 시 시딩할 초기 약관 동의 값 (auth 프로비저닝 경로). */
export interface ConsentSeedInput {
  termsAgreedAt?: Date;
  privacyAgreedAt?: Date;
  agreedTermsVersion?: string;
  marketingAgreedAt?: Date | null;
  marketingPushAgreedAt?: Date | null;
}

/**
 * 약관 동의 리포지토리 포트.
 */
export interface UserConsentRepositoryPort {
  findByUserId(userId: string): Promise<UserConsentRecord | null>;
  findByUserIds(userIds: readonly string[]): Promise<UserConsentRecordWithId[]>;
  create(userId: string, data: ConsentSeedInput): Promise<UserConsentRecord>;
  upsertMarketingConsent(
    userId: string,
    data: { agreedAt: Date | null },
  ): Promise<UserConsentRecord>;
  upsertMarketingPushConsent(
    userId: string,
    data: { agreedAt: Date | null },
  ): Promise<UserConsentRecord>;
  /** 동의하면 agreedAt에 시각, 거부·철회하면 null을 쓰고 답한 안내 version을 함께 남긴다. */
  upsertAiDataSharingConsent(
    userId: string,
    data: { agreedAt: Date | null; version: string },
  ): Promise<UserConsentRecord>;
}

export const USER_CONSENT_REPOSITORY = Symbol("USER_CONSENT_REPOSITORY");
