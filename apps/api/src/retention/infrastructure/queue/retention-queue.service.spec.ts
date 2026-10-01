import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import {
	RETENTION_DEAD_LETTER_QUEUE,
	RETENTION_DEAD_LETTER_JOB_POLICY,
	RETENTION_QUEUE,
	RetentionJobName,
} from "./retention-queue.constants.js";
import { RetentionQueueService } from "./retention-queue.service.js";

describe("RetentionQueueService", () => {
	let service: RetentionQueueService;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const compiled = await TestBed.solitary(RetentionQueueService)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({
				start: vi.fn(),
				stop: vi.fn(),
				enqueue: vi.fn(),
				schedule: vi.fn(),
				unschedule: vi.fn(),
				cancel: vi.fn(),
				work: vi.fn(),
				health: vi.fn(),
			}))
			.compile();
		service = compiled.unit;
		runtime = compiled.unitRef.get(JOB_RUNTIME);
	});

	it("generation을 payload와 idempotency key에 보존하고 dispatch job만 전용 DLQ를 사용한다", async () => {
		await service.enqueueDispatch({ id: "outbox-1", attempts: 4 });

		expect(runtime.enqueue).toHaveBeenCalledWith(
			RETENTION_QUEUE,
			{
				name: RetentionJobName.DISPATCH,
				data: { outboxId: "outbox-1", publishAttempt: 4 },
			},
			expect.objectContaining({
				deadLetter: {
					queue: RETENTION_DEAD_LETTER_QUEUE,
					jobPolicy: RETENTION_DEAD_LETTER_JOB_POLICY,
				},
				idempotencyKey: "retention-push-outbox-1-4",
			}),
		);
	});

	it("outbox recovery scheduler는 backend-neutral 1분 cron을 사용한다", async () => {
		service.onModuleInit();
		await service.schedulerRegistration;

		expect(runtime.schedule).toHaveBeenCalledWith(
			"retention-outbox-relay-scheduler",
			"* * * * *",
			RETENTION_QUEUE,
			{ name: RetentionJobName.OUTBOX_RELAY, data: {} },
			expect.not.objectContaining({ deadLetter: expect.anything() }),
		);
	});
});
