import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUnitOfWorkMock } from "@test/mocks/ports/unit-of-work.mock";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port";
import {
	PUSH_DELIVERY_OUTBOX_REPOSITORY,
	type PushDeliveryOutboxRepositoryPort,
} from "../../ports/push-delivery-outbox.repository.port";
import { PublishPushDeliveryOutboxUseCase } from "../publish-push-delivery-outbox/publish-push-delivery-outbox.use-case";
import { RelayPushDeliveryOutboxUseCase } from "./relay-push-delivery-outbox.use-case";

function createOutboxMock(): PushDeliveryOutboxRepositoryPort {
	return {
		claimByDispatchIds: jest.fn(),
		claimAvailable: jest.fn(),
		markPublished: jest.fn(),
		defer: jest.fn(),
		recoverStaleProcessing: jest.fn(),
	};
}

function createLifecycleMock(): PushDeliveryLifecycleRepositoryPort {
	return {
		claim: jest.fn(),
		markRateLimitReserved: jest.fn(),
		reopenAfterFinalClaimFailure: jest.fn(),
		reopenFailedPublications: jest.fn(),
		finalizeSkipped: jest.fn(),
		finalizeResults: jest.fn(),
		release: jest.fn(),
		recoverStaleProcessing: jest.fn(),
	};
}

describe("RelayPushDeliveryOutboxUseCase — stale recovery와 relay", () => {
	let useCase: RelayPushDeliveryOutboxUseCase;
	let outbox: Mocked<PushDeliveryOutboxRepositoryPort>;
	let lifecycle: Mocked<PushDeliveryLifecycleRepositoryPort>;
	let publishOutbox: Mocked<PublishPushDeliveryOutboxUseCase>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(RelayPushDeliveryOutboxUseCase)
			.mock<PushDeliveryOutboxRepositoryPort>(PUSH_DELIVERY_OUTBOX_REPOSITORY)
			.impl(() => createOutboxMock())
			.mock<PushDeliveryLifecycleRepositoryPort>(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
			.impl(() => createLifecycleMock())
			.mock<UnitOfWorkPort>(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		useCase = unit;
		outbox = unitRef.get(PUSH_DELIVERY_OUTBOX_REPOSITORY);
		lifecycle = unitRef.get(PUSH_DELIVERY_LIFECYCLE_REPOSITORY);
		publishOutbox = unitRef.get(PublishPushDeliveryOutboxUseCase);
		lifecycle.recoverStaleProcessing.mockResolvedValue(0);
		outbox.recoverStaleProcessing.mockResolvedValue(0);
		publishOutbox.execute.mockResolvedValue(0);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("stale delivery와 outbox lease를 먼저 복구한 뒤 available batch를 발행한다", async () => {
		// Given - 고정된 relay 실행 시각
		const now = new Date("2026-08-29T12:00:00.000Z");
		const processingStaleBefore = new Date(now.getTime() - 15 * 60_000);
		jest.useFakeTimers({ now });

		// When - 주기 relay 실행
		await useCase.execute();

		// Then - 외부 전송 latency를 고려한 15분 lease만 복구한다.
		// PUBLISHED generation은 시간 경과만으로 무효화하지 않는다.
		expect(lifecycle.recoverStaleProcessing).toHaveBeenCalledWith(processingStaleBefore);
		expect(outbox.recoverStaleProcessing).toHaveBeenCalledWith(processingStaleBefore);
		expect(publishOutbox.execute).toHaveBeenCalledWith({ kind: "available", limit: 100 });
		expect(publishOutbox.execute).toHaveBeenCalledTimes(1);
	});

	it("항상 가득 찬 backlog도 trigger당 최대 10개 batch로 제한한다", async () => {
		// Given - 매번 100개가 발행되는 큰 backlog
		publishOutbox.execute.mockResolvedValue(100);

		// When - 단일 relay trigger 실행
		await useCase.execute();

		// Then - 한 worker가 queue를 독점하지 않도록 1,000개에서 양보
		expect(publishOutbox.execute).toHaveBeenCalledTimes(10);
	});
});
