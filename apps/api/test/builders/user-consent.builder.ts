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

import type { UserConsent } from "@/generated/prisma/client";

export class UserConsentBuilder {
	private data: UserConsent;

	private constructor(userId: string) {
		const now = new Date();
		this.data = {
			id: `consent-${crypto.randomUUID().slice(0, 8)}`,
			userId,
			termsAgreedAt: now,
			privacyAgreedAt: now,
			agreedTermsVersion: "1.0.0",
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		};
	}

	static create(userId: string): UserConsentBuilder {
		return new UserConsentBuilder(userId);
	}

	withId(id: string): UserConsentBuilder {
		this.data.id = id;
		return this;
	}

	withTermsAgreedAt(date: Date): UserConsentBuilder {
		this.data.termsAgreedAt = date;
		return this;
	}

	withPrivacyAgreedAt(date: Date): UserConsentBuilder {
		this.data.privacyAgreedAt = date;
		return this;
	}

	withAgreedTermsVersion(version: string): UserConsentBuilder {
		this.data.agreedTermsVersion = version;
		return this;
	}

	/** 마케팅 동의 포함 */
	withMarketingConsent(): UserConsentBuilder {
		this.data.marketingAgreedAt = new Date();
		return this;
	}

	build(): UserConsent {
		return { ...this.data };
	}
}
