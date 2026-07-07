/**
 * ReportGenerationProcessor 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 서비스 위임 검증
 * - 리포트 미생성 시 스킵 검증
 *
 * 알림 발송은 Scheduler Strategy에서 담당하므로 여기서는 테스트하지 않습니다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Job } from "bullmq";

import { AiReportService } from "../ai-report.service";
import {
	type AiReportJobData,
	AiReportJobName,
	ReportGenerationProcessor,
} from "./report-generation.processor";

describe("ReportGenerationProcessor — 리포트 생성 프로세서", () => {
	let processor: ReportGenerationProcessor;
	let mockAiReportService: Mocked<AiReportService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			ReportGenerationProcessor,
		).compile();

		processor = unit;
		mockAiReportService = unitRef.get(AiReportService);
	});

	function createMockJob(data: AiReportJobData): Job<AiReportJobData> {
		return {
			name: AiReportJobName.GENERATE,
			data,
		} as unknown as Job<AiReportJobData>;
	}

	describe("onStalled", () => {
		it("stalled 발생 시 에러 없이 처리해야 한다", () => {
			// When & Then: 에러 없이 호출되어야 한다
			expect(() => processor.onStalled("test-job-id")).not.toThrow();
		});
	});

	describe("서비스 위임", () => {
		it("WEEKLY 리포트 시 generateWeeklyReport를 호출해야 한다", async () => {
			// Given
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When
			await processor.process(
				createMockJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "WEEKLY",
				}),
			);

			// Then
			expect(mockAiReportService.generateWeeklyReport).toHaveBeenCalledWith(
				"user-123",
				"Asia/Seoul",
				"ko",
			);
		});

		it("MONTHLY 리포트 시 generateMonthlyReport를 호출해야 한다", async () => {
			// Given
			mockAiReportService.generateMonthlyReport.mockResolvedValue(null);

			// When
			await processor.process(
				createMockJob({
					userId: "user-123",
					timezone: "Asia/Seoul",
					reportType: "MONTHLY",
				}),
			);

			// Then
			expect(mockAiReportService.generateMonthlyReport).toHaveBeenCalledWith(
				"user-123",
				"Asia/Seoul",
				"ko",
			);
		});

		it("리포트 미생성 시 정상 종료해야 한다", async () => {
			// Given - 데이터 부족으로 리포트 미생성
			mockAiReportService.generateWeeklyReport.mockResolvedValue(null);

			// When & Then - 에러 없이 처리
			await expect(
				processor.process(
					createMockJob({
						userId: "user-123",
						timezone: "Asia/Seoul",
						reportType: "WEEKLY",
					}),
				),
			).resolves.toBeUndefined();
		});
	});
});
