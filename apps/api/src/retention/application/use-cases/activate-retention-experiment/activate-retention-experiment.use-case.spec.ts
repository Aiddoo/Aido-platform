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
import { ActivateRetentionExperimentUseCase } from "./activate-retention-experiment.use-case";

describe("ActivateRetentionExperimentUseCase — 최초 인증 시점 시작", () => {
	let repository: Mocked<RetentionRepositoryPort>;

	async function build(enabled: boolean) {
		const compiled = await TestBed.solitary(ActivateRetentionExperimentUseCase)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock<RetentionConfigPort>(RETENTION_CONFIG)
			.impl(() => ({ enabled, treatmentPercent: 50 }))
			.compile();
		repository = compiled.unitRef.get(RETENTION_REPOSITORY);
		return compiled.unit;
	}

	it("assignment가 있을 수 있는 활성 환경에서만 시작을 요청한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00Z"));
		const useCase = await build(true);

		await useCase.execute("new-user");

		expect(repository.activate).toHaveBeenCalledWith(
			"new-user",
			new Date("2026-07-15T00:00:00Z"),
		);
		jest.useRealTimers();
	});

	it("kill switch가 꺼지면 기존 인증 경로에서 DB를 조회하지 않는다", async () => {
		const useCase = await build(false);

		await useCase.execute("existing-user");

		expect(repository.activate).not.toHaveBeenCalled();
	});
});
