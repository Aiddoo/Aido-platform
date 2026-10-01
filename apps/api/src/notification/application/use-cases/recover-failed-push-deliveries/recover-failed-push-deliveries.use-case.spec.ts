import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";

import {
	PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
	type PushDeliveryLifecycleRepositoryPort,
} from "../../ports/push-delivery-lifecycle.repository.port.js";
import { RecoverFailedPushDeliveriesUseCase } from "./recover-failed-push-deliveries.use-case.js";

describe("RecoverFailedPushDeliveriesUseCase", () => {
	it("DLQ publication 중 현재 PENDING dispatch와 matching generation subset만 repository에 위임한다", async () => {
		const { unit, unitRef } = await TestBed.solitary(RecoverFailedPushDeliveriesUseCase)
			.mock<PushDeliveryLifecycleRepositoryPort>(PUSH_DELIVERY_LIFECYCLE_REPOSITORY)
			.impl(() => ({ reopenFailedPublications: vi.fn().mockResolvedValue(1) }) as never)
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		const lifecycle = unitRef.get<Mocked<PushDeliveryLifecycleRepositoryPort>>(
			PUSH_DELIVERY_LIFECYCLE_REPOSITORY,
		);
		const publications = [
			{ dispatchId: 11, publishAttempt: 2 },
			{ dispatchId: 12, publishAttempt: 4 },
		];

		await expect(unit.execute({ publications })).resolves.toBe(1);
		expect(lifecycle.reopenFailedPublications).toHaveBeenCalledWith({
			publications,
			availableAt: expect.any(Date),
			error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
		});
	});
});
