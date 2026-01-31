import type {
	ConsentResponse,
	PreferenceResponse,
	UpdateMarketingConsentResponse,
	UpdatePreferenceInput,
	UpdatePreferenceResponse,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";

import { toISOStringOrNull } from "@/common/date";

import { UserConsentRepository } from "../repositories/user-consent.repository";
import { UserPreferenceRepository } from "../repositories/user-preference.repository";

@Injectable()
export class UserSettingsService {
	private readonly logger = new Logger(UserSettingsService.name);

	constructor(
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly userConsentRepository: UserConsentRepository,
	) {}

	async getPreference(userId: string): Promise<PreferenceResponse> {
		const preference = await this.userPreferenceRepository.findByUserId(userId);

		// 설정이 없으면 기본값 반환 (기존 사용자 호환성)
		if (!preference) {
			return {
				pushEnabled: false,
				nightPushEnabled: false,
			};
		}

		return {
			pushEnabled: preference.pushEnabled,
			nightPushEnabled: preference.nightPushEnabled,
		};
	}

	async updatePreference(
		userId: string,
		input: UpdatePreferenceInput,
	): Promise<UpdatePreferenceResponse> {
		// upsert로 없으면 생성, 있으면 업데이트
		const updated = await this.userPreferenceRepository.upsert(userId, {
			pushEnabled: input.pushEnabled,
			nightPushEnabled: input.nightPushEnabled,
		});

		this.logger.log(
			`User ${userId} updated preference: pushEnabled=${updated.pushEnabled}, nightPushEnabled=${updated.nightPushEnabled}`,
		);

		return {
			pushEnabled: updated.pushEnabled,
			nightPushEnabled: updated.nightPushEnabled,
		};
	}

	async getConsent(userId: string): Promise<ConsentResponse> {
		const consent = await this.userConsentRepository.findByUserId(userId);

		// 동의 기록이 없으면 기본값 반환 (기존 사용자 호환성)
		if (!consent) {
			return {
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
		}

		return {
			termsAgreedAt: toISOStringOrNull(consent.termsAgreedAt),
			privacyAgreedAt: toISOStringOrNull(consent.privacyAgreedAt),
			agreedTermsVersion: consent.agreedTermsVersion,
			marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
		};
	}

	async updateMarketingConsent(
		userId: string,
		agreed: boolean,
	): Promise<UpdateMarketingConsentResponse> {
		// upsert로 없으면 생성, 있으면 업데이트
		const updated = await this.userConsentRepository.upsertMarketingConsent(
			userId,
			{ agreed },
		);

		this.logger.log(
			`User ${userId} updated marketing consent: agreed=${agreed}`,
		);

		return {
			marketingAgreedAt: toISOStringOrNull(updated.marketingAgreedAt),
		};
	}
}
