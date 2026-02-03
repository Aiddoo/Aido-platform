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
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { UserConsentRepository } from "@/modules/auth/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/modules/auth/repositories/user-preference.repository";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { PUSH_PROVIDER } from "./providers";
import type { PushProvider } from "./providers/push-provider.interface";
import type { CreateNotificationData } from "./types/notification.types";

// jest.mock으로 모듈 전체 모킹
jest.mock("./utils/night-time.util", () => ({
	isNightTime: jest.fn(() => false),
	isDayTime: jest.fn(() => true),
	getKstHour: jest.fn(() => 12),
}));

// 모킹된 모듈 import
import * as timeUtils from "./utils/night-time.util";

describe("NotificationService", () => {
	let service: NotificationService;
	let notificationRepo: Mocked<NotificationRepository>;
	let paginationService: Mocked<PaginationService>;
	let pushProvider: Mocked<PushProvider>;
	let userPreferenceRepo: Mocked<UserPreferenceRepository>;
	let userConsentRepo: Mocked<UserConsentRepository>;

	// 테스트 데이터
	const mockUserId = "user-1";

	beforeEach(async () => {
		// 야간 시간 mock 초기화 (기본값: 낮 시간)
		(timeUtils.isNightTime as jest.Mock).mockReturnValue(false);

		// Builder ID 카운터 리셋
		NotificationBuilder.resetIdCounter();
		PushTokenBuilder.resetIdCounter();
		UserPreferenceBuilder.resetIdCounter();

		// PushProvider mock 객체 생성 (테스트에서 직접 참조하기 위해 별도 변수로 관리)
		const mockPushProviderImpl = {
			name: "expo",
			validateToken: jest.fn().mockReturnValue(true),
			send: jest.fn(),
			sendBatch: jest.fn().mockResolvedValue({
				total: 1,
				successCount: 1,
				failureCount: 0,
				results: [{ success: true, ticketId: "ticket-1" }],
				invalidTokens: [],
			}),
		};

		// Suites가 모든 의존성을 자동으로 mock (PUSH_PROVIDER는 impl()로 수동 설정)
		const { unit, unitRef } = await TestBed.solitary(NotificationService)
			.mock(PUSH_PROVIDER)
			.impl(() => mockPushProviderImpl)
			.compile();

		service = unit;
		notificationRepo = unitRef.get(
			NotificationRepository,
		) as unknown as Mocked<NotificationRepository>;
		paginationService = unitRef.get(
			PaginationService,
		) as unknown as Mocked<PaginationService>;
		pushProvider = mockPushProviderImpl as unknown as Mocked<PushProvider>;
		userPreferenceRepo = unitRef.get(
			UserPreferenceRepository,
		) as unknown as Mocked<UserPreferenceRepository>;
		userConsentRepo = unitRef.get(
			UserConsentRepository,
		) as unknown as Mocked<UserConsentRepository>;

		// PaginationService 기본 동작 설정
		paginationService.normalizeCursorPagination.mockReturnValue({
			cursor: undefined,
			size: 20,
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			(params) => {
				const { items, size } = params;
				const hasNext = items.length > size;
				const actualItems = hasNext ? items.slice(0, size) : items;
				const nextCursor =
					hasNext && actualItems.length > 0
						? actualItems[actualItems.length - 1].id
						: null;
				return {
					items: actualItems,
					pagination: {
						hasNext,
						nextCursor,
					},
				};
			},
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// ==========================================================================
	// 푸시 토큰 관리 테스트
	// ==========================================================================

	describe("registerPushToken", () => {
		it("유효한 토큰을 등록해야 한다", async () => {
			// Given - 유효한 Expo 푸시 토큰 데이터 준비
			const data = {
				userId: mockUserId,
				token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
				deviceId: "device-1",
				platform: "IOS" as const,
			};
			const expectedToken = PushTokenBuilder.create(mockUserId)
				.withToken(data.token)
				.withDeviceId(data.deviceId)
				.asIos()
				.build();
			notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

			// When - 푸시 토큰 등록 요청
			const result = await service.registerPushToken(data);

			// Then - 토큰 검증 및 저장 확인
			expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
			expect(notificationRepo.registerPushToken).toHaveBeenCalledWith(data);
			expect(result).toEqual(expectedToken);
		});

		it("유효하지 않은 토큰이면 예외를 던져야 한다", async () => {
			// Given - 유효하지 않은 토큰 형식
			const data = {
				userId: mockUserId,
				token: "invalid-token",
				deviceId: "device-1",
			};
			pushProvider.validateToken.mockReturnValue(false);

			// When & Then - 유효성 검사 실패로 예외 발생
			await expect(service.registerPushToken(data)).rejects.toThrow(
				BusinessException,
			);
			expect(notificationRepo.registerPushToken).not.toHaveBeenCalled();
		});
	});

	describe("unregisterPushToken", () => {
		it("푸시 토큰을 삭제해야 한다", async () => {
			// Given - 삭제할 푸시 토큰 존재
			const pushToken = PushTokenBuilder.create(mockUserId).build();
			notificationRepo.deletePushToken.mockResolvedValue(pushToken);

			// When - 푸시 토큰 삭제 요청
			await service.unregisterPushToken(mockUserId, "device-1");

			// Then - 삭제 메서드 호출 확인
			expect(notificationRepo.deletePushToken).toHaveBeenCalledWith(
				mockUserId,
				"device-1",
			);
		});

		it("토큰이 없어도 예외를 던지지 않아야 한다", async () => {
			// Given - 토큰이 존재하지 않는 상황
			notificationRepo.deletePushToken.mockRejectedValue(
				new Error("Not found"),
			);

			// When & Then - 예외 없이 정상 처리
			await expect(
				service.unregisterPushToken(mockUserId, "device-1"),
			).resolves.not.toThrow();
		});
	});

	describe("unregisterAllPushTokens", () => {
		it("사용자의 모든 푸시 토큰을 삭제해야 한다", async () => {
			// Given - 사용자가 여러 디바이스에 토큰 보유
			notificationRepo.deleteAllPushTokensByUser.mockResolvedValue({
				count: 3,
			});

			// When - 모든 푸시 토큰 삭제 요청
			await service.unregisterAllPushTokens(mockUserId);

			// Then - 전체 삭제 메서드 호출 확인
			expect(notificationRepo.deleteAllPushTokensByUser).toHaveBeenCalledWith(
				mockUserId,
			);
		});
	});

	// ==========================================================================
	// 알림 생성 및 발송 테스트
	// ==========================================================================

	describe("createAndSend", () => {
		it("알림을 생성하고 푸시를 발송해야 한다", async () => {
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
			const pushToken = PushTokenBuilder.create(mockUserId).build();
			const preference = UserPreferenceBuilder.create(mockUserId)
				.withPushEnabled()
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);
			notificationRepo.findPushTokensByUser.mockResolvedValue([pushToken]);
			userPreferenceRepo.findByUserId.mockResolvedValue(preference);

			// When - 알림 생성 및 푸시 발송 요청
			const result = await service.createAndSend(data);

			// Then - 알림 생성 확인 및 비동기 푸시 발송 검증
			expect(notificationRepo.createNotification).toHaveBeenCalledWith(data);
			expect(result).toEqual(notification);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(notificationRepo.findPushTokensByUser).toHaveBeenCalledWith({
				userId: mockUserId,
				activeOnly: true,
			});
		});

		it("푸시 발송 실패해도 알림 생성은 성공해야 한다", async () => {
			// Given - 푸시 발송이 실패하는 상황
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "새로운 친구 요청",
				body: "홍길동님이 친구가 되고 싶어해요",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();
			const preference = UserPreferenceBuilder.create(mockUserId)
				.withPushEnabled()
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);
			notificationRepo.findPushTokensByUser.mockRejectedValue(
				new Error("Push failed"),
			);
			userPreferenceRepo.findByUserId.mockResolvedValue(preference);

			// When - 알림 생성 요청
			const result = await service.createAndSend(data);

			// Then - 푸시 실패와 무관하게 알림 생성 성공
			expect(result).toEqual(notification);
		});
	});

	describe("createAndSendBatch", () => {
		it("여러 알림을 일괄 생성하고 푸시를 발송해야 한다", async () => {
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
			const tokens = [
				PushTokenBuilder.create("user-1").build(),
				PushTokenBuilder.create("user-2").build(),
			];

			notificationRepo.createManyNotifications.mockResolvedValue({ count: 2 });
			notificationRepo.findActivePushTokensByUsers.mockResolvedValue(tokens);
			// 두 사용자 모두 푸시 활성화 (배치 조회)
			userPreferenceRepo.findByUserIds.mockResolvedValue([
				UserPreferenceBuilder.create("user-1").withPushEnabled().build(),
				UserPreferenceBuilder.create("user-2").withPushEnabled().build(),
			]);
			userConsentRepo.findByUserIds.mockResolvedValue([]);

			// When - 일괄 알림 생성 및 발송 요청
			const result = await service.createAndSendBatch(dataList);

			// Then - 일괄 생성 및 비동기 푸시 발송 확인
			expect(notificationRepo.createManyNotifications).toHaveBeenCalledWith(
				dataList,
			);
			expect(result.count).toBe(2);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(notificationRepo.findActivePushTokensByUsers).toHaveBeenCalledWith(
				["user-1", "user-2"],
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
			expect(notificationRepo.findPushTokensByUser).not.toHaveBeenCalled();
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
	});

	describe("getUnreadCount", () => {
		it("읽지 않은 알림 수를 반환해야 한다", async () => {
			// Given - 읽지 않은 알림 5개 존재
			notificationRepo.countUnread.mockResolvedValue(5);

			// When - 읽지 않은 알림 수 조회
			const result = await service.getUnreadCount(mockUserId);

			// Then - 개수 반환 확인
			expect(notificationRepo.countUnread).toHaveBeenCalledWith(mockUserId);
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
	// 푸시 발송 (Private 메서드 간접 테스트)
	// ==========================================================================

	describe("sendPushToUser (간접 테스트)", () => {
		it("활성 토큰이 없으면 푸시를 발송하지 않아야 한다", async () => {
			// Given - 활성 토큰이 없는 사용자
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "테스트",
				body: "테스트 알림",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();
			const preference = UserPreferenceBuilder.create(mockUserId)
				.withPushEnabled()
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);
			notificationRepo.findPushTokensByUser.mockResolvedValue([]);
			userPreferenceRepo.findByUserId.mockResolvedValue(preference);

			// When - 알림 생성 및 푸시 발송 시도
			await service.createAndSend(data);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Then - 푸시 발송 시도하지 않음
			expect(pushProvider.sendBatch).not.toHaveBeenCalled();
		});

		it("잘못된 토큰을 비활성화해야 한다", async () => {
			// Given - 유효하지 않은 토큰으로 푸시 발송 실패
			const data: CreateNotificationData = {
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "테스트",
				body: "테스트 알림",
			};
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();
			const pushToken = PushTokenBuilder.create(mockUserId).build();
			const preference = UserPreferenceBuilder.create(mockUserId)
				.withPushEnabled()
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);
			notificationRepo.findPushTokensByUser.mockResolvedValue([pushToken]);
			userPreferenceRepo.findByUserId.mockResolvedValue(preference);
			pushProvider.sendBatch.mockResolvedValue({
				total: 1,
				successCount: 0,
				failureCount: 1,
				results: [
					{
						success: false,
						error: "DeviceNotRegistered",
						errorCode: "DeviceNotRegistered",
					},
				],
				invalidTokens: [pushToken.token],
			});
			notificationRepo.deactivateInvalidTokens.mockResolvedValue({ count: 1 });

			// When - 알림 생성 및 푸시 발송 시도
			await service.createAndSend(data);

			// 비동기 푸시 발송 대기
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Then - 유효하지 않은 토큰 비활성화 확인
			expect(notificationRepo.deactivateInvalidTokens).toHaveBeenCalledWith([
				pushToken.token,
			]);
		});
	});
});
