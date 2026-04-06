/**
 * ReportGenerationJob (Dispatcher) 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - BullMQ Job Scheduler 등록 검증
 * - BullMQ 큐에 per-user 잡 등록 검증
 * - Startup catch-up 검증
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

describe("ReportGenerationJob — 리포트 생성 잡", () => {
	let job: ReportGenerationJob;
	let mockDatabase: Mocked<DatabaseService>;
	let mockQueue: Mocked<Queue>;
	let mockProcessor: Mocked<ReportGenerationProcessor>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ReportGenerationJob)
			.mock(getQueueToken(AI_REPORT_QUEUE))
			.impl(() => ({
				add: jest.fn().mockResolvedValue(undefined),
				addBulk: jest.fn().mockResolvedValue(undefined),
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		mockDatabase = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(AI_REPORT_QUEUE));
		mockProcessor = unitRef.get(ReportGenerationProcessor);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 주간/월간 스케줄러를 등록해야 한다", async () => {
			// Given — 화요일 (catch-up 미발동)
			jest.useFakeTimers({ now: new Date("2026-03-10T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"weekly-report-scheduler",
				{ pattern: "0 1 * * 1", tz: "Asia/Seoul" },
				{ name: "dispatch-reports", data: { reportType: "WEEKLY" } },
			);
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"monthly-report-scheduler",
				{ pattern: "0 2 1 * *", tz: "Asia/Seoul" },
				{ name: "dispatch-reports", data: { reportType: "MONTHLY" } },
			);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// Given
			jest.useFakeTimers({ now: new Date("2026-03-10T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockProcessor.setReportJob).toHaveBeenCalledWith(job);
		});
	});

	describe("catch-up on startup", () => {
		it("월요일 01:00 이후 시작 시 WEEKLY dispatch 잡을 추가해야 한다", async () => {
			// Given — 월요일 03:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T03:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).toHaveBeenCalledWith(
				"dispatch-reports",
				{ reportType: "WEEKLY" },
				{ jobId: expect.stringContaining("dispatch_WEEKLY_") },
			);
		});

		it("1일 01:00 이후 시작 시 MONTHLY dispatch 잡을 추가해야 한다", async () => {
			// Given — 4월 1일 02:00 KST (수요일)
			jest.useFakeTimers({ now: new Date("2026-04-01T02:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).toHaveBeenCalledWith(
				"dispatch-reports",
				{ reportType: "MONTHLY" },
				{ jobId: expect.stringContaining("dispatch_MONTHLY_") },
			);
		});

		it("월요일이면서 1일이면 WEEKLY + MONTHLY 모두 추가해야 한다", async () => {
			// Given — 2026-06-01은 월요일
			jest.useFakeTimers({ now: new Date("2026-06-01T03:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).toHaveBeenCalledTimes(2);
			expect(mockQueue.add).toHaveBeenCalledWith(
				"dispatch-reports",
				{ reportType: "WEEKLY" },
				{ jobId: expect.stringContaining("dispatch_WEEKLY_") },
			);
			expect(mockQueue.add).toHaveBeenCalledWith(
				"dispatch-reports",
				{ reportType: "MONTHLY" },
				{ jobId: expect.stringContaining("dispatch_MONTHLY_") },
			);
		});

		it("월요일 01:00 이전에 시작 시 catch-up하지 않아야 한다", async () => {
			// Given — 월요일 00:30 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T00:30:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).not.toHaveBeenCalled();
		});

		it("월요일이 아닌 날에는 WEEKLY catch-up하지 않아야 한다", async () => {
			// Given — 화요일 10:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-10T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).not.toHaveBeenCalled();
		});

		it("1일이 아닌 날에는 MONTHLY catch-up하지 않아야 한다", async () => {
			// Given — 3월 15일 수요일 10:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-15T10:00:00+09:00") });

			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.add).not.toHaveBeenCalled();
		});
	});

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
