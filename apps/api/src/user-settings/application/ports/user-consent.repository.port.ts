import type { UserConsentRecord } from "../../domain/records/user-consent.record";

export type { UserConsentRecord };

/**
 * 약관 동의 리포지토리 포트.
 */
export interface UserConsentRepositoryPort {
	findByUserId(userId: string): Promise<UserConsentRecord | null>;
	upsertMarketingConsent(
		userId: string,
		data: { agreed: boolean },
	): Promise<UserConsentRecord>;
}

export const USER_CONSENT_REPOSITORY = Symbol("USER_CONSENT_REPOSITORY");
