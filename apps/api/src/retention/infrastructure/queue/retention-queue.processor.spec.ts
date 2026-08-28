import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import { DispatchRetentionPushUseCase } from "../../application/use-cases/dispatch-retention-push/dispatch-retention-push.use-case";
import { RecoverFailedRetentionDeliveryUseCase } from "../../application/use-cases/recover-failed-retention-delivery/recover-failed-retention-delivery.use-case";
import {
	RETENTION_DEAD_LETTER_QUEUE,
	RETENTION_DEAD_LETTER_WORKER_POLICY,
	RetentionJobName,
} from "./retention-queue.constants";
import { RetentionQueueProcessor } from "./retention-queue.processor";

describe("RetentionQueueProcessor", () => {
	let processor: RetentionQueueProcessor;
	let runtime: Mocked<JobRuntimePort>;
	let dispatch: Mocked<DispatchRetentionPushUseCase>;
	let recover: Mocked<RecoverFailedRetentionDeliveryUseCase>;

	beforeEach(async () => {
		const compiled = await TestBed.solitary(RetentionQueueProcessor)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({
				start: jest.fn(),
				stop: jest.fn(),
				enqueue: jest.fn(),
				schedule: jest.fn(),
				unschedule: jest.fn(),
				cancel: jest.fn(),
				work: jest.fn(),
				health: jest.fn(),
			}))
			.compile();
		processor = compiled.unit;
		runtime = compiled.unitRef.get(JOB_RUNTIME);
		dispatch = compiled.unitRef.get(DispatchRetentionPushUseCase);
		recover = compiled.unitRef.get(RecoverFailedRetentionDeliveryUseCase);
	});

	it("actual envelope id/attempt와 final-attempt 의미를 dispatch use case에 전달한다", async () => {
		await processor.process("retention-job", 5, {
			name: RetentionJobName.DISPATCH,
			data: { outboxId: "outbox-1", publishAttempt: 2 },
		});

		expect(dispatch.execute).toHaveBeenCalledWith({
			outboxId: "outbox-1",
			publishAttempt: 2,
			processingJobId: "retention-job",
			processingJobAttempt: 5,
			isFinalAttempt: true,
		});
	});

	it("전용 DLQ worker는 legacy/current strict payload를 recovery use case에 전달한다", async () => {
		await processor.onModuleInit();
		const deadLetterWorker = runtime.work.mock.calls.find(
			([queue]) => queue === RETENTION_DEAD_LETTER_QUEUE,
		)?.[1];

		await deadLetterWorker?.([
			{
				id: "retention-dlq-job",
				name: RETENTION_DEAD_LETTER_QUEUE,
				data: {
					name: RetentionJobName.DISPATCH,
					data: { outboxId: "outbox-1", publishAttempt: 2 },
				},
				attempt: 1,
			},
		]);

		expect(recover.execute).toHaveBeenCalledWith({ outboxId: "outbox-1", publishAttempt: 2 });
		expect(runtime.work).toHaveBeenCalledWith(
			RETENTION_DEAD_LETTER_QUEUE,
			expect.any(Function),
			RETENTION_DEAD_LETTER_WORKER_POLICY,
		);
	});
});
