/**
 * SeedUserSettingsUseCase 단위 테스트
 *
 * 회원가입 시 기본 설정 시딩 — 약관 동의 + 푸시 설정 기본 행 생성.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createUserConsentRepositoryMock,
	createUserPreferenceRepositoryMock,
} from "@test/mocks/ports/user-settings.mock";

import {
	type ConsentSeedInput,
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import { SeedUserSettingsUseCase } from "./seed-user-settings.use-case";

const userId = "user-1";

const consent: ConsentSeedInput = {
	termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
	privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
	agreedTermsVersion: "1.0",
	marketingAgreedAt: null,
	marketingPushAgreedAt: null,
};

describe("SeedUserSettingsUseCase", () => {
	let useCase: SeedUserSettingsUseCase;
	let consentRepo: Mocked<UserConsentRepositoryPort>;
	let preferenceRepo: Mocked<UserPreferenceRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SeedUserSettingsUseCase)
			.mock<UserConsentRepositoryPort>(USER_CONSENT_REPOSITORY)
			.impl(() => createUserConsentRepositoryMock())
			.mock<UserPreferenceRepositoryPort>(USER_PREFERENCE_REPOSITORY)
			.impl(() => createUserPreferenceRepositoryMock())
			.compile();
		useCase = unit;
		consentRepo = unitRef.get<UserConsentRepositoryPort>(
			USER_CONSENT_REPOSITORY,
		);
		preferenceRepo = unitRef.get<UserPreferenceRepositoryPort>(
			USER_PREFERENCE_REPOSITORY,
		);
	});

	it("동의 레코드와 푸시 설정 기본 행을 함께 생성한다", async () => {
		// Given: 두 리포지토리 create 성공
		consentRepo.create.mockResolvedValue({
			termsAgreedAt: consent.termsAgreedAt ?? null,
			privacyAgreedAt: consent.privacyAgreedAt ?? null,
			agreedTermsVersion: consent.agreedTermsVersion ?? null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		});

		// When: 시딩 실행
		await useCase.execute(userId, consent);

		// Then: 동의는 전달된 입력으로, 설정은 푸시 기본값(true/true)으로 생성
		expect(consentRepo.create).toHaveBeenCalledWith(userId, consent);
		expect(preferenceRepo.create).toHaveBeenCalledWith(userId, {
			pushEnabled: true,
			nightPushEnabled: true,
		});
	});

	it("설정 기본값은 항상 고정 푸시 플래그를 사용한다(입력 무관)", async () => {
		// Given: create 성공
		consentRepo.create.mockResolvedValue({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		});

		// When: 빈 동의 입력으로 시딩
		await useCase.execute(userId, {});

		// Then: 설정 행은 동의 입력과 무관하게 항상 pushEnabled/nightPushEnabled true
		expect(preferenceRepo.create).toHaveBeenCalledWith(userId, {
			pushEnabled: true,
			nightPushEnabled: true,
		});
	});
});
