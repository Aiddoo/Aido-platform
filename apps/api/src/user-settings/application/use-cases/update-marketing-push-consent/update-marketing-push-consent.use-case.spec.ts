/**
 * UpdateMarketingPushConsentUseCase 단위 테스트
 *
 * 광고성 앱 푸시 동의 변경 upsert + marketingPushAgreedAt 뷰 매핑.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserConsentRepositoryMock } from "@test/mocks/ports/user-settings.mock";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import { UpdateMarketingPushConsentUseCase } from "./update-marketing-push-consent.use-case";

const userId = "user-1";

describe("UpdateMarketingPushConsentUseCase", () => {
	let useCase: UpdateMarketingPushConsentUseCase;
	let repo: Mocked<UserConsentRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpdateMarketingPushConsentUseCase,
		)
			.mock<UserConsentRepositoryPort>(USER_CONSENT_REPOSITORY)
			.impl(() => createUserConsentRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<UserConsentRepositoryPort>(USER_CONSENT_REPOSITORY);
	});

	it("동의 시 upsert 위임 후 marketingPushAgreedAt ISO 문자열을 반환한다", async () => {
		// Given: upsert가 동의 시각이 채워진 레코드를 반환
		repo.upsertMarketingPushConsent.mockResolvedValue({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: new Date("2024-03-01T09:00:00.000Z"),
		});

		// When: 동의(true)로 변경
		const result = await useCase.execute(userId, true);

		// Then: { agreed: true }로 upsert, ISO 문자열 뷰 반환
		expect(repo.upsertMarketingPushConsent).toHaveBeenCalledWith(userId, {
			agreed: true,
		});
		expect(result).toEqual({
			marketingPushAgreedAt: "2024-03-01T09:00:00.000Z",
		});
	});

	it("철회 시 marketingPushAgreedAt는 null을 반환한다", async () => {
		// Given: upsert가 동의 시각이 비워진 레코드를 반환
		repo.upsertMarketingPushConsent.mockResolvedValue({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		});

		// When: 철회(false)로 변경
		const result = await useCase.execute(userId, false);

		// Then: { agreed: false }로 upsert, null 뷰 반환
		expect(repo.upsertMarketingPushConsent).toHaveBeenCalledWith(userId, {
			agreed: false,
		});
		expect(result.marketingPushAgreedAt).toBeNull();
	});
});
