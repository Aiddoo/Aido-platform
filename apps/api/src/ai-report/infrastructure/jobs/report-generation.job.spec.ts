import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { JobRuntimePort } from "@/shared/application/ports/job-runtime.port";
import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { ReportGenerationProcessor } from "../processors/report-generation.processor";
import { AI_REPORT_QUEUE } from "../queue/ai-report-queue";
import { ReportGenerationJob } from "./report-generation.job";

describe("ReportGenerationJob — durable dispatcher", () => {
	let job: ReportGenerationJob;
	let database: MockPrismaClient;
	let runtime: Mocked<JobRuntimePort>;
	let processor: Mocked<ReportGenerationProcessor>;

	beforeEach(async () => {
		database = createMockPrisma();
		const { unit, unitRef } = await TestBed.solitary(ReportGenerationJob)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: database }))
			.mock(JOB_RUNTIME)
			.impl(() => ({
				schedule: jest.fn().mockResolvedValue(undefined),
				enqueue: jest.fn().mockResolvedValue("job-1"),
			}))
			.compile();
		job = unit;
		runtime = unitRef.get(JOB_RUNTIME);
		processor = unitRef.get(ReportGenerationProcessor);
	});

	afterEach(() => jest.useRealTimers());

	it("KST 주간·월간 스케줄을 등록하고 processor를 연결한다", async () => {
		jest.useFakeTimers({ now: new Date("2026-03-10T10:00:00+09:00") });
		job.onModuleInit();
		await job.schedulerRegistration;

		expect(runtime.schedule).toHaveBeenCalledTimes(2);
		expect(runtime.schedule).toHaveBeenCalledWith(
			"weekly-report-scheduler",
			"0 1 * * 1",
			AI_REPORT_QUEUE,
			{ name: "dispatch-reports", data: { reportType: "WEEKLY" } },
			expect.objectContaining({ timezone: "Asia/Seoul" }),
		);
		expect(processor.setReportJob).toHaveBeenCalledWith(job);
	});

	it("월요일 01시 이후 재시작하면 주간 dispatch를 멱등 키로 보정한다", async () => {
		jest.useFakeTimers({ now: new Date("2026-03-09T03:00:00+09:00") });
		job.onModuleInit();
		await job.schedulerRegistration;

		expect(runtime.enqueue).toHaveBeenCalledWith(
			AI_REPORT_QUEUE,
			{ name: "dispatch-reports", data: { reportType: "WEEKLY" } },
			expect.objectContaining({
				jobKey: expect.stringContaining("dispatch_WEEKLY_"),
			}),
		);
	});

	it("대상 사용자마다 생성 작업과 재시도 정책을 등록한다", async () => {
		asMock(database.user.findMany).mockResolvedValue([
			{ id: "user-1", preference: { timezone: "Asia/Seoul", locale: "ko" } },
			{
				id: "user-2",
				preference: { timezone: "America/New_York", locale: "en" },
			},
		]);

		await job.dispatchReports("WEEKLY");

		expect(runtime.enqueue).toHaveBeenCalledTimes(2);
		expect(runtime.enqueue).toHaveBeenCalledWith(
			AI_REPORT_QUEUE,
			expect.objectContaining({
				name: "generate-report",
				data: expect.objectContaining({
					userId: "user-1",
					reportType: "WEEKLY",
				}),
			}),
			expect.objectContaining({ retryLimit: 2, retryBackoff: true }),
		);
	});

	it("preference가 없으면 기존 기본값을 유지한다", async () => {
		asMock(database.user.findMany).mockResolvedValue([
			{ id: "user-1", preference: null },
		]);
		await job.dispatchReports("MONTHLY");

		expect(runtime.enqueue).toHaveBeenCalledWith(
			AI_REPORT_QUEUE,
			expect.objectContaining({
				data: expect.objectContaining({ timezone: "Asia/Seoul", locale: "ko" }),
			}),
			expect.any(Object),
		);
	});
});
