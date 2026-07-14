import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createRetentionRepositoryMock } from "@test/mocks/ports";
import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";
import { EnrollRetentionExperimentUseCase } from "./enroll-retention-experiment.use-case";

describe("EnrollRetentionExperimentUseCase — 신규 사용자만 등록", () => {
	let repository: Mocked<RetentionRepositoryPort>;

	async function build(enabled: boolean) {
		const { unit, unitRef } = await TestBed.solitary(
			EnrollRetentionExperimentUseCase,
		)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock<RetentionConfigPort>(RETENTION_CONFIG)
			.impl(() => ({ enabled, treatmentPercent: 100 }))
			.compile();
		repository = unitRef.get(RETENTION_REPOSITORY);
		return unit;
	}

	it("kill switch가 꺼져 있으면 DB를 전혀 변경하지 않는다", async () => {
		const useCase = await build(false);

		await useCase.execute("existing-or-new-user", false);

		expect(repository.enroll).not.toHaveBeenCalled();
	});

	it("활성화된 신규 등록 요청은 안정적으로 TREATMENT를 저장한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00Z"));
		const useCase = await build(true);

		await useCase.execute("new-user", true);

		expect(repository.enroll).toHaveBeenCalledWith({
			userId: "new-user",
			variant: "TREATMENT",
			startedAt: new Date("2026-07-15T00:00:00Z"),
		});
		jest.useRealTimers();
	});
});
