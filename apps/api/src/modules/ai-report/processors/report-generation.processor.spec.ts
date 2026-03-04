/**
 * ReportGenerationProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 서비스 위임 검증
 * - 리포트 생성 여부에 따른 알림 발송 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import { NotificationService } from "../../notification/notification.service";
import { AiReportService } from "../ai-report.service";
import {
	type AiReportJobData,
	AiReportJobName,
	ReportGenerationProcessor,
} from "./report-generation.processor";

describe("ReportGenerationProcessor", () => {
	let processor: ReportGenerationProcessor;
	let mockAiReportService: Mocked<AiReportService>;
	let mockNotificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		jest.clearAllMocks();

		const { unit, unitRef } = await TestBed.solitary(
			ReportGenerationProcessor,
		).compile();

		processor = unit;
		mockAiReportService = unitRef.get(AiReportService);
		mockNotificationService = unitRef.get(NotificationService);
	});

	function makeJob(data: AiReportJobData): Job<AiReportJobData> {
		return {
			name: AiReportJobName.GENERATE,
			data,
		} as unknown as Job<AiReportJobData>;
	}

	// =========================================================================
	// Stalled 이벤트
	// =========================================================================

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			// When & Then: 에러 없이 호출되어야 한다
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	// =========================================================================
	// 서비스 위임
	// =========================================================================

	describe("서비스 위임", () => {
		it("WEEKLY 리포트 시 generateWeeklyReport를 호출해야 한다", async () => {
			// Given
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When
			await processor.process(
				makeJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "WEEKLY",
				}),
			);

			// Then
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledWith(
				"user-123",
				"Asia/Seoul",
			);
		});

		it("MONTHLY 리포트 시 generateMonthlyReport를 호출해야 한다", async () => {
			// Given
			mockAiReportService.generateMonthlyReport.mockResolvedValue(null);

			// When
			await processor.process(
				makeJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "MONTHLY",
				}),
			);

			// Then
			expect(mockAiReportService.generateMonthlyReport).toHaveBeenCalledWith(
				"user-123",
				"Asia/Seoul",
			);
		});
	});

	// =========================================================================
	// 알림 발송
	// =========================================================================

	describe("알림 발송", () => {
		it("WEEKLY 리포트 생성 시 WEEKLY_REPORT 알림을 발송해야 한다", async () => {
			// Given
			mockAiReportService.generateWeeklyReport.mockResolvedValue({} as never);
			mockNotificationService.createAndSend.mockResolvedValue(
				undefined as never,
			);

			// When
			await processor.process(
				makeJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "WEEKLY",
				}),
			);

			// Then
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					type: "WEEKLY_REPORT",
				}),
			);
		});

		it("MONTHLY 리포트 생성 시 MONTHLY_REPORT 알림을 발송해야 한다", async () => {
			// Given
			mockAiReportService.generateMonthlyReport.mockResolvedValue({} as never);
			mockNotificationService.createAndSend.mockResolvedValue(
				undefined as never,
			);

			// When
			await processor.process(
				makeJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "MONTHLY",
				}),
			);

			// Then
			expect(mockNotificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					type: "MONTHLY_REPORT",
				}),
			);
		});

		it("리포트 미생성 시 알림을 발송하지 않아야 한다", async () => {
			// Given: 데이터 부족으로 리포트 미생성
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When
			await processor.process(
				makeJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "WEEKLY",
				}),
			);

			// Then
			expect(mockNotificationService.createAndSend).not.toHaveBeenCalled();
		});
	});
});
