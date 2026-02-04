/**
 * CheerService 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { CHEER_LIMITS } from "@aido/validators";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CheerBuilder } from "@test/builders";
import { CacheService } from "@/common/cache/cache.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "@/modules/follow/follow.service";
import { NotificationEvents } from "@/modules/notification/events";

import { CheerRepository } from "./cheer.repository";
import { CheerService } from "./cheer.service";

// =============================================================================
// Test Suite
// =============================================================================

describe("CheerService", () => {
	let service: CheerService;
	let cheerRepo: Mocked<CheerRepository>;
	let followService: Mocked<FollowService>;
	let paginationService: Mocked<PaginationService>;
	let eventEmitter: Mocked<EventEmitter2>;
	let database: Mocked<DatabaseService>;
	let cacheService: Mocked<CacheService>;

	// 테스트 데이터
	const senderId = "sender-123";
	const receiverId = "receiver-456";

	beforeEach(async () => {
		// ID 카운터 리셋
		CheerBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(CheerService).compile();

		service = unit;
		cheerRepo = unitRef.get(
			CheerRepository,
		) as unknown as Mocked<CheerRepository>;
		followService = unitRef.get(
			FollowService,
		) as unknown as Mocked<FollowService>;
		paginationService = unitRef.get(
			PaginationService,
		) as unknown as Mocked<PaginationService>;
		eventEmitter = unitRef.get(
			EventEmitter2,
		) as unknown as Mocked<EventEmitter2>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		cacheService = unitRef.get(CacheService) as unknown as Mocked<CacheService>;

		// DatabaseService.$transaction passthrough mock 설정
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => {
				const txProxy = {
					user: {
						findUnique: jest
							.fn()
							.mockResolvedValue({ subscriptionStatus: "FREE" }),
					},
					cheer: {
						count: jest.fn().mockResolvedValue(0),
						findFirst: jest.fn().mockResolvedValue(null),
						create: jest.fn(),
					},
				};
				return callback(txProxy);
			},
		);

		// PaginationService 기본 mock 설정
		(paginationService.normalizeCursorPagination as jest.Mock).mockReturnValue({
			cursor: undefined,
			size: 20,
		});
		(
			paginationService.createCursorPaginatedResponse as jest.Mock
		).mockImplementation(({ items, size }) => ({
			data: items.slice(0, size),
			meta: {
				hasNextPage: items.length > size,
				nextCursor: items.length > size ? items[size - 1].id : null,
			},
		}));

		// CacheService 기본 mock 설정
		(cacheService.getSubscription as jest.Mock).mockResolvedValue(undefined);
	});

	// ===========================================================================
	// sendCheer 테스트
	// ===========================================================================

	describe("sendCheer", () => {
		const validParams = {
			senderId,
			receiverId,
			message: "축하해요!",
		};

		beforeEach(() => {
			// Given: 기본 성공 시나리오 설정
			(followService.isMutualFriend as jest.Mock).mockResolvedValue(true);

			// 트랜잭션 내부 mock 설정
			(database.$transaction as jest.Mock).mockImplementation(
				async (callback: (tx: unknown) => Promise<unknown>) => {
					const expectedCheer = CheerBuilder.create(senderId, receiverId)
						.withMessage(validParams.message)
						.withSenderProfile({ name: "테스트유저", profileImage: null })
						.buildWithRelations();

					const txProxy = {
						user: {
							findUnique: jest
								.fn()
								.mockResolvedValue({ subscriptionStatus: "FREE" }),
						},
						cheer: {
							count: jest.fn().mockResolvedValue(0),
							findFirst: jest.fn().mockResolvedValue(null),
							create: jest.fn().mockResolvedValue(expectedCheer),
						},
					};
					return callback(txProxy);
				},
			);
		});

		describe("자기 자신 체크", () => {
			it("자기 자신에게 응원하면 에러를 던진다", async () => {
				// Given
				const params = {
					senderId: "user-1",
					receiverId: "user-1",
				};

				// When & Then
				await expect(service.sendCheer(params)).rejects.toThrow();
			});
		});

		describe("친구 관계 확인", () => {
			it("친구가 아니면 에러를 던진다", async () => {
				// Given
				(followService.isMutualFriend as jest.Mock).mockResolvedValue(false);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("친구 관계를 올바르게 확인한다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(followService.isMutualFriend).toHaveBeenCalledWith(
					validParams.senderId,
					validParams.receiverId,
				);
			});
		});

		describe("일일 제한 체크", () => {
			it("FREE 구독자가 일일 제한에 도달하면 에러를 던진다", async () => {
				// Given
				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest
									.fn()
									.mockResolvedValue(CHEER_LIMITS.FREE_DAILY_LIMIT),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn(),
							},
						};
						return callback(txProxy);
					},
				);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("ACTIVE 구독자는 일일 제한이 없다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "ACTIVE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(100),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});

			it("EXPIRED 구독자는 FREE와 동일한 제한을 받는다", async () => {
				// Given
				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "EXPIRED" }),
							},
							cheer: {
								count: jest
									.fn()
									.mockResolvedValue(CHEER_LIMITS.FREE_DAILY_LIMIT),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn(),
							},
						};
						return callback(txProxy);
					},
				);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});
		});

		describe("쿨다운 체크", () => {
			it("쿨다운이 활성화되어 있으면 에러를 던진다", async () => {
				// Given
				const recentCheer = CheerBuilder.create(senderId, receiverId)
					.withCreatedAt(new Date()) // 방금 생성된 Cheer
					.build();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(recentCheer),
								create: jest.fn(),
							},
						};
						return callback(txProxy);
					},
				);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("쿨다운 시간이 지나면 응원을 보낼 수 있다", async () => {
				// Given
				const oldCheer = CheerBuilder.create(senderId, receiverId)
					.withCreatedAt(
						new Date(
							Date.now() - (CHEER_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
						),
					)
					.build();

				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(oldCheer),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});
		});

		describe("Cheer 생성", () => {
			it("모든 검증을 통과하면 Cheer를 생성한다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				let capturedCreateArgs: unknown = null;

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockImplementation((args) => {
									capturedCreateArgs = args;
									return expectedCheer;
								}),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
				expect(capturedCreateArgs).toEqual({
					data: {
						sender: { connect: { id: validParams.senderId } },
						receiver: { connect: { id: validParams.receiverId } },
						message: validParams.message,
					},
					include: {
						sender: {
							select: {
								id: true,
								userTag: true,
								profile: {
									select: {
										name: true,
										profileImage: true,
									},
								},
							},
						},
						receiver: {
							select: {
								id: true,
								userTag: true,
								profile: {
									select: {
										name: true,
										profileImage: true,
									},
								},
							},
						},
					},
				});
			});

			it("메시지 없이도 Cheer를 생성할 수 있다", async () => {
				// Given
				const paramsWithoutMessage = {
					senderId,
					receiverId,
				};

				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				const result = await service.sendCheer(paramsWithoutMessage);

				// Then
				expect(result.message).toBeNull();
			});
		});

		describe("이벤트 발행", () => {
			it("Cheer 생성 후 이벤트를 발행한다", async () => {
				// Given
				const senderName = "발신자";
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: senderName, profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(eventEmitter.emit).toHaveBeenCalledWith(
					NotificationEvents.CHEER_SENT,
					expect.objectContaining({
						cheerId: expectedCheer.id,
						senderId: validParams.senderId,
						receiverId: validParams.receiverId,
						senderName,
						message: validParams.message,
					}),
				);
			});

			it("발신자 이름을 조회할 수 없으면 기본값을 사용한다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: null, profileImage: null })
					.buildWithRelations();

				(database.$transaction as jest.Mock).mockImplementation(
					async (callback: (tx: unknown) => Promise<unknown>) => {
						const txProxy = {
							user: {
								findUnique: jest
									.fn()
									.mockResolvedValue({ subscriptionStatus: "FREE" }),
							},
							cheer: {
								count: jest.fn().mockResolvedValue(0),
								findFirst: jest.fn().mockResolvedValue(null),
								create: jest.fn().mockResolvedValue(expectedCheer),
							},
						};
						return callback(txProxy);
					},
				);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(eventEmitter.emit).toHaveBeenCalledWith(
					NotificationEvents.CHEER_SENT,
					expect.objectContaining({
						senderName: "알 수 없음",
					}),
				);
			});
		});
	});

	// ===========================================================================
	// 목록 조회 테스트
	// ===========================================================================

	describe("getReceivedCheers", () => {
		it("받은 응원 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheers = [
				CheerBuilder.create("sender-1", userId).withId(1).buildWithRelations(),
				CheerBuilder.create("sender-2", userId).withId(2).buildWithRelations(),
			];
			(cheerRepo.findReceivedCheers as jest.Mock).mockResolvedValue(cheers);
			(
				paginationService.normalizeCursorPagination as jest.Mock
			).mockReturnValue({
				cursor: undefined,
				size: 20,
			});

			// When
			const result = await service.getReceivedCheers({ userId });

			// Then
			expect(cheerRepo.findReceivedCheers).toHaveBeenCalledWith({
				userId,
				cursor: undefined,
				size: 20,
			});
			expect(
				paginationService.createCursorPaginatedResponse,
			).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it("커서와 사이즈가 주어지면 해당 값으로 조회한다", async () => {
			// Given
			const userId = "receiver-1";
			const cursor = 5;
			const size = 10;
			(
				paginationService.normalizeCursorPagination as jest.Mock
			).mockReturnValue({
				cursor,
				size,
			});
			(cheerRepo.findReceivedCheers as jest.Mock).mockResolvedValue([]);

			// When
			await service.getReceivedCheers({ userId, cursor, size });

			// Then
			expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
				cursor,
				size,
			});
			expect(cheerRepo.findReceivedCheers).toHaveBeenCalledWith({
				userId,
				cursor,
				size,
			});
		});
	});

	describe("getSentCheers", () => {
		it("보낸 응원 목록을 페이지네이션하여 반환한다", async () => {
			// Given
			const userId = "sender-1";
			const cheers = [
				CheerBuilder.create(userId, "receiver-1")
					.withId(1)
					.buildWithRelations(),
				CheerBuilder.create(userId, "receiver-2")
					.withId(2)
					.buildWithRelations(),
			];
			(cheerRepo.findSentCheers as jest.Mock).mockResolvedValue(cheers);
			(
				paginationService.normalizeCursorPagination as jest.Mock
			).mockReturnValue({
				cursor: undefined,
				size: 20,
			});

			// When
			const result = await service.getSentCheers({ userId });

			// Then
			expect(cheerRepo.findSentCheers).toHaveBeenCalledWith({
				userId,
				cursor: undefined,
				size: 20,
			});
			expect(result).toBeDefined();
		});
	});

	// ===========================================================================
	// 제한 및 쿨다운 정보 테스트
	// ===========================================================================

	describe("getLimitInfo", () => {
		it("FREE 구독자의 일일 제한 정보를 반환한다", async () => {
			// Given
			const userId = "user-1";
			(cheerRepo.getUserSubscriptionStatus as jest.Mock).mockResolvedValue(
				"FREE",
			);
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(1);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result).toEqual({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				used: 1,
				remaining: CHEER_LIMITS.FREE_DAILY_LIMIT - 1,
			});
		});

		it("ACTIVE 구독자는 무제한 제한 정보를 반환한다", async () => {
			// Given
			const userId = "user-1";
			(cheerRepo.getUserSubscriptionStatus as jest.Mock).mockResolvedValue(
				"ACTIVE",
			);
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(50);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result).toEqual({
				dailyLimit: null,
				used: 50,
				remaining: null,
			});
		});

		it("구독 상태가 없으면 FREE로 처리한다", async () => {
			// Given
			const userId = "user-1";
			(cheerRepo.getUserSubscriptionStatus as jest.Mock).mockResolvedValue(
				null,
			);
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(0);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.dailyLimit).toBe(CHEER_LIMITS.FREE_DAILY_LIMIT);
		});

		it("남은 횟수가 음수가 되지 않는다", async () => {
			// Given
			const userId = "user-1";
			(cheerRepo.getUserSubscriptionStatus as jest.Mock).mockResolvedValue(
				"FREE",
			);
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(100); // 제한보다 많음

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.remaining).toBe(0);
		});

		it("캐시된 구독 상태를 사용한다", async () => {
			// Given
			const userId = "user-1";
			(cacheService.getSubscription as jest.Mock).mockResolvedValue({
				status: "ACTIVE",
			});
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(10);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.dailyLimit).toBeNull();
			expect(cheerRepo.getUserSubscriptionStatus).not.toHaveBeenCalled();
		});
	});

	describe("getCooldownInfoForUser", () => {
		it("이전 응원이 없으면 쿨다운이 비활성화 상태이다", async () => {
			// Given
			(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result).toEqual({
				isActive: false,
				remainingSeconds: 0,
				canCheerAt: null,
			});
		});

		it("쿨다운 시간이 지나면 비활성화 상태이다", async () => {
			// Given
			const oldCheer = CheerBuilder.create(senderId, receiverId)
				.withCreatedAt(
					new Date(
						Date.now() - (CHEER_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
					),
				)
				.build();
			(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(oldCheer);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
			expect(result.canCheerAt).toBeNull();
		});

		it("쿨다운 시간 내이면 활성화 상태이다", async () => {
			// Given
			const recentCheer = CheerBuilder.create(senderId, receiverId)
				.withCreatedAt(new Date(Date.now() - 1000)) // 1초 전
				.build();
			(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(
				recentCheer,
			);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.canCheerAt).toBeInstanceOf(Date);
		});

		it("남은 쿨다운 시간이 정확하게 계산된다", async () => {
			// Given
			const halfCooldownMs = (CHEER_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000) / 2;
			const halfwayCheer = CheerBuilder.create(senderId, receiverId)
				.withCreatedAt(new Date(Date.now() - halfCooldownMs))
				.build();
			(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(
				halfwayCheer,
			);

			// When
			const result = await service.getCooldownInfoForUser(senderId, receiverId);

			// Then
			const expectedRemainingSeconds = Math.ceil(halfCooldownMs / 1000);
			// 허용 오차 10초 (테스트 실행 시간 고려)
			expect(result.remainingSeconds).toBeGreaterThan(
				expectedRemainingSeconds - 10,
			);
			expect(result.remainingSeconds).toBeLessThan(
				expectedRemainingSeconds + 10,
			);
		});
	});

	// ===========================================================================
	// 읽음 처리 테스트
	// ===========================================================================

	describe("markAsRead", () => {
		it("응원을 읽음 처리한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerId = 1;
			const cheer = CheerBuilder.create("sender-1", userId)
				.withId(cheerId)
				.asUnread()
				.build();
			(cheerRepo.findById as jest.Mock).mockResolvedValue(cheer);
			(cheerRepo.markAsRead as jest.Mock).mockResolvedValue({
				...cheer,
				readAt: new Date(),
			});

			// When
			await service.markAsRead(userId, cheerId);

			// Then
			expect(cheerRepo.markAsRead).toHaveBeenCalledWith(cheerId);
		});

		it("응원이 존재하지 않으면 에러를 던진다", async () => {
			// Given
			(cheerRepo.findById as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(service.markAsRead("user-1", 999)).rejects.toThrow();
		});

		it("수신자가 아니면 에러를 던진다", async () => {
			// Given
			const cheer = CheerBuilder.create("sender-1", "other-user")
				.withId(1)
				.build();
			(cheerRepo.findById as jest.Mock).mockResolvedValue(cheer);

			// When & Then
			await expect(service.markAsRead("user-1", 1)).rejects.toThrow();
		});

		it("이미 읽은 응원은 다시 처리하지 않는다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerId = 1;
			const cheer = CheerBuilder.create("sender-1", userId)
				.withId(cheerId)
				.asRead()
				.build();
			(cheerRepo.findById as jest.Mock).mockResolvedValue(cheer);

			// When
			await service.markAsRead(userId, cheerId);

			// Then
			expect(cheerRepo.markAsRead).not.toHaveBeenCalled();
		});
	});

	describe("markManyAsRead", () => {
		it("여러 응원을 읽음 처리하고 처리된 수를 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			const cheerIds = [1, 2, 3];
			(cheerRepo.markManyAsRead as jest.Mock).mockResolvedValue(3);

			// When
			const result = await service.markManyAsRead(userId, cheerIds);

			// Then
			expect(result).toBe(3);
			expect(cheerRepo.markManyAsRead).toHaveBeenCalledWith(cheerIds, userId);
		});

		it("빈 배열이 주어지면 0을 반환한다", async () => {
			// Given
			const userId = "receiver-1";
			(cheerRepo.markManyAsRead as jest.Mock).mockResolvedValue(0);

			// When
			const result = await service.markManyAsRead(userId, []);

			// Then
			expect(result).toBe(0);
		});
	});
});
