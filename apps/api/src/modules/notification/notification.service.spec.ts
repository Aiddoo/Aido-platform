/**
 * NotificationService 단위 테스트 (Suites + Builder + GWT 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - Given/When/Then 패턴으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 * @see https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	NotificationBuilder,
	PushTokenBuilder,
	UserPreferenceBuilder,
} from "@test/builders";
import { CacheService } from "@/common/cache/cache.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { ILockProvider } from "@/common/lock";
import { LOCK_PROVIDER } from "@/common/lock";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { Prisma } from "@/generated/prisma/client";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { PushDeliveryService } from "./push-delivery.service";
import type { CreateNotificationData } from "./types/notification.types";

describe("NotificationService", () => {
	let service: NotificationService;
	let notificationRepo: Mocked<NotificationRepository>;
	let paginationService: Mocked<PaginationService>;
	let pushDeliveryService: Mocked<PushDeliveryService>;
	let cacheService: Mocked<CacheService>;
	let lockProvider: Mocked<ILockProvider>;

	// 테스트 데이터
	const mockUserId = "user-1";

	beforeEach(async () => {
		// Builder ID 카운터 리셋
		NotificationBuilder.resetIdCounter();
		PushTokenBuilder.resetIdCounter();
		UserPreferenceBuilder.resetIdCounter();

		const mockLockProvider: ILockProvider = {
			acquire: jest.fn(),
			isLocked: jest.fn(),
		};

		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(NotificationService)
			.mock(LOCK_PROVIDER)
			.impl(() => mockLockProvider)
			.compile();

		service = unit;
		notificationRepo = unitRef.get(NotificationRepository);
		paginationService = unitRef.get(PaginationService);
		pushDeliveryService = unitRef.get(PushDeliveryService);
		cacheService = unitRef.get(CacheService);
		lockProvider = unitRef.get(LOCK_PROVIDER);

		// 기본: Lock 획득 성공 (release 함수 반환)
		lockProvider.acquire.mockResolvedValue(jest.fn());

		// CacheService.wrapUnreadCount — factory 실행 패스스루
		cacheService.wrapUnreadCount.mockImplementation((_userId, factory) =>
			factory(),
		);

		// PaginationService 기본 동작 설정
		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: undefined,
			size: 20,
			take: 21,
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			(params) => {
				const { items, size } = params;
				const hasNext = items.length > size;
				const actualItems = hasNext ? items.slice(0, size) : items;
				const nextCursor =
					hasNext && actualItems.length > 0
						? (actualItems[actualItems.length - 1]?.id ?? null)
						: null;
				return {
					items: actualItems,
					pagination: {
						hasNext,
						nextCursor,
						size,
					},
				};
			},
		);

		// PushDeliveryService 기본 동작 설정
		pushDeliveryService.shouldSendPush.mockResolvedValue(true);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// ==========================================================================
	// 알림 생성 및 발송 테스트
	// ==========================================================================

	describe("createAndSend", () => {
		it("알림을 생성하고 푸시 발송을 위임해야 한다", async () => {
			// Given - 알림 생성 데이터 및 푸시 발송 환경 준비
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
				friendId: "friend-1",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);

			// When - 알림 생성 및 푸시 발송 요청
			const result = await service.createAndSend(data);

			// Then - 알림 생성 및 푸시 위임 확인
			expect(notificationRepo.createNotification).toHaveBeenCalledWith(
				data,
				undefined,
			);
			expect(result).toEqual(notification);
			expect(pushDeliveryService.fireAndForgetPush).toHaveBeenCalledWith(
				data,
				notification.id,
			);
		});

		it("푸시 설정이 꺼져있으면 푸시를 발송하지 않아야 한다", async () => {
			// Given - 푸시 비활성화
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);
			pushDeliveryService.shouldSendPush.mockResolvedValue(false);

			// When - 알림 생성 요청
			const result = await service.createAndSend(data);

			// Then - 알림 생성만 되고 푸시는 발송되지 않음
			expect(result).toEqual(notification);
			expect(pushDeliveryService.fireAndForgetPush).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 위반 시 null을 반환하고 크래시하지 않아야 한다", async () => {
			// Given - DB unique constraint violation (partial index 중복 방지)
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "TODO_REMINDER",
				title: "리마인더",
				body: "할일 마감 임박",
				todoId: 1,
				metadata: { stage: "60min" },
			};

			notificationRepo.createNotification.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					clientVersion: "5.0.0",
				}),
			);

			// When - 중복 알림 생성 시도
			const result = await service.createAndSend(data);

			// Then - null 반환, 에러 미발생
			expect(result).toBeNull();
			expect(pushDeliveryService.shouldSendPush).not.toHaveBeenCalled();
			expect(pushDeliveryService.fireAndForgetPush).not.toHaveBeenCalled();
		});

		it("P2002 외의 Prisma 에러는 그대로 throw해야 한다", async () => {
			// Given - P2025 (record not found) 등 다른 Prisma 에러
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "팔로우",
				body: "새 팔로워",
			};

			notificationRepo.createNotification.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Not found", {
					code: "P2025",
					clientVersion: "5.0.0",
				}),
			);

			// When & Then - 에러가 그대로 throw됨
			await expect(service.createAndSend(data)).rejects.toThrow();
		});
	});

	describe("createAndSendBatch", () => {
		it("여러 알림을 일괄 생성하고 배치 푸시를 위임해야 한다", async () => {
			// Given - 여러 사용자에게 알림 발송 데이터 준비
			const dataList: CreateNotificationData[] = [
				{
					userId: "user-1",
					type: "MORNING_REMINDER",
					title: "좋은 아침이에요!",
					body: "오늘 3개의 할일이 기다리고 있어요",
				},
				{
					userId: "user-2",
					type: "MORNING_REMINDER",
					title: "좋은 아침이에요!",
					body: "오늘 5개의 할일이 기다리고 있어요",
				},
			];

			notificationRepo.createManyNotifications.mockResolvedValue({ count: 2 });

			// When - 일괄 알림 생성 및 발송 요청
			const result = await service.createAndSendBatch(dataList);

			// Then - 일괄 생성 및 배치 푸시 위임 확인
			expect(notificationRepo.createManyNotifications).toHaveBeenCalledWith(
				dataList,
				undefined,
			);
			expect(result.count).toBe(2);
			expect(pushDeliveryService.fireAndForgetBatchPush).toHaveBeenCalledWith(
				dataList,
			);
		});

		it("빈 목록이면 아무 작업도 하지 않아야 한다", async () => {
			// Given - 빈 알림 목록

			// When - 빈 목록으로 일괄 생성 요청
			const result = await service.createAndSendBatch([]);

			// Then - 아무 작업도 수행하지 않음
			expect(result.count).toBe(0);
			expect(notificationRepo.createManyNotifications).not.toHaveBeenCalled();
		});
	});

	describe("createOnly", () => {
		it("알림만 생성하고 푸시는 발송하지 않아야 한다", async () => {
			// Given - 푸시 없이 알림만 생성할 데이터
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "서비스 점검 예정",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asSystemNotice()
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);

			// When - 알림만 생성 요청
			const result = await service.createOnly(data);

			// Then - 알림 생성만 되고 푸시는 발송되지 않음
			expect(notificationRepo.createNotification).toHaveBeenCalledWith(data);
			expect(result).toEqual(notification);
			expect(pushDeliveryService.fireAndForgetPush).not.toHaveBeenCalled();
		});
	});

	// ==========================================================================
	// 알림 조회 테스트
	// ==========================================================================

	describe("getNotifications", () => {
		it("알림 목록을 페이지네이션으로 조회해야 한다", async () => {
			// Given - 페이지네이션 조회 조건
			const notifications = [
				NotificationBuilder.create(mockUserId).withId(1).build(),
				NotificationBuilder.create(mockUserId).withId(2).build(),
			];
			notificationRepo.findNotificationsByUser.mockResolvedValue(notifications);

			// When - 알림 목록 조회 요청
			const result = await service.getNotifications({
				userId: mockUserId,
				size: 20,
			});

			// Then - 페이지네이션 정규화 및 조회 확인
			expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
				cursor: undefined,
				size: 20,
			});
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith({
				userId: mockUserId,
				cursor: undefined,
				size: 20,
				unreadOnly: undefined,
			});
			expect(result.items).toHaveLength(2);
		});

		it("읽지 않은 알림만 필터링해야 한다", async () => {
			// Given - 읽지 않은 알림만 조회 조건
			const notifications = [
				NotificationBuilder.create(mockUserId).asUnread().build(),
			];
			notificationRepo.findNotificationsByUser.mockResolvedValue(notifications);

			// When - 읽지 않은 알림만 조회 요청
			await service.getNotifications({
				userId: mockUserId,
				unreadOnly: true,
			});

			// Then - unreadOnly 필터 적용 확인
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					unreadOnly: true,
				}),
			);
		});

		it("커서 기반 페이지네이션을 적용해야 한다", async () => {
			// Given - 커서 기반 페이지네이션 조건
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 5,
				size: 20,
				take: 21,
			});
			const notifications = [
				NotificationBuilder.create(mockUserId).withId(4).build(),
			];
			notificationRepo.findNotificationsByUser.mockResolvedValue(notifications);

			// When - 커서 기반 조회 요청
			await service.getNotifications({
				userId: mockUserId,
				cursor: 5,
				size: 20,
			});

			// Then - 커서 적용 확인
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: 5,
				}),
			);
		});

		it("category가 'SOCIAL'이면 소셜 타입 배열을 Repository에 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				category: "SOCIAL",
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					types: expect.arrayContaining([
						"FOLLOW_NEW",
						"FOLLOW_ACCEPTED",
						"NUDGE_RECEIVED",
						"CHEER_RECEIVED",
						"FRIEND_COMPLETED",
					]),
				}),
			);
		});

		it("category가 'NOTICE'이면 공지 타입 배열을 Repository에 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				category: "NOTICE",
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					types: expect.arrayContaining([
						"SYSTEM_NOTICE",
						"ADMIN_BROADCAST",
						"ADMIN_TARGETED",
					]),
				}),
			);
		});

		it("category가 'TODO'이면 할일 타입 배열을 Repository에 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				category: "TODO",
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					types: expect.arrayContaining([
						"TODO_REMINDER",
						"TODO_SHARED",
						"DAILY_COMPLETE",
						"MORNING_REMINDER",
						"EVENING_REMINDER",
					]),
				}),
			);
		});

		it("category가 'ALL'이면 types를 undefined로 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				category: "ALL",
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					types: undefined,
				}),
			);
		});

		it("category가 미지정이면 types를 undefined로 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					types: undefined,
				}),
			);
		});

		it("category + cursor 조합: SOCIAL 카테고리와 cursor를 동시에 전달해야 한다", async () => {
			// Given
			paginationService.normalizeCursorPagination.mockReturnValue({
				cursor: 10,
				size: 20,
				take: 21,
			});
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				cursor: 10,
				size: 20,
				category: "SOCIAL",
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					cursor: 10,
					types: expect.arrayContaining([
						"FOLLOW_NEW",
						"FOLLOW_ACCEPTED",
						"NUDGE_RECEIVED",
						"CHEER_RECEIVED",
						"FRIEND_COMPLETED",
					]),
				}),
			);
		});

		it("category + unreadOnly 조합: NOTICE + unreadOnly=true를 동시에 전달해야 한다", async () => {
			// Given
			notificationRepo.findNotificationsByUser.mockResolvedValue([]);

			// When
			await service.getNotifications({
				userId: mockUserId,
				category: "NOTICE",
				unreadOnly: true,
			});

			// Then
			expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
				expect.objectContaining({
					unreadOnly: true,
					types: expect.arrayContaining([
						"SYSTEM_NOTICE",
						"ADMIN_BROADCAST",
						"ADMIN_TARGETED",
					]),
				}),
			);
		});
	});

	describe("getUnreadCount", () => {
		it("캐시를 통해 읽지 않은 알림 수를 반환해야 한다", async () => {
			// Given - 읽지 않은 알림 5개 존재
			notificationRepo.countUnread.mockResolvedValue(5);

			// When - 읽지 않은 알림 수 조회
			const result = await service.getUnreadCount(mockUserId);

			// Then - CacheService.wrapUnreadCount를 통해 조회
			expect(cacheService.wrapUnreadCount).toHaveBeenCalledWith(
				mockUserId,
				expect.any(Function),
			);
			expect(result).toBe(5);
		});
	});

	// ==========================================================================
	// 읽음 처리 테스트
	// ==========================================================================

	describe("markAsRead", () => {
		it("알림을 읽음 처리해야 한다", async () => {
			// Given - 읽지 않은 알림 존재
			const notification = NotificationBuilder.create(mockUserId)
				.withId(1)
				.asUnread()
				.build();
			const readNotification = NotificationBuilder.create(mockUserId)
				.withId(1)
				.asRead()
				.build();
			notificationRepo.findNotificationById.mockResolvedValue(notification);
			notificationRepo.markAsRead.mockResolvedValue(readNotification);

			// When - 읽음 처리 요청
			await service.markAsRead(mockUserId, 1);

			// Then - 읽음 처리 확인
			expect(notificationRepo.findNotificationById).toHaveBeenCalledWith(1);
			expect(notificationRepo.markAsRead).toHaveBeenCalledWith(1);
		});

		it("알림이 없으면 예외를 던져야 한다", async () => {
			// Given - 존재하지 않는 알림 ID
			notificationRepo.findNotificationById.mockResolvedValue(null);

			// When & Then - 예외 발생 확인
			await expect(service.markAsRead(mockUserId, 999)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 알림이면 예외를 던져야 한다", async () => {
			// Given - 다른 사용자의 알림
			const notification = NotificationBuilder.create("other-user")
				.withId(1)
				.build();
			notificationRepo.findNotificationById.mockResolvedValue(notification);

			// When & Then - 권한 없음 예외 발생
			await expect(service.markAsRead(mockUserId, 1)).rejects.toThrow(
				BusinessException,
			);
			expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
		});

		it("이미 읽은 알림이면 아무 작업도 하지 않아야 한다", async () => {
			// Given - 이미 읽은 알림
			const notification = NotificationBuilder.create(mockUserId)
				.withId(1)
				.asRead()
				.build();
			notificationRepo.findNotificationById.mockResolvedValue(notification);

			// When - 읽음 처리 요청
			await service.markAsRead(mockUserId, 1);

			// Then - 중복 처리하지 않음
			expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
		});
	});

	describe("markAllAsRead", () => {
		it("모든 알림을 읽음 처리해야 한다", async () => {
			// Given - 읽지 않은 알림 5개 존재
			notificationRepo.markAllAsRead.mockResolvedValue({ count: 5 });

			// When - 전체 읽음 처리 요청
			const result = await service.markAllAsRead(mockUserId);

			// Then - 전체 읽음 처리 확인
			expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith(mockUserId);
			expect(result.count).toBe(5);
		});
	});

	// ==========================================================================
	// 관리 기능 테스트
	// ==========================================================================

	describe("cleanupOldNotifications", () => {
		it("90일 이상 된 알림을 삭제해야 한다", async () => {
			// Given - 오래된 알림 10개 존재
			notificationRepo.deleteOldNotifications.mockResolvedValue({ count: 10 });

			// When - 기본 정리 요청 (90일)
			const result = await service.cleanupOldNotifications();

			// Then - 90일 기준 삭제 확인
			expect(notificationRepo.deleteOldNotifications).toHaveBeenCalledWith(90);
			expect(result.count).toBe(10);
		});

		it("지정된 일수 이상 된 알림을 삭제해야 한다", async () => {
			// Given - 30일 이상 된 알림 5개 존재
			notificationRepo.deleteOldNotifications.mockResolvedValue({ count: 5 });

			// When - 30일 기준 정리 요청
			const result = await service.cleanupOldNotifications(30);

			// Then - 30일 기준 삭제 확인
			expect(notificationRepo.deleteOldNotifications).toHaveBeenCalledWith(30);
			expect(result.count).toBe(5);
		});
	});

	// ==========================================================================
	// createAndSendWithDedup 테스트
	// ==========================================================================

	describe("createAndSendWithDedup", () => {
		const baseSetup = () => {
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);

			return { notification };
		};

		it("NUDGE_RECEIVED: 1시간 내 같은 friendId 알림이 있으면 null을 반환한다", async () => {
			// Given
			notificationRepo.existsRecentNotification.mockResolvedValue(true);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "콕!",
				body: "친구가 콕 찔렀어요",
				friendId: "friend-1",
				nudgeId: 1,
			});

			// Then
			expect(result).toBeNull();
			expect(notificationRepo.existsRecentNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					type: "NUDGE_RECEIVED",
					friendId: "friend-1",
				}),
				undefined,
			);
			expect(notificationRepo.createNotification).not.toHaveBeenCalled();
		});

		it("NUDGE_RECEIVED: 1시간 내 같은 friendId 알림이 없으면 정상 생성한다", async () => {
			// Given
			baseSetup();
			notificationRepo.existsRecentNotification.mockResolvedValue(false);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "콕!",
				body: "친구가 콕 찔렀어요",
				friendId: "friend-1",
				nudgeId: 1,
			});

			// Then
			expect(result).not.toBeNull();
			expect(notificationRepo.createNotification).toHaveBeenCalled();
		});

		it("CHEER_RECEIVED: 5분 내 같은 friendId 알림이 있으면 null을 반환한다", async () => {
			// Given
			notificationRepo.existsRecentNotification.mockResolvedValue(true);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "CHEER_RECEIVED",
				title: "응원!",
				body: "친구가 응원해요",
				friendId: "friend-1",
				cheerId: 1,
			});

			// Then
			expect(result).toBeNull();
		});

		it("FOLLOW_NEW: 24시간 내 같은 friendId 알림이 있으면 null을 반환한다", async () => {
			// Given
			notificationRepo.existsRecentNotification.mockResolvedValue(true);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "팔로우",
				body: "새로운 팔로워",
				friendId: "friend-1",
			});

			// Then
			expect(result).toBeNull();
		});

		it("FOLLOW_ACCEPTED: 24시간 내 같은 friendId 알림이 있으면 null을 반환한다", async () => {
			// Given
			notificationRepo.existsRecentNotification.mockResolvedValue(true);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "FOLLOW_ACCEPTED",
				title: "맞팔로우",
				body: "친구가 되었어요",
				friendId: "friend-1",
			});

			// Then
			expect(result).toBeNull();
		});

		it("전략이 없는 타입(SYSTEM_NOTICE)은 dedup 체크 없이 바로 생성한다", async () => {
			// Given
			baseSetup();

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "SYSTEM_NOTICE",
				title: "시스템 공지",
				body: "점검 안내",
			});

			// Then
			expect(result).not.toBeNull();
			expect(notificationRepo.existsRecentNotification).not.toHaveBeenCalled();
			expect(notificationRepo.createNotification).toHaveBeenCalled();
		});

		it("전략이 없는 타입(DAILY_COMPLETE)은 dedup 체크 없이 바로 생성한다", async () => {
			// Given
			baseSetup();

			// When
			await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "DAILY_COMPLETE",
				title: "완료!",
				body: "오늘 할일 다 끝냈어요",
				notificationDate: new Date("2026-02-15"),
			});

			// Then
			expect(notificationRepo.existsRecentNotification).not.toHaveBeenCalled();
			expect(notificationRepo.createNotification).toHaveBeenCalled();
		});

		it("중복 스킵 시 since 시간이 전략의 windowMs를 기준으로 계산된다", async () => {
			// Given
			notificationRepo.existsRecentNotification.mockResolvedValue(false);
			baseSetup();

			// When
			const before = Date.now();
			await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "콕!",
				body: "찔러요",
				friendId: "friend-1",
			});

			// Then — since가 현재 - 1시간 (NUDGE windowMs = MS_PER_HOUR)
			const calledSince = notificationRepo.existsRecentNotification.mock
				.calls[0]?.[0]?.since as Date;
			expect(calledSince).toBeInstanceOf(Date);
			const expectedMs = before - 3_600_000;
			expect(Math.abs(calledSince.getTime() - expectedMs)).toBeLessThan(100);
		});

		// ======================================================================
		// 잠금(Lock) 관련 테스트
		// ======================================================================

		it("dedup 처리 시 잠금을 획득하고 해제해야 한다", async () => {
			// Given
			const mockRelease = jest.fn().mockResolvedValue(undefined);
			lockProvider.acquire.mockResolvedValue(mockRelease);
			notificationRepo.existsRecentNotification.mockResolvedValue(false);
			baseSetup();

			// When
			await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "콕!",
				body: "찔러요",
				friendId: "friend-1",
			});

			// Then
			expect(lockProvider.acquire).toHaveBeenCalledWith(
				expect.stringContaining("dedup:user-1:NUDGE_RECEIVED"),
				5000,
			);
			expect(mockRelease).toHaveBeenCalled();
		});

		it("잠금 획득 실패 시 null을 반환하고 DB 조회를 하지 않아야 한다", async () => {
			// Given
			lockProvider.acquire.mockResolvedValue(null);

			// When
			const result = await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "NUDGE_RECEIVED",
				title: "콕!",
				body: "찔러요",
				friendId: "friend-1",
			});

			// Then
			expect(result).toBeNull();
			expect(notificationRepo.existsRecentNotification).not.toHaveBeenCalled();
			expect(notificationRepo.createNotification).not.toHaveBeenCalled();
		});

		it("DB 조회 실패 시에도 잠금이 해제되어야 한다", async () => {
			// Given
			const mockRelease = jest.fn().mockResolvedValue(undefined);
			lockProvider.acquire.mockResolvedValue(mockRelease);
			notificationRepo.existsRecentNotification.mockRejectedValue(
				new Error("DB error"),
			);

			// When & Then
			await expect(
				service.createAndSendWithDedup({
					userId: mockUserId,
					type: "NUDGE_RECEIVED",
					title: "콕!",
					body: "찔러요",
					friendId: "friend-1",
				}),
			).rejects.toThrow("DB error");
			expect(mockRelease).toHaveBeenCalled();
		});

		it("전략이 없는 타입은 잠금을 획득하지 않아야 한다", async () => {
			// Given
			baseSetup();

			// When
			await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "SYSTEM_NOTICE",
				title: "공지",
				body: "점검",
			});

			// Then
			expect(lockProvider.acquire).not.toHaveBeenCalled();
		});
	});
});
