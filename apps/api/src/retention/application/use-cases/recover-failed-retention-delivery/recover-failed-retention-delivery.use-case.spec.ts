import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createRetentionRepositoryMock, createUnitOfWorkMock } from "@test/mocks/ports";

import { UNIT_OF_WORK } from "@/shared/application/ports";

import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import { RecoverFailedRetentionDeliveryUseCase } from "./recover-failed-retention-delivery.use-case";

describe("RecoverFailedRetentionDeliveryUseCase", () => {
	it("DLQ는 matching generation의 unclaimed retention publication만 reopen하도록 위임한다", async () => {
		const { unit, unitRef } = await TestBed.solitary(RecoverFailedRetentionDeliveryUseCase)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		const repository = unitRef.get<Mocked<RetentionRepositoryPort>>(RETENTION_REPOSITORY);
		repository.reopenUnclaimedDispatch.mockResolvedValue(true);

		await expect(unit.execute({ outboxId: "outbox-1", publishAttempt: 3 })).resolves.toBe(true);
		expect(repository.reopenUnclaimedDispatch).toHaveBeenCalledWith({
			outboxId: "outbox-1",
			publishAttempt: 3,
			availableAt: expect.any(Date),
			reason: "RETENTION_RUNTIME_RETRIES_EXHAUSTED",
		});
	});
});
