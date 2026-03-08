/**
 * ReportGenerationJob (Dispatcher) 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - BullMQ Job Scheduler 등록 검증
 * - BullMQ 큐에 per-user 잡 등록 검증
 */

import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";
import { DatabaseService } from "@/database/database.service";
import {
	AI_REPORT_QUEUE,
	ReportGenerationProcessor,
} from "../processors/report-generation.processor";
import { ReportGenerationJob } from "./report-generation.job";

describe("ReportGenerationJob", () => {
	let job: ReportGenerationJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockQueue: Mocked<Queue>;
	let mockProcessor: Mocked<ReportGenerationProcessor>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ReportGenerationJob)
			.mock(getQueueToken(AI_REPORT_QUEUE))
			.impl(() => ({
				addBulk: jest.fn().mockResolvedValue(undefined),
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(AI_REPORT_QUEUE));
		mockProcessor = unitRef.get(ReportGenerationProcessor);
	});

	// =========================================================================
	// onModuleInit 스케줄러 등록
	// =========================================================================

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 주간/월간 스케줄러를 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"weekly-report-scheduler",
				{ pattern: "0 8 * * 1", tz: "Asia/Seoul" },
				{ name: "dispatch-reports", data: { reportType: "WEEKLY" } },
			);
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"monthly-report-scheduler",
				{ pattern: "0 8 1 * *", tz: "Asia/Seoul" },
				{ name: "dispatch-reports", data: { reportType: "MONTHLY" } },
			);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockProcessor.setReportJob).toHaveBeenCalledWith(job);
		});
	});

	// =========================================================================
	// dispatchReports (BullMQ 잡 등록)
	// =========================================================================

	describe("dispatchReports", () => {
		it("모든 사용자에 대해 큐에 잡을 등록해야 한다", async () => {
			// Given
			const users = [
				{ id: "user-1", preference: { timezone: "Asia/Seoul" } },
				{ id: "user-2", preference: { timezone: "America/New_York" } },
			];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchReports("WEEKLY");

			// Then
			expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs).toHaveLength(2);
			expect(jobs?.[0]).toEqual(
				expect.objectContaining({
					name: "generate-report",
					data: expect.objectContaining({
						userId: "user-1",
						timezone: "Asia/Seoul",
						reportType: "WEEKLY",
					}),
				}),
			);
			expect(jobs?.[1]).toEqual(
				expect.objectContaining({
					data: expect.objectContaining({
						userId: "user-2",
						timezone: "America/New_York",
					}),
				}),
			);
		});

		it("월간 리포트 잡은 MONTHLY reportType으로 등록해야 한다", async () => {
			// Given
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchReports("MONTHLY");

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]).toEqual(
				expect.objectContaining({
					data: expect.objectContaining({
						reportType: "MONTHLY",
					}),
				}),
			);
		});

		it("preference가 없으면 기본 타임존 'Asia/Seoul'을 사용해야 한다", async () => {
			// Given
			const users = [{ id: "user-1", preference: null }];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchReports("WEEKLY");

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]?.data).toEqual(
				expect.objectContaining({
					timezone: "Asia/Seoul",
				}),
			);
		});

		it("잡에 retry 옵션이 설정되어야 한다", async () => {
			// Given
			const users = [{ id: "user-1", preference: { timezone: "Asia/Seoul" } }];
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue(users);

			// When
			await job.dispatchReports("WEEKLY");

			// Then
			const jobs = mockQueue.addBulk.mock.calls[0]?.[0];
			expect(jobs?.[0]?.opts).toEqual(
				expect.objectContaining({
					attempts: 3,
					backoff: { type: "exponential", delay: 5_000 },
					removeOnComplete: { age: 604_800, count: 10_000 },
					removeOnFail: { count: 100, age: 86_400 },
				}),
			);
		});

		it("사용자가 없으면 큐에 잡을 등록하지 않아야 한다", async () => {
			// Given
			(mockDatabase.user.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await job.dispatchReports("WEEKLY");

			// Then
			expect(mockQueue.addBulk).not.toHaveBeenCalled();
		});
	});
});
