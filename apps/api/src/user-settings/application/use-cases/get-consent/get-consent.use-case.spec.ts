/**
 * GetConsentUseCase 단위 테스트
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import { GetConsentUseCase } from "./get-consent.use-case";

describe("GetConsentUseCase", () => {
	let useCase: GetConsentUseCase;
	let repo: Mocked<UserConsentRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(GetConsentUseCase).compile();
		useCase = unit;
		repo = unitRef.get(USER_CONSENT_REPOSITORY);
	});

	it("동의 기록이 없으면 전부 null", async () => {
		repo.findByUserId.mockResolvedValue(null);

		const result = await useCase.execute("user-1");

		expect(result).toEqual({
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
		});
	});

	it("동의 기록이 있으면 ISO 문자열로 매핑", async () => {
		repo.findByUserId.mockResolvedValue({
			termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
			privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
			agreedTermsVersion: "1.0",
			marketingAgreedAt: null,
		});

		const result = await useCase.execute("user-1");

		expect(result.termsAgreedAt).toBe("2024-01-01T00:00:00.000Z");
		expect(result.agreedTermsVersion).toBe("1.0");
		expect(result.marketingAgreedAt).toBeNull();
	});
});
