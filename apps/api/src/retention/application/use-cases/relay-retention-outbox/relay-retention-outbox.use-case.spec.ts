import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createRetentionRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";
import { UNIT_OF_WORK } from "@/shared/application/ports";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";
import {
	RETENTION_JOB_ENQUEUER,
	type RetentionJobEnqueuerPort,
} from "../../ports/retention-job-enqueuer.port";
import { RelayRetentionOutboxUseCase } from "./relay-retention-outbox.use-case";

describe("RelayRetentionOutboxUseCase — 내구성 큐 전달", () => {
	let useCase: RelayRetentionOutboxUseCase;
	let repository: Mocked<RetentionRepositoryPort>;
	let enqueuer: Mocked<RetentionJobEnqueuerPort>;

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
	});

	it("claim한 outbox를 큐에 등록한 뒤에만 PUBLISHED 처리한다", async () => {
		repository.claimOutboxes.mockResolvedValue([
			{ id: "outbox-1", attempts: 1 },
		]);

		await useCase.execute();

		expect(enqueuer.enqueueDispatch).toHaveBeenCalledWith("outbox-1");
		expect(repository.markOutboxPublished).toHaveBeenCalledWith("outbox-1");
	});

	it("큐 장애 시 PUBLISHED로 만들지 않고 재시도 시각을 저장한다", async () => {
		repository.claimOutboxes.mockResolvedValue([
			{ id: "outbox-1", attempts: 1 },
		]);
		enqueuer.enqueueDispatch.mockRejectedValue("redis down");

		await useCase.execute();

		expect(repository.markOutboxPublished).not.toHaveBeenCalled();
		expect(repository.markOutboxFailed).toHaveBeenCalledWith(
			expect.objectContaining({
				outboxId: "outbox-1",
				attempts: 1,
				error: "redis down",
			}),
		);
	});

	it("독립적인 outbox publish를 병렬로 시작한다", async () => {
		repository.claimOutboxes.mockResolvedValue([
			{ id: "outbox-1", attempts: 1 },
			{ id: "outbox-2", attempts: 1 },
		]);
		let firstCompleted = false;
		enqueuer.enqueueDispatch.mockImplementation(async (outboxId) => {
			if (outboxId === "outbox-1") {
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
