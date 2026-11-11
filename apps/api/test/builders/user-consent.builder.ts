/**
 * UserConsent 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * const consent = UserConsentBuilder.create("user-123").build();
 * const withMarketing = UserConsentBuilder.create("user-123").withMarketingConsent().build();
 * ```
 */

import * as crypto from "node:crypto";

import type { UserConsent } from "#test/types/database-rows";

export class UserConsentBuilder {
  #data: UserConsent;

  constructor(userId: string) {
    const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
    this.#data = {
      id: `consent-${crypto.randomUUID().slice(0, 8)}`,
      userId,
      termsAgreedAt: now,
      privacyAgreedAt: now,
      agreedTermsVersion: "1.0.0",
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
      aiDataSharingAgreedAt: null,
      aiDataSharingVersion: null,
      marketingReconfirmedAt: null,
    };
  }

  static create(userId: string): UserConsentBuilder {
    return new UserConsentBuilder(userId);
  }

  withId(id: string): UserConsentBuilder {
    this.#data.id = id;
    return this;
  }

  withTermsAgreedAt(date: Temporal.Instant): UserConsentBuilder {
    this.#data.termsAgreedAt = date;
    return this;
  }

  withPrivacyAgreedAt(date: Temporal.Instant): UserConsentBuilder {
    this.#data.privacyAgreedAt = date;
    return this;
  }

  withAgreedTermsVersion(version: string): UserConsentBuilder {
    this.#data.agreedTermsVersion = version;
    return this;
  }

  /** 마케팅 동의 포함 */
  withMarketingConsent(): UserConsentBuilder {
    this.#data.marketingAgreedAt = Temporal.Instant.fromEpochMilliseconds(Date.now());
    return this;
  }

  build(): UserConsent {
    return { ...this.#data };
  }
}
