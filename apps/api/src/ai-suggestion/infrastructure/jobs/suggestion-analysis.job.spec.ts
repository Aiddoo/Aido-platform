import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { UserBuilder } from "#test/builders/index";
import { asMock } from "#test/mocks/index";

import { SuggestionAnalysisProcessor } from "../processors/suggestion-analysis.processor.js";
import { AiSuggestionQueueMaintenanceService } from "../queue/ai-suggestion-queue-maintenance.service.js";
import { AI_SUGGESTION_QUEUE } from "../queue/ai-suggestion-queue.js";
import { SuggestionAnalysisJob } from "./suggestion-analysis.job.js";

describe("SuggestionAnalysisJob — durable dispatcher", () => {
	let job: SuggestionAnalysisJob;
	let database: Mocked<DatabaseService>;
	let runtime: Mocked<JobRuntimePort>;
	let processor: Mocked<SuggestionAnalysisProcessor>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SuggestionAnalysisJob)
			.mock(JOB_RUNTIME)
			.impl(() => ({
				schedule: vi.fn().mockResolvedValue(undefined),
				enqueue: vi.fn().mockResolvedValue("job-1"),
			}))
			.mock(AiSuggestionQueueMaintenanceService)
			.impl(() => ({ cleanExpiredFailures: vi.fn().mockResolvedValue(0) }))
			.compile();
		job = unit;
		database = unitRef.get(DatabaseService);
		runtime = unitRef.get(JOB_RUNTIME);
		processor = unitRef.get(SuggestionAnalysisProcessor);
	});

	afterEach(() => vi.useRealTimers());

	it("KST 일일 스케줄을 등록하고 processor를 연결한다", async () => {
		vi.useFakeTimers({ now: new Date("2026-03-09T07:00:00+09:00") });
		job.onModuleInit();
		await job.schedulerRegistration;

		expect(runtime.schedule).toHaveBeenCalledWith(
			"daily-suggestion-scheduler",
			"30 7 * * *",
			AI_SUGGESTION_QUEUE,
			{ name: "dispatch-analysis", data: {} },
			expect.objectContaining({ timezone: "Asia/Seoul" }),
		);
		expect(processor.setSuggestionJob).toHaveBeenCalledWith(job);
	});

	it("07:30 이후 재시작하면 당일 dispatch를 멱등 키로 보정한다", async () => {
		vi.useFakeTimers({ now: new Date("2026-03-09T08:00:00+09:00") });
		job.onModuleInit();
		await job.schedulerRegistration;

		expect(runtime.enqueue).toHaveBeenCalledWith(
			AI_SUGGESTION_QUEUE,
			{ name: "dispatch-analysis", data: {} },
			expect.objectContaining({ idempotencyKey: "dispatch_suggestion_2026-03-09" }),
		);
	});

	it("최근 활동 사용자마다 분석 작업을 등록한다", async () => {
		asMock(database.user.findMany).mockResolvedValue(
			[
				{ id: "user-1", preference: { timezone: "Asia/Seoul" }, location: null },
				{
					id: "user-2",
					preference: { timezone: "America/New_York" },
					location: null,
				},
			].map((value) => ({ ...UserBuilder.create().build(), ...value })),
		);

		await job.dispatchAnalysis();

		expect(runtime.enqueue).toHaveBeenCalledTimes(2);
		expect(runtime.enqueue).toHaveBeenCalledWith(
			AI_SUGGESTION_QUEUE,
			expect.objectContaining({
				name: "analyze-suggestion",
				data: expect.objectContaining({
					userId: "user-1",
					timezone: "Asia/Seoul",
				}),
			}),
			expect.objectContaining({ retryLimit: 2, retryBackoff: true }),
		);
	});

	it("사용자가 없으면 분석 작업을 만들지 않는다", async () => {
		asMock(database.user.findMany).mockResolvedValue([]);
		await job.dispatchAnalysis();

		expect(runtime.enqueue).not.toHaveBeenCalled();
	});
});
