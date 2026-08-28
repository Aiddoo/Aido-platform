import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case";
import { RecoverFailedPushDeliveriesUseCase } from "../../application/use-cases/recover-failed-push-deliveries/recover-failed-push-deliveries.use-case";
import { RelayPushDeliveryOutboxUseCase } from "../../application/use-cases/relay-push-delivery-outbox/relay-push-delivery-outbox.use-case";
import {
	PUSH_DELIVERY_DEAD_LETTER_QUEUE,
	PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
	PUSH_DELIVERY_QUEUE,
	PushDeliveryJobName,
} from "./push-delivery-queue.constants";
import { PushDeliveryQueueProcessor } from "./push-delivery-queue.processor";

describe("PushDeliveryQueueProcessor — durable push queue routing", () => {
	let processor: PushDeliveryQueueProcessor;
	let relayOutbox: Mocked<RelayPushDeliveryOutboxUseCase>;
	let deliverPushNotifications: Mocked<DeliverPushNotificationsUseCase>;
	let recoverFailedDeliveries: Mocked<RecoverFailedPushDeliveriesUseCase>;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(PushDeliveryQueueProcessor)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({
				start: jest.fn(),
				stop: jest.fn(),
				enqueue: jest.fn(),
				schedule: jest.fn(),
				unschedule: jest.fn(),
				cancel: jest.fn(),
				work: jest.fn().mockResolvedValue(undefined),
				health: jest.fn(),
			}))
			.compile();

		processor = unit;
		relayOutbox = unitRef.get(RelayPushDeliveryOutboxUseCase);
		deliverPushNotifications = unitRef.get(DeliverPushNotificationsUseCase);
		recoverFailedDeliveries = unitRef.get(RecoverFailedPushDeliveriesUseCase);
		runtime = unitRef.get(JOB_RUNTIME);
	});

	it("전용 DLQ worker는 strict delivery publication을 DB recovery use case로 전달한다", async () => {
		await processor.onModuleInit();
		const deadLetterWorker = runtime.work.mock.calls.find(
			([queue]) => queue === PUSH_DELIVERY_DEAD_LETTER_QUEUE,
		)?.[1];
		const publications = [{ dispatchId: 88, publishAttempt: 4 }];

		await deadLetterWorker?.([
			{
				id: "dead-letter-job",
				name: PUSH_DELIVERY_DEAD_LETTER_QUEUE,
				data: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
				attempt: 2,
			},
		]);

		expect(recoverFailedDeliveries.execute).toHaveBeenCalledWith({ publications });
		expect(runtime.work).toHaveBeenCalledWith(
			PUSH_DELIVERY_DEAD_LETTER_QUEUE,
			expect.any(Function),
			PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
		);
	});

	it("runtime의 실제 JobEnvelope.id를 delivery fencing ID로 전달한다", async () => {
		// Given - 등록된 worker와 pg-boss가 전달한 실제 job envelope
		await processor.onModuleInit();
		const worker = runtime.work.mock.calls[0]?.[1];
		const publications = [{ dispatchId: 31, publishAttempt: 5 }];
		expect(worker).toBeDefined();

		// When - runtime worker가 job을 처리
		await worker?.([
			{
				id: "pg-boss-job-7f9c",
				name: PUSH_DELIVERY_QUEUE,
				data: { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
				attempt: 3,
			},
		]);

		// Then - transport에서 새 ID를 만들지 않고 실제 envelope ID와 generation을 전달
		expect(deliverPushNotifications.execute).toHaveBeenCalledWith({
			processingJobId: "pg-boss-job-7f9c",
			processingJobAttempt: 3,
			publications,
			isFinalAttempt: false,
		});
	});

	it("relay job은 delivery use case와 분리해 outbox relay로 라우팅한다", async () => {
		// Given - strict relay payload
		const relayJob = { name: PushDeliveryJobName.RELAY_OUTBOX, data: {} };

		// When - relay job 처리
		await processor.process("relay-job-1", 1, relayJob);

		// Then - relay 책임만 실행
		expect(relayOutbox.execute).toHaveBeenCalledWith();
		expect(deliverPushNotifications.execute).not.toHaveBeenCalled();
	});

	it("retryLimit 이후 마지막 attempt를 outbox reopen 신호로 전달한다", async () => {
		const publications = [{ dispatchId: 32, publishAttempt: 6 }];

		await processor.process("final-job", 6, {
			name: PushDeliveryJobName.DELIVER_DISPATCHES,
			data: publications,
		});

		expect(deliverPushNotifications.execute).toHaveBeenCalledWith({
			processingJobId: "final-job",
			processingJobAttempt: 6,
			publications,
			isFinalAttempt: true,
		});
	});
});
