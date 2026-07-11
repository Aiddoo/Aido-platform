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
import { NotificationBuilder } from "@test/builders";
import { Prisma } from "@/generated/prisma/client";
import type { ILockProvider } from "@/shared/infrastructure/lock";
import { LOCK_PROVIDER } from "@/shared/infrastructure/lock";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../ports/notification.repository.port";
import type { CreateNotificationData } from "../ports/notification-data";
import { NotificationService } from "./notification.service";
import { PushDeliveryService } from "./push-delivery.service";

describe("NotificationService — 알림 발송 엔진", () => {
	let service: NotificationService;
	let notificationRepo: Mocked<NotificationRepositoryPort>;
	let pushDeliveryService: Mocked<PushDeliveryService>;
	let lockProvider: Mocked<ILockProvider>;

	// 테스트 데이터
	const mockUserId = "user-1";

	beforeEach(async () => {
		// Builder ID 카운터 리셋
		NotificationBuilder.resetIdCounter();

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
		notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
		pushDeliveryService = unitRef.get(PushDeliveryService);
		lockProvider = unitRef.get(LOCK_PROVIDER);

		// 기본: Lock 획득 성공 (release 함수 반환)
		lockProvider.acquire.mockResolvedValue(jest.fn());

		// PushDeliveryService 기본 동작 설정
		pushDeliveryService.shouldSendPush.mockResolvedValue(true);
	});

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
			expect(notificationRepo.createNotification).toHaveBeenCalledWith(data);
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

	describe("createAndSendWithDedup", () => {
		const baseSetup = () => {
			const notification = NotificationBuilder.create(mockUserId)
				.asFollowNew("friend-1")
				.build();

			notificationRepo.createNotification.mockResolvedValue(notification);

			return { notification };
		};

		it("NUDGE_RECEIVED: 전략이 없으므로 dedup 체크 없이 바로 생성한다", async () => {
			// Given — NudgeService에서 쿨다운(24h/Todo) + 일일 제한으로 이미 보호
			baseSetup();

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
			expect(lockProvider.acquire).not.toHaveBeenCalled();
			expect(notificationRepo.existsRecentNotification).not.toHaveBeenCalled();
			expect(notificationRepo.createNotification).toHaveBeenCalled();
		});

		it("CHEER_RECEIVED: 전략이 없으므로 dedup 체크 없이 바로 생성한다", async () => {
			// Given — CheerService에서 쿨다운(24h/receiver) + 일일 제한으로 이미 보호
			baseSetup();

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
			expect(result).not.toBeNull();
			expect(lockProvider.acquire).not.toHaveBeenCalled();
			expect(notificationRepo.existsRecentNotification).not.toHaveBeenCalled();
			expect(notificationRepo.createNotification).toHaveBeenCalled();
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
				type: "FOLLOW_NEW",
				title: "팔로우",
				body: "새 팔로워",
				friendId: "friend-1",
			});

			// Then — since가 현재 - 24시간 (FOLLOW windowMs = 24 * MS_PER_HOUR)
			const calledSince =
				notificationRepo.existsRecentNotification.mock.calls[0]?.[0]?.since;
			expect(calledSince).toBeInstanceOf(Date);
			if (!(calledSince instanceof Date)) {
				throw new Error("since 파라미터가 전달되지 않았습니다");
			}
			const expectedMs = before - 24 * 3_600_000;
			expect(Math.abs(calledSince.getTime() - expectedMs)).toBeLessThan(100);
		});

		it("dedup 처리 시 잠금을 획득하고 해제해야 한다", async () => {
			// Given
			const mockRelease = jest.fn().mockResolvedValue(undefined);
			lockProvider.acquire.mockResolvedValue(mockRelease);
			notificationRepo.existsRecentNotification.mockResolvedValue(false);
			baseSetup();

			// When
			await service.createAndSendWithDedup({
				userId: mockUserId,
				type: "FOLLOW_NEW",
				title: "팔로우",
				body: "새 팔로워",
				friendId: "friend-1",
			});

			// Then
			expect(lockProvider.acquire).toHaveBeenCalledWith(
				expect.stringContaining("dedup:user-1:FOLLOW_NEW"),
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
				type: "FOLLOW_NEW",
				title: "팔로우",
				body: "새 팔로워",
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
					type: "FOLLOW_NEW",
					title: "팔로우",
					body: "새 팔로워",
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
