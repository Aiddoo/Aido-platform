import { Inject, Injectable } from "@nestjs/common";

import {
	type ConsentSeedInput,
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/**
 * 회원가입 시 기본 설정 시딩 — 약관 동의 + 푸시 설정 기본값.
 * 호출측(auth 프로비저닝)이 연 CLS 트랜잭션에 참여한다.
 */
@Injectable()
export class SeedUserSettingsUseCase {
	constructor(
		@Inject(USER_CONSENT_REPOSITORY)
		private readonly consentRepository: UserConsentRepositoryPort,
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
	) {}

	async execute(userId: string, consent: ConsentSeedInput): Promise<void> {
		await this.consentRepository.create(userId, consent);
		await this.preferenceRepository.create(userId, {
			pushEnabled: true,
			nightPushEnabled: true,
		});
	}
}
