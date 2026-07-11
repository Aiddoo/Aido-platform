/**
 * UserConsentRepository 리포지토리 단위 테스트
 *
 * @description
 * UserConsentRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test user-consent.repository
 * ```
 */
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { UserConsentBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { UserConsent } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { UserConsentRepository } from "./user-consent.repository";

describe("UserConsentRepository — 사용자 동의 리포지토리", () => {
	let repository: UserConsentRepository;
	let db: MockPrismaClient;

	const userId = "user-123";
	const now = new Date("2024-01-15T10:00:00Z");

	const mockConsent = UserConsentBuilder.create(userId)
		.withId("consent-1")
		.withTermsAgreedAt(new Date("2024-01-01T00:00:00Z"))
		.withPrivacyAgreedAt(new Date("2024-01-01T00:00:00Z"))
		.withAgreedTermsVersion("1.0.0")
		.withMarketingConsent()
		.build();
	// Override marketingAgreedAt to match the specific date
	mockConsent.marketingAgreedAt = new Date("2024-01-01T00:00:00Z");

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(now);

		// Given - Suites가 모든 의존성을 자동으로 mock
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(UserConsentRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("findByUserId", () => {
		it("사용자 ID로 약관 동의 상태를 조회한다", async () => {
			// Given
			db.userConsent.findUnique.mockResolvedValue(mockConsent);

			// When
			const result = await repository.findByUserId(userId);

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.findUnique).toHaveBeenCalledWith({
				where: { userId },
			});
		});

		it("동의 레코드가 없으면 null을 반환한다", async () => {
			// Given
			db.userConsent.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByUserId(userId);

			// Then
			expect(result).toBeNull();
		});

		it("활성 트랜잭션 클라이언트로 조회한다", async () => {
			// Given
			db.userConsent.findUnique.mockResolvedValue(mockConsent);

			// When
			const result = await repository.findByUserId(userId);

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.findUnique).toHaveBeenCalledWith({
				where: { userId },
			});
		});
	});

	describe("create", () => {
		it("기본값(null)으로 동의 레코드를 생성한다", async () => {
			// Given
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
			db.userConsent.create.mockResolvedValue(createdConsent);

			// When
			const result = await repository.create(userId);

			// Then
			expect(result).toEqual(createdConsent);
			expect(db.userConsent.create).toHaveBeenCalledWith({
				data: {
					userId,
					termsAgreedAt: null,
					privacyAgreedAt: null,
					agreedTermsVersion: null,
					marketingAgreedAt: null,
				},
			});
		});

		it("지정된 값으로 동의 레코드를 생성한다", async () => {
			// Given
			const termsDate = new Date("2024-01-01T00:00:00Z");
			const privacyDate = new Date("2024-01-01T00:00:00Z");
			const marketingDate = new Date("2024-01-01T00:00:00Z");

			db.userConsent.create.mockResolvedValue(mockConsent);

			// When
			const result = await repository.create(userId, {
				termsAgreedAt: termsDate,
				privacyAgreedAt: privacyDate,
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: marketingDate,
			});

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.create).toHaveBeenCalledWith({
				data: {
					userId,
					termsAgreedAt: termsDate,
					privacyAgreedAt: privacyDate,
					agreedTermsVersion: "1.0.0",
					marketingAgreedAt: marketingDate,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 생성한다", async () => {
			// Given
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
			db.userConsent.create.mockResolvedValue(createdConsent);

			// When
			const result = await repository.create(userId, undefined);

			// Then
			expect(result).toEqual(createdConsent);
			expect(db.userConsent.create).toHaveBeenCalled();
		});
	});

	describe("upsert", () => {
		it("동의 레코드가 없으면 생성한다", async () => {
			// Given
			const termsDate = new Date("2024-01-01T00:00:00Z");
			const privacyDate = new Date("2024-01-01T00:00:00Z");

			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: termsDate,
				privacyAgreedAt: privacyDate,
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: null,
			};
			db.userConsent.upsert.mockResolvedValue(createdConsent);

			// When
			const result = await repository.upsert(userId, {
				termsAgreedAt: termsDate,
				privacyAgreedAt: privacyDate,
				agreedTermsVersion: "1.0.0",
			});

			// Then
			expect(result).toEqual(createdConsent);
			expect(db.userConsent.upsert).toHaveBeenCalledWith({
				where: { userId },
				create: {
					userId,
					termsAgreedAt: termsDate,
					privacyAgreedAt: privacyDate,
					agreedTermsVersion: "1.0.0",
					marketingAgreedAt: null,
				},
				update: {
					termsAgreedAt: termsDate,
					privacyAgreedAt: privacyDate,
					agreedTermsVersion: "1.0.0",
				},
			});
		});

		it("동의 레코드가 있으면 업데이트한다", async () => {
			// Given
			const newVersion = "2.0.0";
			const updatedConsent: UserConsent = {
				...mockConsent,
				agreedTermsVersion: newVersion,
			};
			db.userConsent.upsert.mockResolvedValue(updatedConsent);

			// When
			const result = await repository.upsert(userId, {
				agreedTermsVersion: newVersion,
			});

			// Then
			expect(result).toEqual(updatedConsent);
			expect(db.userConsent.upsert).toHaveBeenCalledWith({
				where: { userId },
				create: {
					userId,
					termsAgreedAt: null,
					privacyAgreedAt: null,
					agreedTermsVersion: newVersion,
					marketingAgreedAt: null,
				},
				update: {
					agreedTermsVersion: newVersion,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 upsert한다", async () => {
			// Given
			db.userConsent.upsert.mockResolvedValue(mockConsent);

			// When
			const result = await repository.upsert(userId, {
				agreedTermsVersion: "1.0.0",
			});

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.upsert).toHaveBeenCalled();
		});
	});

	describe("updateMarketingConsent", () => {
		it("마케팅 동의를 활성화한다 (현재 시간으로 설정)", async () => {
			// Given
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: now,
			};
			db.userConsent.update.mockResolvedValue(updatedConsent);

			// When
			const result = await repository.updateMarketingConsent(userId, {
				agreed: true,
			});

			// Then
			expect(result).toEqual(updatedConsent);
			expect(db.userConsent.update).toHaveBeenCalledWith({
				where: { userId },
				data: {
					marketingAgreedAt: now,
				},
			});
		});

		it("마케팅 동의를 철회한다 (null로 설정)", async () => {
			// Given
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: null,
			};
			db.userConsent.update.mockResolvedValue(updatedConsent);

			// When
			const result = await repository.updateMarketingConsent(userId, {
				agreed: false,
			});

			// Then
			expect(result).toEqual(updatedConsent);
			expect(db.userConsent.update).toHaveBeenCalledWith({
				where: { userId },
				data: {
					marketingAgreedAt: null,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 업데이트한다", async () => {
			// Given
			db.userConsent.update.mockResolvedValue(mockConsent);

			// When
			const result = await repository.updateMarketingConsent(userId, {
				agreed: true,
			});

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.update).toHaveBeenCalled();
		});
	});

	describe("upsertMarketingConsent", () => {
		it("동의 레코드가 없으면 마케팅 동의와 함께 생성한다", async () => {
			// Given
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: now,
			};
			db.userConsent.upsert.mockResolvedValue(createdConsent);

			// When
			const result = await repository.upsertMarketingConsent(userId, {
				agreed: true,
			});

			// Then
			expect(result).toEqual(createdConsent);
			expect(db.userConsent.upsert).toHaveBeenCalledWith({
				where: { userId },
				create: {
					userId,
					marketingAgreedAt: now,
				},
				update: {
					marketingAgreedAt: now,
				},
			});
		});

		it("마케팅 동의 거부 시 null로 설정한다", async () => {
			// Given
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: null,
			};
			db.userConsent.upsert.mockResolvedValue(updatedConsent);

			// When
			const result = await repository.upsertMarketingConsent(userId, {
				agreed: false,
			});

			// Then
			expect(result).toEqual(updatedConsent);
			expect(db.userConsent.upsert).toHaveBeenCalledWith({
				where: { userId },
				create: {
					userId,
					marketingAgreedAt: null,
				},
				update: {
					marketingAgreedAt: null,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 upsert한다", async () => {
			// Given
			db.userConsent.upsert.mockResolvedValue(mockConsent);

			// When
			const result = await repository.upsertMarketingConsent(userId, {
				agreed: true,
			});

			// Then
			expect(result).toEqual(mockConsent);
			expect(db.userConsent.upsert).toHaveBeenCalled();
		});
	});
});
