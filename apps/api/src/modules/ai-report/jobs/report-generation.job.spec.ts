/**
 * ReportGenerationJob 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 분산 락 획득/해제 검증
 * - 사용자 반복 처리 검증
 * - 개별 사용자 에러 격리 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";

import { AiReportService } from "../ai-report.service";
import { ReportGenerationJob } from "./report-generation.job";

describe("ReportGenerationJob", () => {
	let job: ReportGenerationJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockAiReportService: Mocked<AiReportService>;
	let mockNotificationService: Mocked<NotificationService>;
	let mockLockProvider: Mocked<ILockProvider>;

	const mockRelease = jest.fn().mockResolvedValue(undefined);

	beforeEach(async () => {
		jest.clearAllMocks();

		const { unit, unitRef } = await TestBed.solitary(ReportGenerationJob)
			.mock(LOCK_PROVIDER)
			.impl(() => ({
				acquire: jest.fn(),
				isLocked: jest.fn(),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockAiReportService = unitRef.get(AiReportService);
		mockNotificationService = unitRef.get(NotificationService);
		mockLockProvider = unitRef.get(LOCK_PROVIDER);
	});

	// =========================================================================
	// 분산 락
	// =========================================================================

	describe("분산 락", () => {
		it("주간 리포트 잠금을 획득하고 작업 완료 후 해제해야 한다", async () => {
			// Given: 잠금 획득 성공
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 잠금 획득과 해제가 호출되어야 한다
			expect(mockLockProvider.acquire).toHaveBeenCalledWith(
				"report-weekly",
				expect.any(Number),
			);
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});

		it("잠금 획득 실패 시 작업을 건너뛰어야 한다", async () => {
			// Given: 잠금 획득 실패
			mockLockProvider.acquire.mockResolvedValue(null);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 사용자 조회가 호출되지 않아야 한다
			expect(mockDatabase.user.findMany).not.toHaveBeenCalled();
		});

		it("월간 리포트 잠금을 획득해야 한다", async () => {
			// Given: 잠금 획득 성공
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When: handleMonthlyReport를 호출하면
			await job.handleMonthlyReport();

			// Then: 월간 리포트용 잠금 키로 획득해야 한다
			expect(mockLockProvider.acquire).toHaveBeenCalledWith(
				"report-monthly",
				expect.any(Number),
			);
		});

		it("작업 중 에러가 발생해도 잠금이 해제되어야 한다", async () => {
			// Given: 잠금 획득 성공하지만 사용자 조회에서 에러 발생
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockRejectedValue(
				new Error("DB error"),
			);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: finally 블록에서 잠금이 해제되어야 한다
			expect(mockRelease).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// 사용자 반복 처리
	// =========================================================================

	describe("사용자 반복 처리", () => {
		it("푸시 활성화된 모든 사용자에 대해 리포트를 생성해야 한다", async () => {
			// Given: 2명의 사용자
			const users = [
				{ id: "user-1", preference: { timezone: "Asia/Seoul" } },
				{ id: "user-2", preference: { timezone: "America/New_York" } },
			];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiReportService.generateWeeklyReport.mockResolvedValue({
				id: 1,
			} as never);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 2명의 사용자에 대해 리포트 생성이 호출되어야 한다
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledTimes(2);
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledWith(
				"user-1",
				"Asia/Seoul",
			);
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledWith(
				"user-2",
				"America/New_York",
			);
		});

		it("리포트가 이미 존재하여 null을 반환하면 알림을 보내지 않아야 한다", async () => {
			// Given: 리포트 생성이 null 반환 (이미 존재)
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 알림이 발송되지 않아야 한다
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("리포트 생성 후 알림을 발송해야 한다", async () => {
			// Given: 리포트 생성 성공
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiReportService.generateWeeklyReport.mockResolvedValue({
				id: 1,
			} as never);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 알림이 발송되어야 한다
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "WEEKLY_REPORT",
					title: expect.any(String),
					body: expect.any(String),
				}),
			);
		});

		it("preference가 없으면 기본 타임존 'Asia/Seoul'을 사용해야 한다", async () => {
			// Given: preference가 없는 사용자
			const users = [{ id: "user-1", preference: null }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: 기본 타임존으로 호출되어야 한다
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledWith(
				"user-1",
				"Asia/Seoul",
			);
		});
	});

	// =========================================================================
	// 에러 격리
	// =========================================================================

	describe("에러 격리", () => {
		it("한 사용자의 에러가 다른 사용자 처리에 영향을 주지 않아야 한다", async () => {
			// Given: user-1은 에러, user-2는 정상
			const users = [
				{ id: "user-1", preference: { timezone: "Asia/Seoul" } },
				{ id: "user-2", preference: { timezone: "Asia/Seoul" } },
			];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			mockAiReportService.generateWeeklyReport
				.mockRejectedValueOnce(new Error("user-1 에러"))
				.mockResolvedValueOnce({ id: 2 } as never);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleWeeklyReport를 호출하면
			await job.handleWeeklyReport();

			// Then: user-2의 리포트 생성과 알림이 정상적으로 처리되어야 한다
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledTimes(2);
			expect(mockNotificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({ userId: "user-2" }),
			);
		});
	});

	// =========================================================================
	// 월간 리포트
	// =========================================================================

	describe("월간 리포트", () => {
		it("월간 리포트 생성 시 MONTHLY_REPORT 타입 알림을 보내야 한다", async () => {
			// Given: 사용자와 리포트 생성 성공
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			mockLockProvider.acquire.mockResolvedValue(mockRelease);
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);
			mockAiReportService.generateMonthlyReport.mockResolvedValue({
				id: 1,
			} as never);
			mockNotificationService.createAndSend.mockResolvedValue({} as never);

			// When: handleMonthlyReport를 호출하면
			await job.handleMonthlyReport();

			// Then: MONTHLY_REPORT 타입 알림이 발송되어야 한다
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-1",
					type: "MONTHLY_REPORT",
				}),
			);
		});
	});
});
