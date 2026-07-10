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
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CheerBuilder } from "@test/builders";
import { createMockPrisma } from "@test/mocks";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import { FollowFacade } from "@/follow";
import { NotificationQueueService } from "@/notification/queue";
import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import { PaginationService } from "@/shared/application/pagination";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { CheerRepository } from "./cheer.repository";
import { CheerService } from "./cheer.service";

describe("CheerService — 응원 서비스", () => {
	let service: CheerService;
	let cheerRepo: Mocked<CheerRepository>;
	let followFacade: Mocked<FollowFacade>;
	let paginationService: Mocked<PaginationService>;
	let notificationQueueService: Mocked<NotificationQueueService>;
	let entitlementService: Mocked<EntitlementService>;

	// 테스트 데이터
	const senderId = "sender-123";
	const receiverId = "receiver-456";

	beforeEach(async () => {
		// ID 카운터 리셋
		CheerBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(CheerService)
			// UNIT_OF_WORK — run이 콜백을 즉시 실행하는 passthrough mock
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			// TransactionHost.tx — getFeatureLimitInTx에 전달할 클라이언트 스텁
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: createMockPrisma() }))
			.compile();

		service = unit;
		cheerRepo = unitRef.get(CheerRepository);
		followFacade = unitRef.get(FollowFacade);
		paginationService = unitRef.get(PaginationService);
		notificationQueueService = unitRef.get(NotificationQueueService);
		entitlementService = unitRef.get(EntitlementService);

		// Repository 트랜잭션 메서드 기본 mock 설정
		(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(0);
		(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(null);
		(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(undefined);

		// EntitlementService 기본 mock 설정 (FREE 사용자)
		(entitlementService.getFeatureLimitInTx as jest.Mock).mockResolvedValue({
			dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});

		(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
			dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});

		// enforceLimit / calculateRemaining — 실제 로직 위임
		(entitlementService.enforceLimit as jest.Mock).mockImplementation(
			(entitlement, currentUsage, errorFactory) => {
				if (entitlement.dailyLimit === null) return;
				if (currentUsage < entitlement.dailyLimit) return;
				throw errorFactory(currentUsage, entitlement.dailyLimit);
			},
		);
		(entitlementService.calculateRemaining as jest.Mock).mockImplementation(
			(dailyLimit, used) => {
				if (dailyLimit === null) return null;
				return Math.max(0, dailyLimit - used);
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
	});

	describe("sendCheer", () => {
		const validParams = {
			senderId,
			receiverId,
			message: "축하해요!",
		};

		beforeEach(() => {
			// Given - 기본 성공 시나리오 설정
			(followFacade.isMutualFriend as jest.Mock).mockResolvedValue(true);

			// Repository 트랜잭션 메서드 mock 설정
			const expectedCheer = CheerBuilder.create(senderId, receiverId)
				.withMessage(validParams.message)
				.withSenderProfile({ name: "테스트유저", profileImage: null })
				.buildWithRelations();

			(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(0);
			(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(null);
			(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
				expectedCheer,
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
				(followFacade.isMutualFriend as jest.Mock).mockResolvedValue(false);

				// When & Then
				await expect(service.sendCheer(validParams)).rejects.toThrow();
			});

			it("친구 관계를 올바르게 확인한다", async () => {
				// When
				await service.sendCheer(validParams);

				// Then
				expect(followFacade.isMutualFriend).toHaveBeenCalledWith(
					validParams.senderId,
					validParams.receiverId,
				);
			});
		});

		describe("일일 제한 체크", () => {
			it("FREE 구독자가 일일 제한에 도달하면 에러를 던진다", async () => {
				// Given
				(entitlementService.getFeatureLimitInTx as jest.Mock).mockResolvedValue(
					{
						dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
						isAdmin: false,
						subscriptionStatus: "FREE",
					},
				);
				(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(
					CHEER_LIMITS.FREE_DAILY_LIMIT,
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

				(entitlementService.getFeatureLimitInTx as jest.Mock).mockResolvedValue(
					{
						dailyLimit: null,
						isAdmin: false,
						subscriptionStatus: "ACTIVE",
					},
				);
				(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(100);
				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});

			it("ADMIN은 구독 상태와 무관하게 일일 제한이 없다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: "테스트유저", profileImage: null })
					.buildWithRelations();

				(entitlementService.getFeatureLimitInTx as jest.Mock).mockResolvedValue(
					{
						dailyLimit: null,
						isAdmin: true,
						subscriptionStatus: "FREE",
					},
				);
				(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(100);
				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
			});

			it("EXPIRED 구독자는 FREE와 동일한 제한을 받는다", async () => {
				// Given
				(entitlementService.getFeatureLimitInTx as jest.Mock).mockResolvedValue(
					{
						dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
						isAdmin: false,
						subscriptionStatus: "EXPIRED",
					},
				);
				(cheerRepo.countSentSince as jest.Mock).mockResolvedValue(
					CHEER_LIMITS.FREE_DAILY_LIMIT,
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

				(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(
					recentCheer,
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

				(cheerRepo.findLastCheerToUser as jest.Mock).mockResolvedValue(
					oldCheer,
				);
				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
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

				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
				);

				// When
				const result = await service.sendCheer(validParams);

				// Then
				expect(result).toEqual(expectedCheer);
				expect(cheerRepo.createWithRelations).toHaveBeenCalledWith({
					senderId: validParams.senderId,
					receiverId: validParams.receiverId,
					message: validParams.message,
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

				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
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

				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
				);

				// When
				await service.sendCheer(validParams);

				// Then
				expect(notificationQueueService.enqueueCheerSent).toHaveBeenCalledWith(
					expect.objectContaining({
						cheerId: expectedCheer.id,
						senderId: validParams.senderId,
						receiverId: validParams.receiverId,
						senderName,
						message: validParams.message,
					}),
				);
			});

			it("발신자 이름을 조회할 수 없으면 userTag를 폴백으로 사용한다", async () => {
				// Given
				const expectedCheer = CheerBuilder.create(senderId, receiverId)
					.withMessage(validParams.message)
					.withSenderProfile({ name: null, profileImage: null })
					.buildWithRelations();

				(cheerRepo.createWithRelations as jest.Mock).mockResolvedValue(
					expectedCheer,
				);

				// When
				await service.sendCheer(validParams);

				// Then — NudgeService 패턴과 동일하게 userTag를 폴백으로 사용
				expect(notificationQueueService.enqueueCheerSent).toHaveBeenCalledWith(
					expect.objectContaining({
						senderName: "SENDER01",
					}),
				);
			});
		});
	});

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

	describe("getLimitInfo", () => {
		it("FREE 구독자의 일일 제한 정보를 반환한다", async () => {
			// Given
			const userId = "user-1";
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
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
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});
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

		it("ADMIN은 구독 상태와 무관하게 무제한이다", async () => {
			// Given
			const userId = "user-1";
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(100);

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result).toEqual({
				dailyLimit: null,
				used: 100,
				remaining: null,
			});
		});

		it("EntitlementService에 올바른 Feature를 전달한다", async () => {
			// Given
			const userId = "user-1";
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(0);

			// When
			await service.getLimitInfo(userId);

			// Then
			expect(entitlementService.getFeatureLimit).toHaveBeenCalledWith(
				userId,
				Feature.CHEER,
			);
		});

		it("남은 횟수가 음수가 되지 않는다", async () => {
			// Given
			const userId = "user-1";
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
			(cheerRepo.countTodayCheers as jest.Mock).mockResolvedValue(100); // 제한보다 많음

			// When
			const result = await service.getLimitInfo(userId);

			// Then
			expect(result.remaining).toBe(0);
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
