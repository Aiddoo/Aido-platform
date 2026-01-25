import { Test } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { UserConsent } from "@/generated/prisma/client";

import { UserConsentRepository } from "./user-consent.repository";

describe("UserConsentRepository", () => {
	let repository: UserConsentRepository;
	let mockDatabase: ReturnType<typeof createMockTxClient>;

	const userId = "user-123";
	const now = new Date("2024-01-15T10:00:00Z");

	const mockConsent: UserConsent = {
		id: "consent-1",
		userId,
		termsAgreedAt: new Date("2024-01-01T00:00:00Z"),
		privacyAgreedAt: new Date("2024-01-01T00:00:00Z"),
		agreedTermsVersion: "1.0.0",
		marketingAgreedAt: new Date("2024-01-01T00:00:00Z"),
	};

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(now);

		mockDatabase = createMockTxClient();

		const module = await Test.createTestingModule({
			providers: [
				UserConsentRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get(UserConsentRepository);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	describe("findByUserId", () => {
		it("사용자 ID로 약관 동의 상태를 조회한다", async () => {
			mockDatabase.userConsent.findUnique.mockResolvedValue(mockConsent);

			const result = await repository.findByUserId(userId);

			expect(result).toEqual(mockConsent);
			expect(mockDatabase.userConsent.findUnique).toHaveBeenCalledWith({
				where: { userId },
			});
		});

		it("동의 레코드가 없으면 null을 반환한다", async () => {
			mockDatabase.userConsent.findUnique.mockResolvedValue(null);

			const result = await repository.findByUserId(userId);

			expect(result).toBeNull();
		});

		it("트랜잭션 내에서 조회한다", async () => {
			const txClient = createMockTxClient();
			txClient.userConsent.findUnique.mockResolvedValue(mockConsent);

			const result = await repository.findByUserId(
				userId,
				asTxClient(txClient),
			);

			expect(result).toEqual(mockConsent);
			expect(txClient.userConsent.findUnique).toHaveBeenCalledWith({
				where: { userId },
			});
			expect(mockDatabase.userConsent.findUnique).not.toHaveBeenCalled();
		});
	});

	describe("create", () => {
		it("기본값(null)으로 동의 레코드를 생성한다", async () => {
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
			mockDatabase.userConsent.create.mockResolvedValue(createdConsent);

			const result = await repository.create(userId);

			expect(result).toEqual(createdConsent);
			expect(mockDatabase.userConsent.create).toHaveBeenCalledWith({
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
			const termsDate = new Date("2024-01-01T00:00:00Z");
			const privacyDate = new Date("2024-01-01T00:00:00Z");
			const marketingDate = new Date("2024-01-01T00:00:00Z");

			mockDatabase.userConsent.create.mockResolvedValue(mockConsent);

			const result = await repository.create(userId, {
				termsAgreedAt: termsDate,
				privacyAgreedAt: privacyDate,
				agreedTermsVersion: "1.0.0",
				marketingAgreedAt: marketingDate,
			});

			expect(result).toEqual(mockConsent);
			expect(mockDatabase.userConsent.create).toHaveBeenCalledWith({
				data: {
					userId,
					termsAgreedAt: termsDate,
					privacyAgreedAt: privacyDate,
					agreedTermsVersion: "1.0.0",
					marketingAgreedAt: marketingDate,
				},
			});
		});

		it("트랜잭션 내에서 생성한다", async () => {
			const txClient = createMockTxClient();
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: null,
			};
			txClient.userConsent.create.mockResolvedValue(createdConsent);

			const result = await repository.create(
				userId,
				undefined,
				asTxClient(txClient),
			);

			expect(result).toEqual(createdConsent);
			expect(txClient.userConsent.create).toHaveBeenCalled();
			expect(mockDatabase.userConsent.create).not.toHaveBeenCalled();
		});
	});

	describe("upsert", () => {
		it("동의 레코드가 없으면 생성한다", async () => {
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
			mockDatabase.userConsent.upsert.mockResolvedValue(createdConsent);

			const result = await repository.upsert(userId, {
				termsAgreedAt: termsDate,
				privacyAgreedAt: privacyDate,
				agreedTermsVersion: "1.0.0",
			});

			expect(result).toEqual(createdConsent);
			expect(mockDatabase.userConsent.upsert).toHaveBeenCalledWith({
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
			const newVersion = "2.0.0";
			const updatedConsent: UserConsent = {
				...mockConsent,
				agreedTermsVersion: newVersion,
			};
			mockDatabase.userConsent.upsert.mockResolvedValue(updatedConsent);

			const result = await repository.upsert(userId, {
				agreedTermsVersion: newVersion,
			});

			expect(result).toEqual(updatedConsent);
			expect(mockDatabase.userConsent.upsert).toHaveBeenCalledWith({
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

		it("트랜잭션 내에서 upsert한다", async () => {
			const txClient = createMockTxClient();
			txClient.userConsent.upsert.mockResolvedValue(mockConsent);

			const result = await repository.upsert(
				userId,
				{ agreedTermsVersion: "1.0.0" },
				asTxClient(txClient),
			);

			expect(result).toEqual(mockConsent);
			expect(txClient.userConsent.upsert).toHaveBeenCalled();
			expect(mockDatabase.userConsent.upsert).not.toHaveBeenCalled();
		});
	});

	describe("updateMarketingConsent", () => {
		it("마케팅 동의를 활성화한다 (현재 시간으로 설정)", async () => {
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: now,
			};
			mockDatabase.userConsent.update.mockResolvedValue(updatedConsent);

			const result = await repository.updateMarketingConsent(userId, {
				agreed: true,
			});

			expect(result).toEqual(updatedConsent);
			expect(mockDatabase.userConsent.update).toHaveBeenCalledWith({
				where: { userId },
				data: {
					marketingAgreedAt: now,
				},
			});
		});

		it("마케팅 동의를 철회한다 (null로 설정)", async () => {
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: null,
			};
			mockDatabase.userConsent.update.mockResolvedValue(updatedConsent);

			const result = await repository.updateMarketingConsent(userId, {
				agreed: false,
			});

			expect(result).toEqual(updatedConsent);
			expect(mockDatabase.userConsent.update).toHaveBeenCalledWith({
				where: { userId },
				data: {
					marketingAgreedAt: null,
				},
			});
		});

		it("트랜잭션 내에서 업데이트한다", async () => {
			const txClient = createMockTxClient();
			txClient.userConsent.update.mockResolvedValue(mockConsent);

			const result = await repository.updateMarketingConsent(
				userId,
				{ agreed: true },
				asTxClient(txClient),
			);

			expect(result).toEqual(mockConsent);
			expect(txClient.userConsent.update).toHaveBeenCalled();
			expect(mockDatabase.userConsent.update).not.toHaveBeenCalled();
		});
	});

	describe("upsertMarketingConsent", () => {
		it("동의 레코드가 없으면 마케팅 동의와 함께 생성한다", async () => {
			const createdConsent: UserConsent = {
				id: "consent-new",
				userId,
				termsAgreedAt: null,
				privacyAgreedAt: null,
				agreedTermsVersion: null,
				marketingAgreedAt: now,
			};
			mockDatabase.userConsent.upsert.mockResolvedValue(createdConsent);

			const result = await repository.upsertMarketingConsent(userId, {
				agreed: true,
			});

			expect(result).toEqual(createdConsent);
			expect(mockDatabase.userConsent.upsert).toHaveBeenCalledWith({
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
			const updatedConsent: UserConsent = {
				...mockConsent,
				marketingAgreedAt: null,
			};
			mockDatabase.userConsent.upsert.mockResolvedValue(updatedConsent);

			const result = await repository.upsertMarketingConsent(userId, {
				agreed: false,
			});

			expect(result).toEqual(updatedConsent);
			expect(mockDatabase.userConsent.upsert).toHaveBeenCalledWith({
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

		it("트랜잭션 내에서 upsert한다", async () => {
			const txClient = createMockTxClient();
			txClient.userConsent.upsert.mockResolvedValue(mockConsent);

			const result = await repository.upsertMarketingConsent(
				userId,
				{ agreed: true },
				asTxClient(txClient),
			);

			expect(result).toEqual(mockConsent);
			expect(txClient.userConsent.upsert).toHaveBeenCalled();
			expect(mockDatabase.userConsent.upsert).not.toHaveBeenCalled();
		});
	});
});
