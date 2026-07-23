/**
 * GetConsentRecordUseCase 단위 테스트
 *
 * 푸시 발송 판단용 단건 동의 원본 레코드 조회(뷰 매핑 없음).
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUserConsentRepositoryMock } from "@test/mocks/ports/user-settings.mock";

import {
	USER_CONSENT_REPOSITORY,
	type UserConsentRecord,
	type UserConsentRepositoryPort,
} from "../../ports/user-consent.repository.port";
import { GetConsentRecordUseCase } from "./get-consent-record.use-case";

const userId = "user-1";

const record: UserConsentRecord = {
	termsAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
	privacyAgreedAt: new Date("2024-01-01T00:00:00.000Z"),
	agreedTermsVersion: "1.0",
	marketingAgreedAt: null,
	marketingPushAgreedAt: new Date("2024-02-01T00:00:00.000Z"),
};

describe("GetConsentRecordUseCase", () => {
	let useCase: GetConsentRecordUseCase;
	let repo: Mocked<UserConsentRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetConsentRecordUseCase)
			.mock<UserConsentRepositoryPort>(USER_CONSENT_REPOSITORY)
			.impl(() => createUserConsentRepositoryMock())
			.compile();
		useCase = unit;
		repo = unitRef.get<UserConsentRepositoryPort>(USER_CONSENT_REPOSITORY);
	});

	it("원본 레코드를 그대로 반환한다(뷰 매핑 없음)", async () => {
		// Given: 리포지토리에 동의 레코드가 존재
		repo.findByUserId.mockResolvedValue(record);

		// When: 단건 조회
		const result = await useCase.execute(userId);

		// Then: Date 객체가 담긴 원본 레코드를 그대로 반환
		expect(repo.findByUserId).toHaveBeenCalledWith(userId);
		expect(result).toBe(record);
	});

	it("레코드가 없으면 null을 반환한다", async () => {
		// Given: 동의 레코드 미존재
		repo.findByUserId.mockResolvedValue(null);

		// When: 단건 조회
		const result = await useCase.execute(userId);

		// Then: null 그대로 전달
		expect(result).toBeNull();
	});
});
