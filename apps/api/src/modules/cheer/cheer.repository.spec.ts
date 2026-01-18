import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "@/database/database.service";

import { CheerRepository } from "./cheer.repository";
import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	CheerWithRelations,
	FindCheersParams,
} from "./types";

// =============================================================================
// Mock Factory Functions
// =============================================================================

function createMockCheer(
	overrides: {
		id?: number;
		senderId?: string;
		receiverId?: string;
		message?: string | null;
		createdAt?: Date;
		readAt?: Date | null;
	} = {},
) {
	return {
		id: overrides.id ?? 1,
		senderId: overrides.senderId ?? "sender-1",
		receiverId: overrides.receiverId ?? "receiver-1",
		message: overrides.message ?? "축하해요!",
		createdAt: overrides.createdAt ?? new Date("2024-01-15T10:00:00Z"),
		readAt: overrides.readAt ?? null,
	};
}

function createMockProfile(
	overrides: { name?: string | null; profileImage?: string | null } = {},
) {
	return {
		name: overrides.name ?? "테스트유저",
		profileImage: overrides.profileImage ?? null,
	};
}

function createMockUser(
	overrides: {
		id?: string;
		userTag?: string;
		profile?: { name: string | null; profileImage: string | null } | null;
		subscriptionStatus?: "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED";
	} = {},
) {
	return {
		id: overrides.id ?? "user-1",
		userTag: overrides.userTag ?? "user1",
		profile:
			overrides.profile !== undefined ? overrides.profile : createMockProfile(),
		subscriptionStatus: overrides.subscriptionStatus ?? "FREE",
	};
}

function createMockCheerWithRelations(
	overrides: {
		id?: number;
		senderId?: string;
		receiverId?: string;
		message?: string | null;
		createdAt?: Date;
		readAt?: Date | null;
		sender?: ReturnType<typeof createMockUser>;
		receiver?: ReturnType<typeof createMockUser>;
	} = {},
): CheerWithRelations {
	const cheer = createMockCheer(overrides);
	return {
		...cheer,
		sender:
			overrides.sender ??
			createMockUser({ id: cheer.senderId, userTag: "sender" }),
		receiver:
			overrides.receiver ??
			createMockUser({ id: cheer.receiverId, userTag: "receiver" }),
	};
}

// =============================================================================
// Test Suite
// =============================================================================

describe("CheerRepository", () => {
	let repository: CheerRepository;
	let mockDatabase: {
		cheer: {
			create: jest.Mock;
			findUnique: jest.Mock;
			findFirst: jest.Mock;
			findMany: jest.Mock;
			update: jest.Mock;
			updateMany: jest.Mock;
			count: jest.Mock;
		};
		user: {
			findUnique: jest.Mock;
		};
	};

	beforeEach(async () => {
		mockDatabase = {
			cheer: {
				create: jest.fn(),
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
				count: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CheerRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<CheerRepository>(CheerRepository);
	});

	// ===========================================================================
	// 기본 CRUD 테스트
	// ===========================================================================

	describe("create", () => {
		it("Cheer를 생성하고 반환한다", async () => {
			// Given
			const createData = {
				sender: { connect: { id: "sender-1" } },
				receiver: { connect: { id: "receiver-1" } },
				message: "축하해요!",
			};
			const expectedCheer = createMockCheer();
			mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(mockDatabase.cheer.create).toHaveBeenCalledWith({
				data: createData,
			});
		});

		it("트랜잭션 클라이언트가 주어지면 해당 클라이언트를 사용한다", async () => {
			// Given
			const createData = {
				sender: { connect: { id: "sender-1" } },
				receiver: { connect: { id: "receiver-1" } },
			};
			const expectedCheer = createMockCheer();
			const mockTx = {
				cheer: {
					create: jest.fn().mockResolvedValue(expectedCheer),
				},
			};

			// When
			const result = await repository.create(createData, mockTx as never);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(mockTx.cheer.create).toHaveBeenCalled();
			expect(mockDatabase.cheer.create).not.toHaveBeenCalled();
		});
	});

	describe("createWithRelations", () => {
		it("Cheer를 생성하고 관계 정보와 함께 반환한다", async () => {
			// Given
			const createData = {
				sender: { connect: { id: "sender-1" } },
				receiver: { connect: { id: "receiver-1" } },
				message: "잘했어요!",
			};
			const expectedCheer = createMockCheerWithRelations({
				message: "잘했어요!",
			});
			mockDatabase.cheer.create.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.createWithRelations(createData);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(result.sender).toBeDefined();
			expect(result.receiver).toBeDefined();
			expect(mockDatabase.cheer.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: createData,
					include: expect.any(Object),
				}),
			);
		});
	});

	describe("findById", () => {
		it("ID로 Cheer를 조회한다", async () => {
			// Given
			const cheerId = 1;
			const expectedCheer = createMockCheer({ id: cheerId });
			mockDatabase.cheer.findUnique.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.findById(cheerId);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(mockDatabase.cheer.findUnique).toHaveBeenCalledWith({
				where: { id: cheerId },
			});
		});

		it("존재하지 않는 ID면 null을 반환한다", async () => {
			// Given
			mockDatabase.cheer.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByIdWithRelations", () => {
		it("ID로 Cheer를 관계 정보와 함께 조회한다", async () => {
			// Given
			const cheerId = 1;
			const expectedCheer = createMockCheerWithRelations({ id: cheerId });
			mockDatabase.cheer.findUnique.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.findByIdWithRelations(cheerId);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(result?.sender).toBeDefined();
			expect(result?.receiver).toBeDefined();
		});
	});

	describe("markAsRead", () => {
		it("Cheer를 읽음 처리한다", async () => {
			// Given
			const cheerId = 1;
			const readAt = new Date();
			const expectedCheer = createMockCheer({ id: cheerId, readAt });
			mockDatabase.cheer.update.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.markAsRead(cheerId);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(mockDatabase.cheer.update).toHaveBeenCalledWith({
				where: { id: cheerId },
				data: { readAt: expect.any(Date) },
			});
		});
	});

	describe("markManyAsRead", () => {
		it("여러 Cheer를 읽음 처리하고 처리된 수를 반환한다", async () => {
			// Given
			const cheerIds = [1, 2, 3];
			const receiverId = "receiver-1";
			mockDatabase.cheer.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.markManyAsRead(cheerIds, receiverId);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.cheer.updateMany).toHaveBeenCalledWith({
				where: {
					id: { in: cheerIds },
					receiverId,
					readAt: null,
				},
				data: { readAt: expect.any(Date) },
			});
		});

		it("이미 읽은 Cheer는 제외하고 처리한다", async () => {
			// Given
			const cheerIds = [1, 2, 3];
			const receiverId = "receiver-1";
			mockDatabase.cheer.updateMany.mockResolvedValue({ count: 1 });

			// When
			const result = await repository.markManyAsRead(cheerIds, receiverId);

			// Then
			expect(result).toBe(1);
		});
	});

	// ===========================================================================
	// 목록 조회 테스트
	// ===========================================================================

	describe("findReceivedCheers", () => {
		it("받은 Cheer 목록을 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "receiver-1",
				size: 10,
			};
			const expectedCheers = [
				createMockCheerWithRelations({ id: 1, receiverId: params.userId }),
				createMockCheerWithRelations({ id: 2, receiverId: params.userId }),
			];
			mockDatabase.cheer.findMany.mockResolvedValue(expectedCheers);

			// When
			const result = await repository.findReceivedCheers(params);

			// Then
			expect(result).toEqual(expectedCheers);
			expect(mockDatabase.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { receiverId: params.userId },
					take: params.size + 1,
					orderBy: { createdAt: "desc" },
				}),
			);
		});

		it("커서가 주어지면 해당 위치부터 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "receiver-1",
				cursor: 5,
				size: 10,
			};
			mockDatabase.cheer.findMany.mockResolvedValue([]);

			// When
			await repository.findReceivedCheers(params);

			// Then
			expect(mockDatabase.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: params.cursor },
				}),
			);
		});
	});

	describe("findSentCheers", () => {
		it("보낸 Cheer 목록을 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "sender-1",
				size: 10,
			};
			const expectedCheers = [
				createMockCheerWithRelations({ id: 1, senderId: params.userId }),
				createMockCheerWithRelations({ id: 2, senderId: params.userId }),
			];
			mockDatabase.cheer.findMany.mockResolvedValue(expectedCheers);

			// When
			const result = await repository.findSentCheers(params);

			// Then
			expect(result).toEqual(expectedCheers);
			expect(mockDatabase.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { senderId: params.userId },
					take: params.size + 1,
					orderBy: { createdAt: "desc" },
				}),
			);
		});
	});

	describe("countReceivedCheers", () => {
		it("받은 Cheer 총 개수를 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			mockDatabase.cheer.count.mockResolvedValue(15);

			// When
			const result = await repository.countReceivedCheers(userId);

			// Then
			expect(result).toBe(15);
			expect(mockDatabase.cheer.count).toHaveBeenCalledWith({
				where: { receiverId: userId },
			});
		});
	});

	describe("countUnreadCheers", () => {
		it("읽지 않은 Cheer 개수를 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			mockDatabase.cheer.count.mockResolvedValue(5);

			// When
			const result = await repository.countUnreadCheers(userId);

			// Then
			expect(result).toBe(5);
			expect(mockDatabase.cheer.count).toHaveBeenCalledWith({
				where: {
					receiverId: userId,
					readAt: null,
				},
			});
		});
	});

	describe("countSentCheers", () => {
		it("보낸 Cheer 총 개수를 반환한다", async () => {
			// Given
			const userId = "sender-1";
			mockDatabase.cheer.count.mockResolvedValue(10);

			// When
			const result = await repository.countSentCheers(userId);

			// Then
			expect(result).toBe(10);
			expect(mockDatabase.cheer.count).toHaveBeenCalledWith({
				where: { senderId: userId },
			});
		});
	});

	// ===========================================================================
	// 제한 및 쿨다운 체크 테스트
	// ===========================================================================

	describe("countTodayCheers", () => {
		it("오늘 보낸 Cheer 수를 반환한다", async () => {
			// Given
			const params: CheckDailyLimitParams = {
				senderId: "sender-1",
				date: new Date("2024-01-15T15:00:00Z"),
			};
			mockDatabase.cheer.count.mockResolvedValue(3);

			// When
			const result = await repository.countTodayCheers(params);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.cheer.count).toHaveBeenCalledWith({
				where: {
					senderId: params.senderId,
					createdAt: {
						gte: expect.any(Date),
						lte: expect.any(Date),
					},
				},
			});
		});

		it("날짜 범위가 해당 날짜의 00:00:00부터 23:59:59까지이다", async () => {
			// Given
			const testDate = new Date("2024-01-15T15:00:00Z");
			const params: CheckDailyLimitParams = {
				senderId: "sender-1",
				date: testDate,
			};
			mockDatabase.cheer.count.mockResolvedValue(0);

			// When
			await repository.countTodayCheers(params);

			// Then
			const callArgs = mockDatabase.cheer.count.mock.calls[0][0];
			const startDate = callArgs.where.createdAt.gte;
			const endDate = callArgs.where.createdAt.lte;

			expect(startDate.getHours()).toBe(0);
			expect(startDate.getMinutes()).toBe(0);
			expect(startDate.getSeconds()).toBe(0);
			expect(endDate.getHours()).toBe(23);
			expect(endDate.getMinutes()).toBe(59);
			expect(endDate.getSeconds()).toBe(59);
		});
	});

	describe("findLastCheerToUser", () => {
		it("특정 사용자에게 보낸 마지막 Cheer를 반환한다", async () => {
			// Given
			const params: CheckCooldownParams = {
				senderId: "sender-1",
				receiverId: "receiver-1",
			};
			const expectedCheer = createMockCheer({
				senderId: params.senderId,
				receiverId: params.receiverId,
			});
			mockDatabase.cheer.findFirst.mockResolvedValue(expectedCheer);

			// When
			const result = await repository.findLastCheerToUser(params);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(mockDatabase.cheer.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: params.senderId,
					receiverId: params.receiverId,
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("해당 사용자에게 보낸 Cheer가 없으면 null을 반환한다", async () => {
			// Given
			const params: CheckCooldownParams = {
				senderId: "sender-1",
				receiverId: "receiver-1",
			};
			mockDatabase.cheer.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.findLastCheerToUser(params);

			// Then
			expect(result).toBeNull();
		});
	});

	// ===========================================================================
	// 사용자 정보 조회 테스트
	// ===========================================================================

	describe("userExists", () => {
		it("사용자가 존재하면 true를 반환한다", async () => {
			// Given
			const userId = "user-1";
			mockDatabase.user.findUnique.mockResolvedValue({ id: userId });

			// When
			const result = await repository.userExists(userId);

			// Then
			expect(result).toBe(true);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: { id: true },
			});
		});

		it("사용자가 존재하지 않으면 false를 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.userExists("non-existent");

			// Then
			expect(result).toBe(false);
		});
	});

	describe("getUserName", () => {
		it("사용자 이름을 반환한다", async () => {
			// Given
			const userId = "user-1";
			const expectedName = "테스트유저";
			mockDatabase.user.findUnique.mockResolvedValue({
				profile: { name: expectedName },
			});

			// When
			const result = await repository.getUserName(userId);

			// Then
			expect(result).toBe(expectedName);
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: {
					profile: {
						select: { name: true },
					},
				},
			});
		});

		it("프로필이 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue({ profile: null });

			// When
			const result = await repository.getUserName("user-1");

			// Then
			expect(result).toBeNull();
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.getUserName("non-existent");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("getUserSubscriptionStatus", () => {
		it("사용자의 구독 상태를 반환한다", async () => {
			// Given
			const userId = "user-1";
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: "ACTIVE",
			});

			// When
			const result = await repository.getUserSubscriptionStatus(userId);

			// Then
			expect(result).toBe("ACTIVE");
			expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: { subscriptionStatus: true },
			});
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.getUserSubscriptionStatus("non-existent");

			// Then
			expect(result).toBeNull();
		});

		const subscriptionStatuses = [
			"FREE",
			"ACTIVE",
			"EXPIRED",
			"CANCELLED",
		] as const;

		it.each(
			subscriptionStatuses,
		)("구독 상태가 %s일 때 해당 상태를 반환한다", async (status) => {
			// Given
			mockDatabase.user.findUnique.mockResolvedValue({
				subscriptionStatus: status,
			});

			// When
			const result = await repository.getUserSubscriptionStatus("user-1");

			// Then
			expect(result).toBe(status);
		});
	});
});
