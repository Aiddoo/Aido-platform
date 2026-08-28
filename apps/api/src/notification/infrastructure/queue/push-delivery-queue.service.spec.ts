import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import {
	PUSH_DELIVERY_DEAD_LETTER_QUEUE,
	PUSH_DELIVERY_DEAD_LETTER_JOB_POLICY,
	PUSH_DELIVERY_JOB_POLICY,
	PUSH_DELIVERY_QUEUE,
	PushDeliveryJobName,
} from "./push-delivery-queue.constants";
import { PushDeliveryQueueService } from "./push-delivery-queue.service";

describe("PushDeliveryQueueService — durable push queue 발행", () => {
	let service: PushDeliveryQueueService;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(PushDeliveryQueueService)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({
				start: jest.fn(),
				stop: jest.fn(),
				enqueue: jest.fn().mockResolvedValue("push-job-1"),
				schedule: jest.fn().mockResolvedValue(undefined),
				unschedule: jest.fn(),
				cancel: jest.fn(),
				work: jest.fn(),
				health: jest.fn(),
			}))
			.compile();

		service = unit;
		runtime = unitRef.get(JOB_RUNTIME);
	});

	it("모듈 초기화 시 backend-neutral 1분 recovery relay를 등록한다", async () => {
		// Given - 정상 동작하는 job runtime

		// When - 모듈 초기화와 background scheduler 등록 완료를 기다림
		service.onModuleInit();
		await service.schedulerRegistration;

		// Then - versioned queue에 하나의 안정적인 scheduler를 등록
		expect(runtime.schedule).toHaveBeenCalledWith(
			"push-delivery-outbox-relay-scheduler",
			"* * * * *",
			PUSH_DELIVERY_QUEUE,
			{ name: PushDeliveryJobName.RELAY_OUTBOX, data: {} },
			PUSH_DELIVERY_JOB_POLICY,
		);
	});

	it("runtime이 idempotency 중복을 null로 반환해도 발행 성공으로 처리한다", async () => {
		// Given - 같은 idempotency key의 job이 이미 존재하는 runtime
		runtime.enqueue.mockResolvedValue(null);
		const publications = [{ dispatchId: 11, publishAttempt: 2 }];

		// When & Then - null을 오류로 바꾸지 않고 정상 완료
		await expect(service.enqueueDeliveries(publications)).resolves.toBeUndefined();
		expect(runtime.enqueue).toHaveBeenCalledWith(
			PUSH_DELIVERY_QUEUE,
			{ name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
			expect.objectContaining({
				deadLetter: {
					queue: PUSH_DELIVERY_DEAD_LETTER_QUEUE,
					jobPolicy: PUSH_DELIVERY_DEAD_LETTER_JOB_POLICY,
				},
				idempotencyKey: expect.any(String),
			}),
		);
	});

	it("publication 순서와 무관한 colon 없는 idempotency key를 만든다", async () => {
		// Given - 동일한 generation 집합의 서로 다른 입력 순서
		const firstOrder = [
			{ dispatchId: 23, publishAttempt: 4 },
			{ dispatchId: 7, publishAttempt: 2 },
		];
		const secondOrder = [...firstOrder].reverse();

		// When - 두 순서를 각각 enqueue
		await service.enqueueDeliveries(firstOrder);
		await service.enqueueDeliveries(secondOrder);
		const firstKey = runtime.enqueue.mock.calls[0]?.[2].idempotencyKey;
		const secondKey = runtime.enqueue.mock.calls[1]?.[2].idempotencyKey;

		// Then - 동일 집합은 backend-safe한 하나의 key로 수렴
		expect(firstKey).toBe(secondKey);
		expect(firstKey).toMatch(/^push-delivery-[0-9a-f]{64}$/);
		expect(firstKey).not.toContain(":");
	});
});
