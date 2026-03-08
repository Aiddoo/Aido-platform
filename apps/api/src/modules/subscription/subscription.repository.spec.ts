import { TestBed } from "@suites/unit";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";

import type {
	CreateSubscriptionData,
	UpdateSubscriptionStatusData,
	UpdateUserSubscriptionStatusData,
} from "./subscription.repository";
import { SubscriptionRepository } from "./subscription.repository";

describe("SubscriptionRepository", () => {
	let repository: SubscriptionRepository;

	const mockDb = createMockDatabaseService({
		subscription: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		},
		user: {
			update: jest.fn(),
			findFirst: jest.fn(),
		},
	});

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(SubscriptionRepository)
			.mock(DatabaseService)
			.impl(() => mockDb)
			.compile();

		repository = unit;
	});

	// =========================================================================
	// findByRevenueCatId
	// =========================================================================

	describe("findByRevenueCatId", () => {
		it("존재하는 구독을 반환해야 한다", async () => {
			// Given
			const subscription = {
				id: "sub-1",
				revenueCatId: "otxn-123",
				status: "ACTIVE",
			};
			mockDb.subscription.findUnique.mockResolvedValue(subscription);

			// When
			const result = await repository.findByRevenueCatId("otxn-123");

			// Then
			expect(mockDb.subscription.findUnique).toHaveBeenCalledWith({
				where: { revenueCatId: "otxn-123" },
			});
			expect(result).toEqual(subscription);
		});

		it("tx 전달 시 tx의 subscription을 사용해야 한다", async () => {
			// Given
			const txMock = createMockTxClient();
			txMock.subscription.findUnique.mockResolvedValue(null);

			// When
			await repository.findByRevenueCatId("otxn-123", asTxClient(txMock));

			// Then
			expect(txMock.subscription.findUnique).toHaveBeenCalledWith({
				where: { revenueCatId: "otxn-123" },
			});
			expect(mockDb.subscription.findUnique).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// findActiveByUserId
	// =========================================================================

	describe("findActiveByUserId", () => {
		it("ACTIVE 구독을 반환해야 한다", async () => {
			// Given
			const subscription = {
				id: "sub-1",
				userId: "user-1",
				status: "ACTIVE",
			};
			mockDb.subscription.findFirst.mockResolvedValue(subscription);

			// When
			const result = await repository.findActiveByUserId("user-1");

			// Then
			expect(mockDb.subscription.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-1",
					status: "ACTIVE",
					deletedAt: null,
				},
				orderBy: { expiresAt: "desc" },
			});
			expect(result).toEqual(subscription);
		});
	});

	// =========================================================================
	// create
	// =========================================================================

	describe("create", () => {
		it("구독 생성 데이터를 올바르게 전달해야 한다", async () => {
			// Given
			const data: CreateSubscriptionData = {
				userId: "user-1",
				revenueCatId: "otxn-123",
				productId: "premium_monthly",
				status: "ACTIVE",
				startedAt: new Date("2024-01-01"),
				expiresAt: new Date("2024-02-01"),
			};
			const created = { id: "sub-1", ...data };
			mockDb.subscription.create.mockResolvedValue(created);

			// When
			const result = await repository.create(data);

			// Then
			expect(mockDb.subscription.create).toHaveBeenCalledWith({
				data: {
					user: { connect: { id: "user-1" } },
					revenueCatId: "otxn-123",
					productId: "premium_monthly",
					status: "ACTIVE",
					startedAt: data.startedAt,
					expiresAt: data.expiresAt,
				},
			});
			expect(result).toEqual(created);
		});
	});

	// =========================================================================
	// updateStatus
	// =========================================================================

	describe("updateStatus", () => {
		it("구독 상태를 정상 업데이트해야 한다", async () => {
			// Given
			const data: UpdateSubscriptionStatusData = {
				status: "CANCELLED",
				cancelledAt: new Date("2024-01-15"),
			};
			const updated = {
				id: "sub-1",
				revenueCatId: "otxn-123",
				status: "CANCELLED",
			};
			mockDb.subscription.update.mockResolvedValue(updated);

			// When
			const result = await repository.updateStatus("otxn-123", data);

			// Then
			expect(mockDb.subscription.update).toHaveBeenCalledWith({
				where: { revenueCatId: "otxn-123" },
				data,
			});
			expect(result).toEqual(updated);
		});

		it("P2025 에러 → webhookProcessingFailed BusinessException", async () => {
			// Given
			const p2025Error = new Prisma.PrismaClientKnownRequestError("Not found", {
				code: "P2025",
				clientVersion: "5.0.0",
			});
			mockDb.subscription.update.mockRejectedValue(p2025Error);

			// When & Then
			await expect(
				repository.updateStatus("otxn-not-found", { status: "CANCELLED" }),
			).rejects.toThrow(BusinessException);
		});

		it("P2025 이외의 에러 → 그대로 throw", async () => {
			// Given
			const genericError = new Error("Database connection failed");
			mockDb.subscription.update.mockRejectedValue(genericError);

			// When & Then
			await expect(
				repository.updateStatus("otxn-123", { status: "CANCELLED" }),
			).rejects.toThrow("Database connection failed");
		});
	});

	// =========================================================================
	// updateUserSubscriptionStatus
	// =========================================================================

	describe("updateUserSubscriptionStatus", () => {
		it("사용자 구독 상태를 정상 업데이트해야 한다", async () => {
			// Given
			const data: UpdateUserSubscriptionStatusData = {
				subscriptionStatus: "ACTIVE",
				subscriptionExpiresAt: new Date("2024-02-01"),
				revenueCatUserId: "rc-user-123",
			};
			mockDb.user.update.mockResolvedValue({ id: "user-1" });

			// When
			await repository.updateUserSubscriptionStatus("user-1", data);

			// Then
			expect(mockDb.user.update).toHaveBeenCalledWith({
				where: { id: "user-1" },
				data: {
					subscriptionStatus: "ACTIVE",
					subscriptionExpiresAt: data.subscriptionExpiresAt,
					revenueCatUserId: "rc-user-123",
				},
			});
		});
	});

	// =========================================================================
	// findUserByAppUserId
	// =========================================================================

	describe("findUserByAppUserId", () => {
		it("OR 조건으로 사용자를 검색해야 한다", async () => {
			// Given
			const user = {
				id: "user-1",
				email: "test@example.com",
				subscriptionStatus: "FREE",
				subscriptionExpiresAt: null,
				revenueCatUserId: null,
			};
			mockDb.user.findFirst.mockResolvedValue(user);

			// When
			const result = await repository.findUserByAppUserId("user-1");

			// Then
			expect(mockDb.user.findFirst).toHaveBeenCalledWith({
				where: {
					OR: [{ revenueCatUserId: "user-1" }, { id: "user-1" }],
				},
				select: {
					id: true,
					email: true,
					subscriptionStatus: true,
					subscriptionExpiresAt: true,
					revenueCatUserId: true,
				},
			});
			expect(result).toEqual(user);
		});

		it("tx 전달 시 tx의 user를 사용해야 한다", async () => {
			// Given
			const txMock = createMockTxClient();
			txMock.user.findFirst.mockResolvedValue(null);

			// When
			await repository.findUserByAppUserId("user-1", asTxClient(txMock));

			// Then
			expect(txMock.user.findFirst).toHaveBeenCalledWith({
				where: {
					OR: [{ revenueCatUserId: "user-1" }, { id: "user-1" }],
				},
				select: expect.objectContaining({
					id: true,
					email: true,
				}),
			});
			expect(mockDb.user.findFirst).not.toHaveBeenCalled();
		});
	});
});
