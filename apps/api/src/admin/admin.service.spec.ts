/**
 * AdminService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - GWT (Given/When/Then) 주석으로 테스트 구조 명확화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import {
	BROADCAST_TARGET_FILTER,
	NOTIFICATION_ACTION_TYPE,
} from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UserBuilder } from "@test/builders";

import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { NotificationService } from "../notification/notification.service";
import { AdminService } from "./admin.service";

/**
 * user.findMany의 select: { id: true } 결과 타입
 */
interface UserIdOnly {
	id: string;
}

describe("AdminService — 관리자 서비스", () => {
	let service: AdminService;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(AdminService).compile();

		service = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
	});

	describe("broadcastNotification", () => {
		it("전체 사용자에게 알림을 발송해야 한다", async () => {
			// Given
			const dto = {
				title: "공지사항",
				body: "새로운 기능이 추가되었습니다",
				targetFilter: BROADCAST_TARGET_FILTER.ALL,
			};

			const mockUsers = [
				UserBuilder.create().withId("user-1").verified().build(),
				UserBuilder.create().withId("user-2").verified().build(),
				UserBuilder.create().withId("user-3").verified().build(),
			];

			const userIds: UserIdOnly[] = mockUsers.map((u) => ({ id: u.id }));
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 3,
			});

			// When
			const result = await service.broadcastNotification(dto);

			// Then
			expect(result).toEqual({
				successCount: 3,
				failCount: 0,
				totalTargets: 3,
			});

			expect(database.user.findMany).toHaveBeenCalledWith({
				where: {
					deletedAt: null,
					status: "ACTIVE",
				},
				select: { id: true },
				orderBy: { id: "asc" },
				take: 500,
			});

			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_BROADCAST",
					title: "공지사항",
					body: "새로운 기능이 추가되었습니다",
				},
				{
					userId: "user-2",
					type: "ADMIN_BROADCAST",
					title: "공지사항",
					body: "새로운 기능이 추가되었습니다",
				},
				{
					userId: "user-3",
					type: "ADMIN_BROADCAST",
					title: "공지사항",
					body: "새로운 기능이 추가되었습니다",
				},
			]);
		});

		it("푸시 토큰이 있는 사용자에게만 알림을 발송해야 한다", async () => {
			// Given
			const dto = {
				title: "푸시 알림",
				body: "테스트 메시지",
				targetFilter: BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN,
			};

			const mockUsers = [
				UserBuilder.create().withId("user-1").verified().build(),
				UserBuilder.create().withId("user-2").verified().build(),
			];

			const userIds: UserIdOnly[] = mockUsers.map((u) => ({ id: u.id }));
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When
			const result = await service.broadcastNotification(dto);

			// Then
			expect(result.successCount).toBe(2);
			expect(database.user.findMany).toHaveBeenCalledWith({
				where: {
					deletedAt: null,
					status: "ACTIVE",
					pushTokens: { some: {} },
				},
				select: { id: true },
				orderBy: { id: "asc" },
				take: 500,
			});
		});

		it("대상 사용자가 없으면 에러를 던져야 한다", async () => {
			// Given
			const dto = {
				title: "공지사항",
				body: "테스트",
				targetFilter: BROADCAST_TARGET_FILTER.ALL,
			};

			database.user.findMany.mockResolvedValue([]);

			// When
			const action = service.broadcastNotification(dto);

			// Then
			await expect(action).rejects.toThrow(BusinessException);
		});

		it("최근 7일 활동 사용자에게만 알림을 발송해야 한다", async () => {
			// Given
			const dto = {
				title: "알림",
				body: "메시지",
				targetFilter: BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS,
			};

			const recentUser = UserBuilder.create()
				.withId("user-1")
				.verified()
				.withLastLoginAt(new Date())
				.build();

			const userIds: UserIdOnly[] = [{ id: recentUser.id }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When
			const result = await service.broadcastNotification(dto);

			// Then
			expect(result.totalTargets).toBe(1);
			expect(database.user.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						lastLoginAt: expect.objectContaining({
							gte: expect.any(Date),
						}),
					}),
				}),
			);
		});

		it("action에 URL이 있으면 metadata.externalUrl을 포함해야 한다", async () => {
			// Given
			const dto = {
				title: "v1.0.4 업데이트",
				body: "새로운 기능이 추가되었어요!",
				targetFilter: BROADCAST_TARGET_FILTER.ALL,
				action: {
					type: NOTIFICATION_ACTION_TYPE.BROWSER,
					url: "https://www.aido.kr/ko/patch-notes",
				},
			};

			const userIds: UserIdOnly[] = [{ id: "user-1" }, { id: "user-2" }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When
			await service.broadcastNotification(dto);

			// Then
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_BROADCAST",
					title: "v1.0.4 업데이트",
					body: "새로운 기능이 추가되었어요!",
					action: {
						type: NOTIFICATION_ACTION_TYPE.BROWSER,
						url: "https://www.aido.kr/ko/patch-notes",
					},
					metadata: { externalUrl: "https://www.aido.kr/ko/patch-notes" },
				},
				{
					userId: "user-2",
					type: "ADMIN_BROADCAST",
					title: "v1.0.4 업데이트",
					body: "새로운 기능이 추가되었어요!",
					action: {
						type: NOTIFICATION_ACTION_TYPE.BROWSER,
						url: "https://www.aido.kr/ko/patch-notes",
					},
					metadata: { externalUrl: "https://www.aido.kr/ko/patch-notes" },
				},
			]);
		});

		it("action에 URL이 없으면 metadata를 포함하지 않아야 한다", async () => {
			// Given
			const dto = {
				title: "공지사항",
				body: "안내 메시지",
				targetFilter: BROADCAST_TARGET_FILTER.ALL,
				action: {
					type: NOTIFICATION_ACTION_TYPE.NONE,
				},
			};

			const userIds: UserIdOnly[] = [{ id: "user-1" }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When
			await service.broadcastNotification(dto);

			// Then
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_BROADCAST",
					title: "공지사항",
					body: "안내 메시지",
					action: {
						type: NOTIFICATION_ACTION_TYPE.NONE,
					},
				},
			]);
		});

		it("구독자에게만 알림을 발송해야 한다", async () => {
			// Given
			const dto = {
				title: "프리미엄 안내",
				body: "구독자 혜택",
				targetFilter: BROADCAST_TARGET_FILTER.SUBSCRIBERS,
			};

			const subscriber = UserBuilder.create()
				.withId("user-1")
				.verified()
				.asPremium()
				.build();

			const userIds: UserIdOnly[] = [{ id: subscriber.id }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When
			await service.broadcastNotification(dto);

			// Then
			expect(database.user.findMany).toHaveBeenCalledWith({
				where: {
					deletedAt: null,
					status: "ACTIVE",
					subscriptionStatus: "ACTIVE",
				},
				select: { id: true },
				orderBy: { id: "asc" },
				take: 500,
			});
		});
	});

	describe("sendTargetedNotification", () => {
		it("특정 사용자들에게 알림을 발송해야 한다", async () => {
			// Given
			const dto = {
				title: "개인 알림",
				body: "테스트 메시지",
				userIds: ["user-1", "user-2"],
			};

			const mockUsers = [
				UserBuilder.create().withId("user-1").verified().build(),
				UserBuilder.create().withId("user-2").verified().build(),
			];

			const userIds: UserIdOnly[] = mockUsers.map((u) => ({ id: u.id }));
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When
			const result = await service.sendTargetedNotification(dto);

			// Then
			expect(result).toEqual({
				successCount: 2,
				failCount: 0,
				totalTargets: 2,
			});

			expect(database.user.findMany).toHaveBeenCalledWith({
				where: {
					id: { in: ["user-1", "user-2"] },
					deletedAt: null,
				},
				select: { id: true },
			});

			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_TARGETED",
					title: "개인 알림",
					body: "테스트 메시지",
				},
				{
					userId: "user-2",
					type: "ADMIN_TARGETED",
					title: "개인 알림",
					body: "테스트 메시지",
				},
			]);
		});

		it("존재하지 않는 사용자는 필터링해야 한다", async () => {
			// Given
			const dto = {
				title: "알림",
				body: "메시지",
				userIds: ["user-1", "user-not-exist"],
			};

			const existingUser = UserBuilder.create()
				.withId("user-1")
				.verified()
				.build();

			// user-1만 존재
			const userIds: UserIdOnly[] = [{ id: existingUser.id }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When
			const result = await service.sendTargetedNotification(dto);

			// Then
			expect(result.totalTargets).toBe(1);
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_TARGETED",
					title: "알림",
					body: "메시지",
				},
			]);
		});

		it("action에 URL이 있으면 metadata.externalUrl을 포함해야 한다", async () => {
			// Given
			const dto = {
				title: "개인 알림",
				body: "확인해주세요",
				userIds: ["user-1"],
				action: {
					type: NOTIFICATION_ACTION_TYPE.BROWSER,
					url: "https://www.aido.kr/ko/patch-notes",
				},
			};

			const userIds: UserIdOnly[] = [{ id: "user-1" }];
			database.user.findMany.mockResolvedValue(userIds as never);
			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When
			await service.sendTargetedNotification(dto);

			// Then
			expect(notificationService.createAndSendBatch).toHaveBeenCalledWith([
				{
					userId: "user-1",
					type: "ADMIN_TARGETED",
					title: "개인 알림",
					body: "확인해주세요",
					action: {
						type: NOTIFICATION_ACTION_TYPE.BROWSER,
						url: "https://www.aido.kr/ko/patch-notes",
					},
					metadata: { externalUrl: "https://www.aido.kr/ko/patch-notes" },
				},
			]);
		});

		it("모든 사용자가 존재하지 않으면 에러를 던져야 한다", async () => {
			// Given
			const dto = {
				title: "알림",
				body: "메시지",
				userIds: ["user-not-exist"],
			};

			database.user.findMany.mockResolvedValue([]);

			// When
			const action = service.sendTargetedNotification(dto);

			// Then
			await expect(action).rejects.toThrow(BusinessException);
		});
	});
});
