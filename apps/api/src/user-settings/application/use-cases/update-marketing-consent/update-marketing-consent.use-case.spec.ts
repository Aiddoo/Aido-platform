/**
 * UpdateMarketingConsentUseCase 단위 테스트
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import { UpdateMarketingConsentUseCase } from "./update-marketing-consent.use-case";

describe("UpdateMarketingConsentUseCase", () => {
	let useCase: UpdateMarketingConsentUseCase;
	let repo: Mocked<UserConsentRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpdateMarketingConsentUseCase,
		).compile();
		useCase = unit;
		repo = unitRef.get(USER_CONSENT_REPOSITORY);
	});

	it("동의 시 marketingAgreedAt 반환", async () => {
		repo.upsertMarketingConsent.mockResolvedValue({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: new Date("2024-01-15T10:00:00.000Z"),
			marketingPushAgreedAt: null,
		});

		const result = await useCase.execute("user-1", true);

		expect(repo.upsertMarketingConsent).toHaveBeenCalledWith("user-1", {
			agreed: true,
		});
		expect(result.marketingAgreedAt).toBe("2024-01-15T10:00:00.000Z");
	});

	it("철회 시 null 반환", async () => {
		repo.upsertMarketingConsent.mockResolvedValue({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		});

		const result = await useCase.execute("user-1", false);

		expect(result.marketingAgreedAt).toBeNull();
	});
});
