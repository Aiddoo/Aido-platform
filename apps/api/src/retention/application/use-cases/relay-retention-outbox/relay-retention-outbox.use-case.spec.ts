import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createRetentionRepositoryMock, createUnitOfWorkMock } from "@test/mocks/ports";

import { UNIT_OF_WORK } from "@/shared/application/ports";

import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port";
import {
	RETENTION_JOB_ENQUEUER,
	type RetentionJobEnqueuerPort,
} from "../../ports/retention-job-enqueuer.port";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import { RelayRetentionOutboxUseCase } from "./relay-retention-outbox.use-case";

describe("RelayRetentionOutboxUseCase — 내구성 큐 전달", () => {
	let useCase: RelayRetentionOutboxUseCase;
	let repository: Mocked<RetentionRepositoryPort>;
	let enqueuer: Mocked<RetentionJobEnqueuerPort>;
	let config: RetentionConfigPort;

	beforeEach(async () => {
		const compiled = await TestBed.solitary(RelayRetentionOutboxUseCase)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock<RetentionJobEnqueuerPort>(RETENTION_JOB_ENQUEUER)
			.impl(() => ({ enqueueDispatch: jest.fn() }))
			.mock<RetentionConfigPort>(RETENTION_CONFIG)
			.impl(() => ({ enabled: true, treatmentPercent: 50 }))
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();
		useCase = compiled.unit;
		repository = compiled.unitRef.get(RETENTION_REPOSITORY);
		enqueuer = compiled.unitRef.get(RETENTION_JOB_ENQUEUER);
		config = compiled.unitRef.get(RETENTION_CONFIG);
	});

	it("retention이 비활성화된 환경에서는 DB와 queue를 건드리지 않는다", async () => {
		Object.assign(config, { enabled: false });

		await useCase.execute();

		expect(repository.recoverStaleDispatches).not.toHaveBeenCalled();
		expect(repository.claimOutboxes).not.toHaveBeenCalled();
		expect(enqueuer.enqueueDispatch).not.toHaveBeenCalled();
	});

	it("claim한 outbox를 큐에 등록한 뒤에만 PUBLISHED 처리한다", async () => {
		repository.claimOutboxes.mockResolvedValue([{ id: "outbox-1", attempts: 1 }]);

		await useCase.execute();

		expect(enqueuer.enqueueDispatch).toHaveBeenCalledWith({ id: "outbox-1", attempts: 1 });
		expect(repository.markOutboxPublished).toHaveBeenCalledWith({
			id: "outbox-1",
			attempts: 1,
		});
	});

	it("큐 장애 시 PUBLISHED로 만들지 않고 재시도 시각을 저장한다", async () => {
		repository.claimOutboxes.mockResolvedValue([{ id: "outbox-1", attempts: 1 }]);
		enqueuer.enqueueDispatch.mockRejectedValue("redis down");

		await useCase.execute();

		expect(repository.markOutboxPublished).not.toHaveBeenCalled();
		expect(repository.markOutboxFailed).toHaveBeenCalledWith(
			expect.objectContaining({
				outboxId: "outbox-1",
				hasExhaustedRetries: false,
				error: "redis down",
			}),
		);
	});

	it("마지막 publish 시도도 실패하면 원본 Error와 함께 outbox를 FAILED 처리한다", async () => {
		repository.claimOutboxes.mockResolvedValue([{ id: "outbox-20", attempts: 20 }]);
		enqueuer.enqueueDispatch.mockRejectedValue(new Error("pg-boss unavailable"));

		await useCase.execute();

		expect(repository.markOutboxFailed).toHaveBeenCalledWith(
			expect.objectContaining({
				outboxId: "outbox-20",
				publishAttempt: 20,
				hasExhaustedRetries: true,
				error: "pg-boss unavailable",
			}),
		);
	});

	it("enqueue 성공 후 PUBLISHED write 실패는 generation을 되돌리지 않고 전파한다", async () => {
		repository.claimOutboxes.mockResolvedValue([{ id: "outbox-1", attempts: 20 }]);
		repository.markOutboxPublished.mockRejectedValue(new Error("postgres unavailable"));

		await expect(useCase.execute()).rejects.toThrow("postgres unavailable");

		expect(enqueuer.enqueueDispatch).toHaveBeenCalledTimes(1);
		expect(repository.markOutboxFailed).not.toHaveBeenCalled();
	});

	it("독립적인 outbox publish를 병렬로 시작한다", async () => {
		repository.claimOutboxes.mockResolvedValue([
			{ id: "outbox-1", attempts: 1 },
			{ id: "outbox-2", attempts: 1 },
		]);
		let firstCompleted = false;
		enqueuer.enqueueDispatch.mockImplementation(async (outbox) => {
			if (outbox.id === "outbox-1") {
				await new Promise((resolve) => setTimeout(resolve, 10));
				firstCompleted = true;
				return;
			}
			expect(firstCompleted).toBe(false);
		});

		await useCase.execute();

		expect(enqueuer.enqueueDispatch).toHaveBeenCalledTimes(2);
		expect(repository.markOutboxPublished).toHaveBeenCalledTimes(2);
	});
});
