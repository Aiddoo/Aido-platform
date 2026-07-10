/**
 * UpsertWeeklyAchievementsHandler 단위 테스트
 *
 * 실제 DB 없이 저장소 포트를 스텁으로 대체해 빈 배열 단락·불변식 검증·위임을 확인한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { WeeklyAchievementUpsert } from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import { UpsertWeeklyAchievementsCommand } from "./upsert-weekly-achievements.command";
import { UpsertWeeklyAchievementsHandler } from "./upsert-weekly-achievements.handler";

function record(
	overrides: Partial<WeeklyAchievementUpsert> = {},
): WeeklyAchievementUpsert {
	return {
		userId: "user-1",
		year: 2026,
		week: 10,
		totalTodos: 5,
		completedTodos: 3,
		achievedAt: new Date("2026-03-09T00:00:00.000Z"),
		...overrides,
	};
}

describe("UpsertWeeklyAchievementsHandler — 일괄 upsert 핸들러", () => {
	let handler: UpsertWeeklyAchievementsHandler;
	let repository: Mocked<WeeklyAchievementRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpsertWeeklyAchievementsHandler,
		).compile();

		handler = unit;
		repository = unitRef.get(WEEKLY_ACHIEVEMENT_REPOSITORY);
	});

	it("레코드가 비어 있으면 저장소를 호출하지 않는다", async () => {
		// Given - 빈 레코드 배열

		// When - upsert를 실행하면
		await handler.execute(new UpsertWeeklyAchievementsCommand([]));

		// Then - 저장소 upsertMany가 호출되지 않는다
		expect(repository.upsertMany).not.toHaveBeenCalled();
	});

	it("불변식을 통과한 스냅샷을 저장소에 위임한다", async () => {
		// Given - 유효한 두 레코드
		repository.upsertMany.mockResolvedValue(undefined);
		const records = [record(), record({ userId: "user-2", week: 11 })];

		// When - upsert를 실행하면
		await handler.execute(new UpsertWeeklyAchievementsCommand(records));

		// Then - 저장소에 그대로 위임된다
		expect(repository.upsertMany).toHaveBeenCalledWith(records);
	});

	it("완료 수가 전체 수를 초과하면 도메인 불변식으로 실패한다", async () => {
		// Given - completedTodos > totalTodos 인 잘못된 레코드
		const invalid = record({ totalTodos: 2, completedTodos: 5 });

		// When/Then - SYS_0002 도메인 예외로 실패하고 저장소를 호출하지 않는다
		await expect(
			handler.execute(new UpsertWeeklyAchievementsCommand([invalid])),
		).rejects.toMatchObject({ errorCode: "SYS_0002" });
		expect(repository.upsertMany).not.toHaveBeenCalled();
	});
});
