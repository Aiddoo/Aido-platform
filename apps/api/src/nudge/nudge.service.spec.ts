/**
 * NudgeService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - Given/When/Then 패턴으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NudgeBuilder } from "@test/builders";
import { createMockPrisma, createUnitOfWorkMock } from "@test/mocks";
import { FollowService } from "@/follow/follow.service";
import { NotificationQueueService } from "@/notification/queue";
import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import { PaginationService } from "@/shared/application/pagination";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import { addDays, subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { NudgeRepository } from "./nudge.repository";
import { NudgeService } from "./nudge.service";

describe("NudgeService — 찔러보기 서비스", () => {
	let service: NudgeService;
	let nudgeRepository: Mocked<NudgeRepository>;
	let followService: Mocked<FollowService>;
	let paginationService: Mocked<PaginationService>;
	let notificationQueueService: Mocked<NotificationQueueService>;
	let entitlementService: Mocked<EntitlementService>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		// UNIT_OF_WORK는 passthrough, TransactionHost.tx는 Prisma mock으로 스텁
		// (getFeatureLimitInTx에 CLS 활성 트랜잭션을 전달하는 경로)
		const { unit, unitRef } = await TestBed.solitary(NudgeService)
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: createMockPrisma() }))
			.compile();

		service = unit;
		nudgeRepository = unitRef.get(NudgeRepository);
		followService = unitRef.get(FollowService);
		paginationService = unitRef.get(PaginationService);
		notificationQueueService = unitRef.get(NotificationQueueService);
		entitlementService = unitRef.get(EntitlementService);

		// EntitlementService 기본 mock 설정 (FREE 사용자)
		entitlementService.getFeatureLimitInTx.mockResolvedValue({
			dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});

		entitlementService.getFeatureLimit.mockResolvedValue({
			dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});

		// enforceLimit / calculateRemaining — 실제 로직 위임
		entitlementService.enforceLimit.mockImplementation(
			(entitlement, currentUsage, errorFactory) => {
				if (entitlement.dailyLimit === null) return;
				if (currentUsage < entitlement.dailyLimit) return;
				throw errorFactory(currentUsage, entitlement.dailyLimit);
			},
		);
		entitlementService.calculateRemaining.mockImplementation(
			(dailyLimit, used) => {
				if (dailyLimit === null) return null;
				return Math.max(0, dailyLimit - used);
			},
		);

		// 기본 paginationService mock 설정
		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: undefined,
			size: 20,
			take: 21,
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			({ items, size }) => ({
				items: items.slice(0, size),
				pagination: {
					nextCursor:
						items.length > size ? (items[size - 1]?.id ?? null) : null,
					hasNext: items.length > size,
					size,
				},
			}),
		);

		// ID 카운터 리셋
		NudgeBuilder.resetIdCounter();
	});

	describe("sendNudge", () => {
		const defaultParams = {
			senderId: "sender-id",
			receiverId: "receiver-id",
			todoId: 100,
			message: "할일 화이팅!",
		};

		/**
		 * 성공 시나리오 mock 설정 헬퍼
		 */
		const todayMidnight = todayInTimezone("UTC");

		const setupSuccessfulSend = () => {
			followService.isMutualFriend.mockResolvedValue(true);

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(0);
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			const nudgeWithRelations = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			)
				.withMessage("할일 화이팅!")
				.withSenderInfo({
					id: "sender-id",
					userTag: "sender_tag",
					profile: { name: "보내는 사람", profileImage: null },
				})
				.withReceiverInfo({
					id: "receiver-id",
					userTag: "receiver_tag",
					profile: { name: "받는 사람", profileImage: null },
				})
				.withTodoInfo({ id: 100, title: "테스트 할일", completed: false })
				.buildWithRelations();

			nudgeRepository.createNudge.mockResolvedValue(nudgeWithRelations);
		};

		it("Nudge를 성공적으로 발송한다", async () => {
			// Given
			setupSuccessfulSend();

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(followService.isMutualFriend).toHaveBeenCalledWith(
				"sender-id",
				"receiver-id",
			);
			expect(nudgeRepository.createNudge).toHaveBeenCalledWith({
				senderId: "sender-id",
				receiverId: "receiver-id",
				todoId: 100,
				message: "할일 화이팅!",
			});
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});

		it("Nudge 발송 후 알림 큐에 등록한다", async () => {
			// Given
			setupSuccessfulSend();

			// When
			await service.sendNudge(defaultParams);

			// Then
			expect(notificationQueueService.enqueueNudgeSent).toHaveBeenCalledWith(
				expect.objectContaining({
					nudgeId: 1,
					senderId: "sender-id",
					receiverId: "receiver-id",
					senderName: "보내는 사람",
					todoId: 100,
					todoTitle: "테스트 할일",
					message: "할일 화이팅!",
				}),
			);
		});

		it("자기 자신에게 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			const params = { ...defaultParams, receiverId: "sender-id" };

			// When & Then
			await expect(service.sendNudge(params)).rejects.toThrow();
		});

		it("친구가 아닌 사용자에게 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(false);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("존재하지 않는 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue(null);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("다른 사용자의 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "other-user-id",
				title: "다른 사람 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("일일 제한을 초과하면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.countTodayNudges.mockResolvedValue(
				NUDGE_LIMITS.FREE_DAILY_LIMIT,
			);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("PRIVATE Todo에는 Nudge를 보낼 수 없다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "비공개 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PRIVATE",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("ACTIVE 구독자는 무제한 Nudge를 보낼 수 있다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});

			nudgeRepository.countTodayNudges.mockResolvedValue(100);
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			const nudgeWithRelations = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			)
				.withSenderInfo({
					id: "sender-id",
					userTag: "sender_tag",
					profile: { name: "보내는 사람", profileImage: null },
				})
				.withTodoInfo({ id: 100, title: "테스트 할일", completed: false })
				.buildWithRelations();

			nudgeRepository.createNudge.mockResolvedValue(nudgeWithRelations);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});

		it("ADMIN은 구독 상태와 무관하게 무제한 Nudge를 보낼 수 있다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.countTodayNudges.mockResolvedValue(100);
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			const nudgeWithRelations = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			)
				.withSenderInfo({
					id: "sender-id",
					userTag: "sender_tag",
					profile: { name: "보내는 사람", profileImage: null },
				})
				.withTodoInfo({ id: 100, title: "테스트 할일", completed: false })
				.buildWithRelations();

			nudgeRepository.createNudge.mockResolvedValue(nudgeWithRelations);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});

		it("쿨다운 기간에는 같은 Todo에 Nudge를 보낼 수 없다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.countTodayNudges.mockResolvedValue(0);

			const recentNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withCreatedAt(new Date()) // 방금 보낸 Nudge
				.build();
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(recentNudge);

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("어제 단일 날짜 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			const yesterday = subtractDays(1, todayMidnight);
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "어제 할일",
				startDate: yesterday,
				endDate: null,
				visibility: "PUBLIC",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("내일 단일 날짜 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			const tomorrow = addDays(1, todayMidnight);
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "내일 할일",
				startDate: tomorrow,
				endDate: null,
				visibility: "PUBLIC",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("오늘 포함 기간 Todo에 Nudge를 보낼 수 있다", async () => {
			// Given
			const yesterday = subtractDays(1, todayMidnight);
			const tomorrow = addDays(1, todayMidnight);
			followService.isMutualFriend.mockResolvedValue(true);

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "기간 할일",
				startDate: yesterday,
				endDate: tomorrow,
				visibility: "PUBLIC",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(0);
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			const nudgeWithRelations = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			)
				.withSenderInfo({
					id: "sender-id",
					userTag: "sender_tag",
					profile: { name: "보내는 사람", profileImage: null },
				})
				.withTodoInfo({ id: 100, title: "기간 할일", completed: false })
				.buildWithRelations();
			nudgeRepository.createNudge.mockResolvedValue(nudgeWithRelations);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});

		it("지난 기간 Todo에 Nudge를 보내면 에러를 발생시킨다", async () => {
			// Given
			const fiveDaysAgo = subtractDays(5, todayMidnight);
			const twoDaysAgo = subtractDays(2, todayMidnight);
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "지난 기간 할일",
				startDate: fiveDaysAgo,
				endDate: twoDaysAgo,
				visibility: "PUBLIC",
			});

			// When & Then
			await expect(service.sendNudge(defaultParams)).rejects.toThrow();
		});

		it("쿨다운이 지나면 같은 Todo에 다시 Nudge를 보낼 수 있다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);

			nudgeRepository.findTodoForNudge.mockResolvedValue({
				id: 100,
				userId: "receiver-id",
				title: "테스트 할일",
				startDate: todayMidnight,
				endDate: null,
				visibility: "PUBLIC",
			});

			entitlementService.getFeatureLimitInTx.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			nudgeRepository.countTodayNudges.mockResolvedValue(0);

			const oldNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withCreatedAt(
					new Date(
						Date.now() - (NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
					),
				)
				.build();
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(oldNudge);

			const nudgeWithRelations = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			)
				.withSenderInfo({
					id: "sender-id",
					userTag: "sender_tag",
					profile: { name: "보내는 사람", profileImage: null },
				})
				.withTodoInfo({ id: 100, title: "테스트 할일", completed: false })
				.buildWithRelations();
			nudgeRepository.createNudge.mockResolvedValue(nudgeWithRelations);

			// When
			const result = await service.sendNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});
	});

	describe("sendRemindNudge", () => {
		const defaultParams = {
			senderId: "sender-id",
			receiverId: "receiver-id",
			message: "할일 좀 만들어!",
		};

		const mockRemindNudgeResult = {
			id: 1,
			senderId: "sender-id",
			receiverId: "receiver-id",
			message: "할일 좀 만들어!",
			createdAt: new Date(),
			sender: {
				id: "sender-id",
				userTag: "SENDER01",
				profile: { name: "보내는 사람", profileImage: null },
			},
		};

		const setupSuccessfulRemindSend = () => {
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.countTodayTodos.mockResolvedValue(0);
			nudgeRepository.findLastRemindNudge.mockResolvedValue(null);
			nudgeRepository.createRemindNudge.mockResolvedValue(
				mockRemindNudgeResult,
			);
		};

		it("리마인드 Nudge를 성공적으로 발송한다", async () => {
			// Given
			setupSuccessfulRemindSend();

			// When
			const result = await service.sendRemindNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
			expect(result.sender.profile?.name).toBe("보내는 사람");
		});

		it("발송 후 알림 큐에 등록한다 (todoId/todoTitle 없이)", async () => {
			// Given
			setupSuccessfulRemindSend();

			// When
			await service.sendRemindNudge(defaultParams);

			// Then
			expect(notificationQueueService.enqueueNudgeSent).toHaveBeenCalledWith({
				nudgeId: 1,
				senderId: "sender-id",
				receiverId: "receiver-id",
				senderName: "보내는 사람",
				message: "할일 좀 만들어!",
			});
		});

		it("자기 자신에게 보내면 에러를 발생시킨다", async () => {
			// Given
			const params = { ...defaultParams, receiverId: "sender-id" };

			// When & Then
			await expect(service.sendRemindNudge(params)).rejects.toThrow();
		});

		it("친구가 아닌 사용자에게 보내면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(false);

			// When & Then
			await expect(service.sendRemindNudge(defaultParams)).rejects.toThrow();
		});

		it("친구가 오늘 할일이 있으면 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.countTodayTodos.mockResolvedValue(1);

			// When & Then
			await expect(service.sendRemindNudge(defaultParams)).rejects.toThrow();
		});

		it("같은 친구에게 1시간 쿨다운 내 재전송 시 에러를 발생시킨다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.countTodayTodos.mockResolvedValue(0);
			nudgeRepository.findLastRemindNudge.mockResolvedValue({
				id: 1,
				senderId: "sender-id",
				receiverId: "receiver-id",
				message: null,
				createdAt: new Date(), // 방금 보냄
			});

			// When & Then
			await expect(service.sendRemindNudge(defaultParams)).rejects.toThrow();
		});

		it("쿨다운이 지나면 같은 친구에게 다시 보낼 수 있다", async () => {
			// Given
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.countTodayTodos.mockResolvedValue(0);
			nudgeRepository.findLastRemindNudge.mockResolvedValue({
				id: 1,
				senderId: "sender-id",
				receiverId: "receiver-id",
				message: null,
				createdAt: new Date(
					Date.now() -
						(REMIND_NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
				),
			});
			nudgeRepository.createRemindNudge.mockResolvedValue(
				mockRemindNudgeResult,
			);

			// When
			const result = await service.sendRemindNudge(defaultParams);

			// Then
			expect(result).toBeDefined();
		});

		it("메시지 없이도 보낼 수 있다", async () => {
			// Given
			const paramsNoMessage = {
				senderId: "sender-id",
				receiverId: "receiver-id",
			};
			followService.isMutualFriend.mockResolvedValue(true);
			nudgeRepository.countTodayTodos.mockResolvedValue(0);
			nudgeRepository.findLastRemindNudge.mockResolvedValue(null);
			nudgeRepository.createRemindNudge.mockResolvedValue({
				...mockRemindNudgeResult,
				message: null,
			});

			// When
			const result = await service.sendRemindNudge(paramsNoMessage);

			// Then
			expect(result).toBeDefined();
		});
	});

	describe("getRemindCooldownInfo", () => {
		it("기록이 없으면 쿨다운 비활성 상태를 반환한다", async () => {
			// Given
			nudgeRepository.findLastRemindNudge.mockResolvedValue(null);

			// When
			const result = await service.getRemindCooldownInfo(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
			expect(result.cooldownEndsAt).toBeNull();
		});

		it("쿨다운 기간 내이면 활성 상태를 반환한다", async () => {
			// Given
			nudgeRepository.findLastRemindNudge.mockResolvedValue({
				id: 1,
				senderId: "sender-id",
				receiverId: "receiver-id",
				message: null,
				createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30분 전
			});

			// When
			const result = await service.getRemindCooldownInfo(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.cooldownEndsAt).not.toBeNull();
		});

		it("쿨다운 기간이 지나면 비활성 상태를 반환한다", async () => {
			// Given
			nudgeRepository.findLastRemindNudge.mockResolvedValue({
				id: 1,
				senderId: "sender-id",
				receiverId: "receiver-id",
				message: null,
				createdAt: new Date(
					Date.now() -
						(REMIND_NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
				),
			});

			// When
			const result = await service.getRemindCooldownInfo(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
		});
	});

	describe("getReceivedNudges", () => {
		it("받은 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-1", "receiver-id", 1)
					.withId(1)
					.buildWithRelations(),
				NudgeBuilder.create("sender-2", "receiver-id", 2)
					.withId(2)
					.buildWithRelations(),
			];
			nudgeRepository.findReceivedNudges.mockResolvedValue(mockNudges);

			// When
			const result = await service.getReceivedNudges({
				userId: "receiver-id",
			});

			// Then
			expect(paginationService.normalizeCursorPagination).toHaveBeenCalled();
			expect(nudgeRepository.findReceivedNudges).toHaveBeenCalledWith({
				userId: "receiver-id",
				cursor: undefined,
				size: 20,
			});
			expect(
				paginationService.createCursorPaginatedResponse,
			).toHaveBeenCalled();
			expect(result.items).toBeDefined();
		});

		it("커서와 사이즈를 지정하여 조회한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-1", "receiver-id", 3)
					.withId(3)
					.buildWithRelations(),
			];
			nudgeRepository.findReceivedNudges.mockResolvedValue(mockNudges);
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 5,
				size: 10,
				take: 11,
			});

			// When
			await service.getReceivedNudges({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});

			// Then
			expect(nudgeRepository.findReceivedNudges).toHaveBeenCalledWith({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});
		});
	});

	describe("getSentNudges", () => {
		it("보낸 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-id", "receiver-1", 1)
					.withId(1)
					.buildWithRelations(),
				NudgeBuilder.create("sender-id", "receiver-2", 2)
					.withId(2)
					.buildWithRelations(),
			];
			nudgeRepository.findSentNudges.mockResolvedValue(mockNudges);

			// When
			const result = await service.getSentNudges({
				userId: "sender-id",
			});

			// Then
			expect(nudgeRepository.findSentNudges).toHaveBeenCalledWith({
				userId: "sender-id",
				cursor: undefined,
				size: 20,
			});
			expect(result.items).toBeDefined();
		});
	});

	describe("getLimitInfo", () => {
		it("FREE 사용자의 제한 정보를 조회한다", async () => {
			// Given
			entitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(1);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT);
			expect(result.used).toBe(1);
			expect(result.remaining).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT - 1);
		});

		it("ACTIVE 사용자는 무제한이다", async () => {
			// Given
			entitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(100);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBeNull();
			expect(result.used).toBe(100);
			expect(result.remaining).toBeNull();
		});

		it("ADMIN은 구독 상태와 무관하게 무제한이다", async () => {
			// Given
			entitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(100);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBeNull();
			expect(result.used).toBe(100);
			expect(result.remaining).toBeNull();
		});

		it("EXPIRED 사용자는 FREE 제한이 적용된다", async () => {
			// Given
			entitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "EXPIRED",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(2);

			// When
			const result = await service.getLimitInfo("user-id");

			// Then
			expect(result.dailyLimit).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT);
			expect(result.remaining).toBe(NUDGE_LIMITS.FREE_DAILY_LIMIT - 2);
		});

		it("EntitlementService에 올바른 Feature를 전달한다", async () => {
			// Given
			entitlementService.getFeatureLimit.mockResolvedValue({
				dailyLimit: NUDGE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
			nudgeRepository.countTodayNudges.mockResolvedValue(0);

			// When
			await service.getLimitInfo("user-id");

			// Then
			expect(entitlementService.getFeatureLimit).toHaveBeenCalledWith(
				"user-id",
				Feature.NUDGE,
			);
		});
	});

	describe("getCooldownInfoForTodo", () => {
		it("Nudge 기록이 없으면 쿨다운 비활성 상태를 반환한다", async () => {
			// Given
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
			expect(result.cooldownEndsAt).toBeNull();
		});

		it("쿨다운 기간 내이면 활성 상태를 반환한다", async () => {
			// Given
			const recentNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withCreatedAt(new Date(Date.now() - 30 * 60 * 1000)) // 30분 전
				.build();
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(recentNudge);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.cooldownEndsAt).not.toBeNull();
		});

		it("쿨다운 기간이 지나면 비활성 상태를 반환한다", async () => {
			// Given
			const oldNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withCreatedAt(
					new Date(
						Date.now() - (NUDGE_LIMITS.COOLDOWN_HOURS + 1) * 60 * 60 * 1000,
					),
				)
				.build();
			nudgeRepository.findLastNudgeForTodo.mockResolvedValue(oldNudge);

			// When
			const result = await service.getCooldownInfoForTodo("sender-id", 100);

			// Then
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
		});
	});

	describe("getCooldownInfoForUser", () => {
		it("특정 사용자에 대한 쿨다운 정보를 조회한다", async () => {
			// Given
			nudgeRepository.findLastNudgeToUser.mockResolvedValue(null);

			// When
			const result = await service.getCooldownInfoForUser(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(nudgeRepository.findLastNudgeToUser).toHaveBeenCalledWith(
				"sender-id",
				"receiver-id",
			);
			expect(result.isActive).toBe(false);
		});
	});

	describe("markAsRead", () => {
		it("Nudge를 읽음 처리한다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create("sender-id", "user-id", 100)
				.withId(1)
				.build();
			nudgeRepository.findById.mockResolvedValue(mockNudge);

			const readNudge = NudgeBuilder.create("sender-id", "user-id", 100)
				.withId(1)
				.asRead()
				.build();
			nudgeRepository.markAsRead.mockResolvedValue(readNudge);

			// When
			await service.markAsRead("user-id", 1);

			// Then
			expect(nudgeRepository.findById).toHaveBeenCalledWith(1);
			expect(nudgeRepository.markAsRead).toHaveBeenCalledWith(1);
		});

		it("존재하지 않는 Nudge는 에러를 발생시킨다", async () => {
			// Given
			nudgeRepository.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.markAsRead("user-id", 999)).rejects.toThrow();
		});

		it("본인이 받지 않은 Nudge는 에러를 발생시킨다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create("sender-id", "other-user-id", 100)
				.withId(1)
				.build();
			nudgeRepository.findById.mockResolvedValue(mockNudge);

			// When & Then
			await expect(service.markAsRead("user-id", 1)).rejects.toThrow();
		});

		it("이미 읽은 Nudge는 무시한다", async () => {
			// Given
			const readNudge = NudgeBuilder.create("sender-id", "user-id", 100)
				.withId(1)
				.asRead()
				.build();
			nudgeRepository.findById.mockResolvedValue(readNudge);

			// When
			await service.markAsRead("user-id", 1);

			// Then
			expect(nudgeRepository.markAsRead).not.toHaveBeenCalled();
		});
	});
});
