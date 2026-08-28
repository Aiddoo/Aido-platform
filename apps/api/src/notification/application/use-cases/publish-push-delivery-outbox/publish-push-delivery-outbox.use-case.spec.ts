import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUnitOfWorkMock } from "@test/mocks/ports/unit-of-work.mock";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import {
	PUSH_DELIVERY_JOB_ENQUEUER,
	type PushDeliveryJobEnqueuerPort,
} from "../../ports/push-delivery-job-enqueuer.port";
import {
	PUSH_DELIVERY_OUTBOX_REPOSITORY,
	type PushDeliveryOutboxRepositoryPort,
} from "../../ports/push-delivery-outbox.repository.port";
import { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case";

function createOutboxMock(): PushDeliveryOutboxRepositoryPort {
	return {
		claimByDispatchIds: jest.fn(),
		claimAvailable: jest.fn(),
		markPublished: jest.fn(),
		defer: jest.fn(),
		recoverStaleProcessing: jest.fn(),
	};
}

function createEnqueuerMock(): PushDeliveryJobEnqueuerPort {
	return { enqueueDeliveries: jest.fn() };
}

describe("PublishPushDeliveryOutboxUseCase — outbox job 발행", () => {
	let useCase: PublishPushDeliveryOutboxUseCase;
	let outbox: Mocked<PushDeliveryOutboxRepositoryPort>;
	let enqueuer: Mocked<PushDeliveryJobEnqueuerPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(PublishPushDeliveryOutboxUseCase)
			.mock<PushDeliveryOutboxRepositoryPort>(PUSH_DELIVERY_OUTBOX_REPOSITORY)
			.impl(() => createOutboxMock())
			.mock<PushDeliveryJobEnqueuerPort>(PUSH_DELIVERY_JOB_ENQUEUER)
			.impl(() => createEnqueuerMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		useCase = unit;
		outbox = unitRef.get(PUSH_DELIVERY_OUTBOX_REPOSITORY);
		enqueuer = unitRef.get(PUSH_DELIVERY_JOB_ENQUEUER);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("enqueue가 거부되면 같은 generation을 backoff 시점까지 defer한다", async () => {
		// Given - claim 성공 후 queue backend가 enqueue를 거부
		const now = new Date("2026-08-29T00:00:00.000Z");
		jest.useFakeTimers({ now });
		jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const publications = [{ dispatchId: 41, publishAttempt: 2 }];
		outbox.claimByDispatchIds.mockResolvedValue(publications);
		enqueuer.enqueueDeliveries.mockRejectedValue(new Error("queue unavailable"));
		outbox.defer.mockResolvedValue(1);

		// When - 지정 dispatch fast path 발행
		const publishedCount = await useCase.execute({
			kind: "dispatches",
			dispatchIds: [41],
		});

		// Then - capped backoff로 PENDING 복구하고 published로 표시하지 않음
		expect(outbox.defer).toHaveBeenCalledWith({
			publications,
			availableAt: new Date(now.getTime() + 2_000),
			error: "queue unavailable",
		});
		expect(outbox.markPublished).not.toHaveBeenCalled();
		expect(publishedCount).toBe(0);
	});

	it("enqueue 성공 뒤 publish mark가 실패하면 generation을 defer하지 않는다", async () => {
		// Given - queue가 job을 수락했지만 publish mark 저장이 일시적으로 실패
		jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const publications = [{ dispatchId: 52, publishAttempt: 3 }];
		outbox.claimByDispatchIds.mockResolvedValue(publications);
		enqueuer.enqueueDeliveries.mockResolvedValue(undefined);
		outbox.markPublished.mockRejectedValue(new Error("commit uncertain"));

		// When - 지정 dispatch 발행
		const publishedCount = await useCase.execute({
			kind: "dispatches",
			dispatchIds: [52],
		});

		// Then - 이미 enqueue된 generation은 lease recovery에 맡기고 되돌리지 않음
		expect(outbox.markPublished).toHaveBeenCalledWith(publications, expect.any(Date));
		expect(outbox.defer).not.toHaveBeenCalled();
		expect(publishedCount).toBe(0);
	});
});
