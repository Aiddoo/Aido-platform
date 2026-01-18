import { Test } from "@nestjs/testing";
import { DatabaseService } from "@/database/database.service";
import type { Nudge } from "@/generated/prisma/client";

import { NudgeRepository } from "./nudge.repository";
import type { NudgeWithRelations } from "./types";

// =============================================================================
// Mock Factory Functions
// =============================================================================

function createMockNudge(overrides: Partial<Nudge> = {}): Nudge {
	return {
		id: 1,
		senderId: "sender-id",
		receiverId: "receiver-id",
		todoId: 100,
		message: "할일 화이팅!",
		readAt: null,
		createdAt: new Date("2024-01-15T10:00:00Z"),
		...overrides,
	};
}

function createMockNudgeWithRelations(
	overrides: Partial<NudgeWithRelations> = {},
): NudgeWithRelations {
	const nudge = createMockNudge();
	return {
		...nudge,
		sender: {
			id: nudge.senderId,
			userTag: "sender_tag",
			profile: {
				name: "보내는 사람",
				profileImage: "https://example.com/sender.jpg",
			},
		},
		receiver: {
			id: nudge.receiverId,
			userTag: "receiver_tag",
			profile: {
				name: "받는 사람",
				profileImage: "https://example.com/receiver.jpg",
			},
		},
		todo: {
			id: nudge.todoId,
			title: "테스트 할일",
			completed: false,
		},
		...overrides,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe("NudgeRepository", () => {
	let repository: NudgeRepository;
	let database: jest.Mocked<DatabaseService>;

	beforeEach(async () => {
		const mockDatabase = {
			nudge: {
				create: jest.fn(),
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
				count: jest.fn(),
			},
			user: {
				findUnique: jest.fn(),
			},
			todo: {
				findUnique: jest.fn(),
			},
		};

		const module = await Test.createTestingModule({
			providers: [
				NudgeRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get(NudgeRepository);
		database = module.get(DatabaseService);
	});

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	describe("create", () => {
		it("Nudge를 생성한다", async () => {
			// Given
			const mockNudge = createMockNudge();
			const createInput = {
				sender: { connect: { id: "sender-id" } },
				receiver: { connect: { id: "receiver-id" } },
				todo: { connect: { id: 100 } },
				message: "할일 화이팅!",
			};
			(database.nudge.create as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.create(createInput);

			// Then
			expect(database.nudge.create).toHaveBeenCalledWith({ data: createInput });
			expect(result).toEqual(mockNudge);
		});

		it("트랜잭션 클라이언트를 사용하여 Nudge를 생성한다", async () => {
			// Given
			const mockNudge = createMockNudge();
			const createInput = {
				sender: { connect: { id: "sender-id" } },
				receiver: { connect: { id: "receiver-id" } },
				todo: { connect: { id: 100 } },
			};
			const txClient = {
				nudge: { create: jest.fn().mockResolvedValue(mockNudge) },
			} as unknown as DatabaseService;

			// When
			const result = await repository.create(createInput, txClient);

			// Then
			expect(txClient.nudge.create).toHaveBeenCalledWith({ data: createInput });
			expect(result).toEqual(mockNudge);
		});
	});

	describe("createWithRelations", () => {
		it("관계 정보가 포함된 Nudge를 생성한다", async () => {
			// Given
			const mockNudge = createMockNudgeWithRelations();
			const createInput = {
				sender: { connect: { id: "sender-id" } },
				receiver: { connect: { id: "receiver-id" } },
				todo: { connect: { id: 100 } },
				message: "할일 화이팅!",
			};
			(database.nudge.create as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.createWithRelations(createInput);

			// Then
			expect(database.nudge.create).toHaveBeenCalledWith({
				data: createInput,
				include: expect.objectContaining({
					sender: expect.any(Object),
					receiver: expect.any(Object),
					todo: expect.any(Object),
				}),
			});
			expect(result).toEqual(mockNudge);
		});
	});

	describe("findById", () => {
		it("ID로 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = createMockNudge();
			(database.nudge.findUnique as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findById(1);

			// Then
			expect(database.nudge.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(mockNudge);
		});

		it("존재하지 않는 Nudge는 null을 반환한다", async () => {
			// Given
			(database.nudge.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByIdWithRelations", () => {
		it("관계 정보가 포함된 Nudge를 ID로 조회한다", async () => {
			// Given
			const mockNudge = createMockNudgeWithRelations();
			(database.nudge.findUnique as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findByIdWithRelations(1);

			// Then
			expect(database.nudge.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
				include: expect.objectContaining({
					sender: expect.any(Object),
					receiver: expect.any(Object),
					todo: expect.any(Object),
				}),
			});
			expect(result).toEqual(mockNudge);
		});
	});

	describe("markAsRead", () => {
		it("Nudge를 읽음 처리한다", async () => {
			// Given
			const mockNudge = createMockNudge({ readAt: new Date() });
			(database.nudge.update as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.markAsRead(1);

			// Then
			expect(database.nudge.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { readAt: expect.any(Date) },
			});
			expect(result.readAt).not.toBeNull();
		});
	});

	// =========================================================================
	// 목록 조회
	// =========================================================================

	describe("findReceivedNudges", () => {
		it("받은 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				createMockNudgeWithRelations({ id: 1 }),
				createMockNudgeWithRelations({ id: 2 }),
			];
			(database.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findReceivedNudges({
				userId: "receiver-id",
				size: 20,
			});

			// Then
			expect(database.nudge.findMany).toHaveBeenCalledWith({
				where: { receiverId: "receiver-id" },
				include: expect.objectContaining({
					sender: expect.any(Object),
					receiver: expect.any(Object),
					todo: expect.any(Object),
				}),
				take: 21,
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudges);
		});

		it("커서 기반 페이지네이션을 적용한다", async () => {
			// Given
			const mockNudges = [createMockNudgeWithRelations({ id: 3 })];
			(database.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findReceivedNudges({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});

			// Then
			expect(database.nudge.findMany).toHaveBeenCalledWith({
				where: { receiverId: "receiver-id" },
				include: expect.any(Object),
				take: 11,
				skip: 1,
				cursor: { id: 5 },
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudges);
		});
	});

	describe("findSentNudges", () => {
		it("보낸 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				createMockNudgeWithRelations({ id: 1 }),
				createMockNudgeWithRelations({ id: 2 }),
			];
			(database.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findSentNudges({
				userId: "sender-id",
				size: 20,
			});

			// Then
			expect(database.nudge.findMany).toHaveBeenCalledWith({
				where: { senderId: "sender-id" },
				include: expect.any(Object),
				take: 21,
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudges);
		});
	});

	// =========================================================================
	// 제한 및 쿨다운 체크
	// =========================================================================

	describe("countTodayNudges", () => {
		it("오늘 보낸 Nudge 수를 조회한다", async () => {
			// Given
			const today = new Date("2024-01-15T12:00:00Z");
			(database.nudge.count as jest.Mock).mockResolvedValue(3);

			// When
			const result = await repository.countTodayNudges({
				senderId: "sender-id",
				date: today,
			});

			// Then
			expect(database.nudge.count).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					createdAt: {
						gte: expect.any(Date),
						lte: expect.any(Date),
					},
				},
			});
			expect(result).toBe(3);
		});
	});

	describe("findLastNudgeForTodo", () => {
		it("특정 Todo에 대한 마지막 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = createMockNudge();
			(database.nudge.findFirst as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findLastNudgeForTodo({
				senderId: "sender-id",
				todoId: 100,
			});

			// Then
			expect(database.nudge.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					todoId: 100,
				},
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudge);
		});

		it("Nudge가 없으면 null을 반환한다", async () => {
			// Given
			(database.nudge.findFirst as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findLastNudgeForTodo({
				senderId: "sender-id",
				todoId: 100,
			});

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findLastNudgeToUser", () => {
		it("특정 사용자에게 보낸 마지막 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = createMockNudge();
			(database.nudge.findFirst as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findLastNudgeToUser(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(database.nudge.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					receiverId: "receiver-id",
				},
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudge);
		});
	});

	// =========================================================================
	// 사용자 및 Todo 존재 확인
	// =========================================================================

	describe("userExists", () => {
		it("사용자가 존재하면 true를 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				id: "user-id",
			});

			// When
			const result = await repository.userExists("user-id");

			// Then
			expect(database.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-id" },
				select: { id: true },
			});
			expect(result).toBe(true);
		});

		it("사용자가 존재하지 않으면 false를 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.userExists("non-existent");

			// Then
			expect(result).toBe(false);
		});
	});

	describe("getUserName", () => {
		it("사용자 이름을 조회한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				profile: { name: "테스트 유저" },
			});

			// When
			const result = await repository.getUserName("user-id");

			// Then
			expect(database.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-id" },
				select: {
					profile: { select: { name: true } },
				},
			});
			expect(result).toBe("테스트 유저");
		});

		it("프로필이 없으면 null을 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				profile: null,
			});

			// When
			const result = await repository.getUserName("user-id");

			// Then
			expect(result).toBeNull();
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.getUserName("non-existent");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("getUserSubscriptionStatus", () => {
		it("사용자 구독 상태를 조회한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				subscriptionStatus: "ACTIVE",
			});

			// When
			const result = await repository.getUserSubscriptionStatus("user-id");

			// Then
			expect(database.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user-id" },
				select: { subscriptionStatus: true },
			});
			expect(result).toBe("ACTIVE");
		});

		it("사용자가 없으면 null을 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.getUserSubscriptionStatus("non-existent");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findTodoWithOwner", () => {
		it("Todo와 소유자 정보를 조회한다", async () => {
			// Given
			const mockTodo = { id: 100, userId: "user-id", title: "테스트 할일" };
			(database.todo.findUnique as jest.Mock).mockResolvedValue(mockTodo);

			// When
			const result = await repository.findTodoWithOwner(100);

			// Then
			expect(database.todo.findUnique).toHaveBeenCalledWith({
				where: { id: 100 },
				select: { id: true, userId: true, title: true },
			});
			expect(result).toEqual(mockTodo);
		});

		it("Todo가 없으면 null을 반환한다", async () => {
			// Given
			(database.todo.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findTodoWithOwner(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("isTodoPublic", () => {
		it("PUBLIC Todo는 true를 반환한다", async () => {
			// Given
			(database.todo.findUnique as jest.Mock).mockResolvedValue({
				visibility: "PUBLIC",
			});

			// When
			const result = await repository.isTodoPublic(100);

			// Then
			expect(database.todo.findUnique).toHaveBeenCalledWith({
				where: { id: 100 },
				select: { visibility: true },
			});
			expect(result).toBe(true);
		});

		it("PRIVATE Todo는 false를 반환한다", async () => {
			// Given
			(database.todo.findUnique as jest.Mock).mockResolvedValue({
				visibility: "PRIVATE",
			});

			// When
			const result = await repository.isTodoPublic(100);

			// Then
			expect(result).toBe(false);
		});

		it("Todo가 없으면 false를 반환한다", async () => {
			// Given
			(database.todo.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.isTodoPublic(999);

			// Then
			expect(result).toBe(false);
		});
	});
});
