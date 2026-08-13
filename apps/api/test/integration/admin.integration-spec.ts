/**
 * Admin 클린아키텍처 수직 통합 테스트
 *
 * @description
 * endpoint use-case → 포트 어댑터(Prisma/Notification)까지의
 * 배선을 검증합니다. DatabaseService·NotificationFacade는
 * mock으로 대체해 실제 DB/발송 없이 대상 필터링·배치 발송·예외를 확인합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test admin.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { ADMIN_BROADCAST_NOTIFIER } from "@/admin/application/ports/admin-broadcast-notifier.port";
import { ADMIN_GROWTH_METRICS } from "@/admin/application/ports/admin-growth-metrics.port";
import { ADMIN_USER_DIRECTORY } from "@/admin/application/ports/admin-user-directory.port";
import { AdminQueries } from "@/admin/application/queries";
import { AdminUseCases } from "@/admin/application/use-cases";
import { BroadcastNotificationUseCase } from "@/admin/application/use-cases/broadcast-notification/broadcast-notification.use-case";
import { SendTargetedNotificationUseCase } from "@/admin/application/use-cases/send-targeted-notification/send-targeted-notification.use-case";
import { NotificationAdminBroadcastNotifierAdapter } from "@/admin/infrastructure/adapters/notification-admin-broadcast-notifier.adapter";
import { PrismaAdminUserDirectoryAdapter } from "@/admin/infrastructure/adapters/prisma-admin-user-directory.adapter";
import { NotificationFacade } from "@/notification";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

describe("Admin 수직 통합 테스트 (Mock DB/Notification)", () => {
	let module: TestingModule;
	let broadcastNotificationUseCase: BroadcastNotificationUseCase;
	let sendTargetedNotificationUseCase: SendTargetedNotificationUseCase;

	const mockUserDb = {
		findMany: jest.fn(),
		count: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		user: mockUserDb,
	});

	const mockNotificationService = {
		createAndSendBatch: jest.fn().mockResolvedValue({ count: 0 }),
	};

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				...AdminUseCases,
				...AdminQueries,
				{
					provide: ADMIN_GROWTH_METRICS,
					useValue: { getSummary: jest.fn() },
				},
				{
					provide: ADMIN_USER_DIRECTORY,
					useClass: PrismaAdminUserDirectoryAdapter,
				},
				{
					provide: ADMIN_BROADCAST_NOTIFIER,
					useClass: NotificationAdminBroadcastNotifierAdapter,
				},
				{ provide: DatabaseService, useValue: mockDatabaseService },
				{ provide: NotificationFacade, useValue: mockNotificationService },
			],
		}).compile();

		await module.init();
		broadcastNotificationUseCase = module.get(BroadcastNotificationUseCase);
		sendTargetedNotificationUseCase = module.get(
			SendTargetedNotificationUseCase,
		);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockNotificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	describe("브로드캐스트", () => {
		it("ALL — 모든 사용자에게 알림이 발송된다", async () => {
			// Given - 3명의 활성 사용자 (배치 크기 미만이라 1회 조회로 종료)
			mockUserDb.findMany.mockResolvedValue([
				{ id: "user-1" },
				{ id: "user-2" },
				{ id: "user-3" },
			]);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 3,
			});

			// When - ALL 대상 브로드캐스트
			const result = await broadcastNotificationUseCase.execute({
				title: "테스트 알림",
				body: "전체 사용자 알림입니다",
				targetFilter: "ALL",
				action: undefined,
				force: false,
			});

			// Then - 모든 사용자에게 발송되어야 함
			expect(result.totalTargets).toBe(3);
			expect(result.successCount).toBe(3);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalled();
		});

		it("WITH_PUSH_TOKEN — 푸시 토큰 조건이 where 절에 반영된다", async () => {
			// Given - 푸시 토큰이 있는 사용자 2명
			mockUserDb.findMany.mockResolvedValue([
				{ id: "user-push-1" },
				{ id: "user-push-2" },
			]);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - WITH_PUSH_TOKEN 대상 브로드캐스트
			const result = await broadcastNotificationUseCase.execute({
				title: "푸시 알림",
				body: "푸시 토큰 사용자 알림입니다",
				targetFilter: "WITH_PUSH_TOKEN",
				action: undefined,
				force: false,
			});

			// Then - 조건이 반영되고 대상에게만 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(result.successCount).toBe(2);
			expect(mockUserDb.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ pushTokens: { some: {} } }),
				}),
			);
		});

		it("대상 없음 — BusinessException을 던진다", async () => {
			// Given - 대상 사용자가 없음 (빈 페이지로 즉시 종료)
			mockUserDb.findMany.mockResolvedValueOnce([]);

			// When & Then - 대상 없음은 ADMIN_1402(ApplicationException)로 실패
			await expect(
				broadcastNotificationUseCase.execute({
					title: "테스트 알림",
					body: "대상 없음",
					targetFilter: "ALL",
					action: undefined,
					force: false,
				}),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("타겟 발송", () => {
		it("지정된 userId 목록에 ADMIN_TARGETED 알림이 발송된다", async () => {
			// Given - 존재하는 사용자 2명
			mockUserDb.findMany.mockResolvedValue([
				{ id: "target-user-1" },
				{ id: "target-user-2" },
			]);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - 타겟 알림 발송
			const result = await sendTargetedNotificationUseCase.execute({
				title: "타겟 알림",
				body: "지정 사용자 알림입니다",
				userIds: ["target-user-1", "target-user-2"],
				action: undefined,
				force: false,
			});

			// Then - 지정 사용자에게 ADMIN_TARGETED로 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(result.successCount).toBe(2);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						userId: "target-user-1",
						type: "ADMIN_TARGETED",
						force: false,
					}),
					expect.objectContaining({
						userId: "target-user-2",
						type: "ADMIN_TARGETED",
						force: false,
					}),
				]),
			);
		});

		it("존재하지 않는 userId는 필터링된다", async () => {
			// Given - 3개 userId 중 2개만 존재
			mockUserDb.findMany.mockResolvedValue([
				{ id: "existing-1" },
				{ id: "existing-2" },
			]);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 2,
			});

			// When - 타겟 알림 발송
			const result = await sendTargetedNotificationUseCase.execute({
				title: "타겟 알림",
				body: "일부 사용자 알림입니다",
				userIds: ["existing-1", "non-existing", "existing-2"],
				action: undefined,
				force: false,
			});

			// Then - 존재하는 사용자에게만 발송되어야 함
			expect(result.totalTargets).toBe(2);
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledWith(
				expect.not.arrayContaining([
					expect.objectContaining({ userId: "non-existing" }),
				]),
			);
		});
	});
});
