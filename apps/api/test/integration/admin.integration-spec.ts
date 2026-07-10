/**
 * AdminService 통합 테스트
 *
 * @description
 * AdminService가 DatabaseService, NotificationService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - AdminService와 DatabaseService의 통합 검증
 * - NotificationService 배치 발송 통합 검증
 * - 브로드캐스트 대상 필터링 로직 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test admin.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { UserBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { AdminService } from "@/admin/admin.service";
import { NotificationService } from "@/notification/notification.service";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

describe("AdminService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: AdminService;

	// Mock 데이터베이스 서비스
	const mockUserDb = {
		findMany: jest.fn(),
		count: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		user: mockUserDb,
	});

	// Mock NotificationService
	const mockNotificationService = {
		createAndSendBatch: jest.fn().mockResolvedValue({ count: 0 }),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				AdminService,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: NotificationService,
					useValue: mockNotificationService,
				},
			],
		}).compile();

		service = module.get<AdminService>(AdminService);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("브로드캐스트 알림 통합 테스트", () => {
		it("브로드캐스트 ALL — 모든 사용자에게 알림이 발송된다", async () => {
			// Given - 3명의 활성 사용자 (batchSize=500 미만이므로 1회 호출로 종료)
			const users = [
				UserBuilder.create().withId("user-1").verified().build(),
				UserBuilder.create().withId("user-2").verified().build(),
				UserBuilder.create().withId("user-3").verified().build(),
			];
			mockUserDb.findMany.mockResolvedValue(users.map((u) => ({ id: u.id })));
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 3,
			});

			// When - ALL 대상 브로드캐스트
			const result = await service.broadcastNotification({
				title: "테스트 알림",
				body: "전체 사용자 알림입니다",
				targetFilter: "ALL",
			});

			// Then - 모든 사용자에게 알림이 발송되어야 함
			expect(result.totalTargets).toBe(3);
			expect(result.successCount).toBe(3);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalled();
		});

		it("브로드캐스트 WITH_PUSH_TOKEN — 푸시 토큰이 있는 사용자만 대상이 된다", async () => {
			// Given - 푸시 토큰이 있는 사용자 2명 (batchSize=500 미만이므로 1회 호출로 종료)
			const usersWithToken = [
				UserBuilder.create().withId("user-push-1").verified().build(),
				UserBuilder.create().withId("user-push-2").verified().build(),
			];
			mockUserDb.findMany.mockResolvedValue(
				usersWithToken.map((u) => ({ id: u.id })),
			);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - WITH_PUSH_TOKEN 대상 브로드캐스트
			const result = await service.broadcastNotification({
				title: "푸시 알림",
				body: "푸시 토큰 사용자 알림입니다",
				targetFilter: "WITH_PUSH_TOKEN",
			});

			// Then - 푸시 토큰이 있는 사용자에게만 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(result.successCount).toBe(2);
			expect(mockUserDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						pushTokens: { some: {} },
					}),
				}),
			);
		});

		it("브로드캐스트 대상 없음 — 에러를 반환한다", async () => {
			// Given - 대상 사용자가 없음 (forEachBatch가 빈 페이지로 즉시 종료)
			mockUserDb.findMany.mockResolvedValueOnce([]);

			// When & Then - 대상 없음 에러 발생
			await expect(
				service.broadcastNotification({
					title: "테스트 알림",
					body: "대상 없음",
					targetFilter: "ALL",
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("타겟 발송 통합 테스트", () => {
		it("타겟 발송 — 지정된 userId 목록에 알림이 발송된다", async () => {
			// Given - 존재하는 사용자 2명
			const targetUserIds = ["target-user-1", "target-user-2"];
			mockUserDb.findMany.mockResolvedValue(
				targetUserIds.map((id) => ({ id })),
			);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - 타겟 알림 발송
			const result = await service.sendTargetedNotification({
				title: "타겟 알림",
				body: "지정 사용자 알림입니다",
				userIds: targetUserIds,
			});

			// Then - 지정 사용자에게 알림이 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(result.successCount).toBe(2);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "target-user-1",
						type: "ADMIN_TARGETED",
					}),
					expect.objectContaining({
						userId: "target-user-2",
						type: "ADMIN_TARGETED",
					}),
				]),
			);
		});

		it("타겟 발송 — 존재하지 않는 userId는 필터링된다", async () => {
			// Given - 3개 userId 중 2개만 존재
			const targetUserIds = ["existing-1", "non-existing", "existing-2"];
			mockUserDb.findMany.mockResolvedValue([
				{ id: "existing-1" },
				{ id: "existing-2" },
			]);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - 타겟 알림 발송
			const result = await service.sendTargetedNotification({
				title: "타겟 알림",
				body: "일부 사용자 알림입니다",
				userIds: targetUserIds,
			});

			// Then - 존재하는 사용자에게만 알림이 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.not.arrayContaining([
					expect.objectContaining({ userId: "non-existing" }),
				]),
			);
		});
	});
});
