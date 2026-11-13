import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryWeeklyAchievementRepository } from "#test/doubles/insights/in-memory-weekly-achievement.repository";
import {
  createWeeklyAchievementTallyFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

import { IsoWeek } from "../../domain/iso-week.vo.js";
import { RecordWeeklyAchievementsUseCase } from "./record-weekly-achievements.use-case.js";

function setup() {
  const weeklyAchievementRepository = new InMemoryWeeklyAchievementRepository();
  const useCase = new RecordWeeklyAchievementsUseCase({ weeklyAchievementRepository });
  return { weeklyAchievementRepository, useCase };
}

function findWeek(repository: InMemoryWeeklyAchievementRepository, userId: UserId, week: number) {
  return repository.findByWeek({ userId, isoWeek: IsoWeek.reconstitute(2026, week) });
}

describe("RecordWeeklyAchievementsUseCase", () => {
  it("빈 배치는 아무것도 저장하지 않는다", async () => {
    // Given
    const { weeklyAchievementRepository, useCase } = setup();

    // When
    await useCase.execute({ tallies: [] });

    // Then
    expect(weeklyAchievementRepository.size).toBe(0);
  });

  it("여러 사용자·주를 저장하고 같은 주를 다시 집계하면 처음 id를 둔 채 갱신한다", async () => {
    // Given
    const { weeklyAchievementRepository, useCase } = setup();
    const first = createWeeklyAchievementTallyFixture();
    const second = createWeeklyAchievementTallyFixture({
      userId: UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID),
      week: 11,
    });
    await useCase.execute({ tallies: [first, second] });
    const before = await findWeek(weeklyAchievementRepository, first.userId, 10);
    const laterAt = Temporal.Instant.from("2026-03-16T00:00:00Z");

    // When
    await useCase.execute({ tallies: [{ ...first, completedTodos: 5, achievedAt: laterAt }] });

    // Then
    const after = await findWeek(weeklyAchievementRepository, first.userId, 10);
    expect(weeklyAchievementRepository.size).toBe(2);
    expect(after?.toPrimitives()).toEqual({
      id: before?.id.value,
      userId: WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
      year: 2026,
      week: 10,
      totalTodos: 5,
      completedTodos: 5,
      achievedAt: Temporal.Instant.from("2026-03-16T00:00:00Z"),
    });
    expect((await findWeek(weeklyAchievementRepository, second.userId, 11))?.completedTodos).toBe(
      3,
    );
  });

  it("배치 뒤쪽의 완료 수가 전체보다 많으면 SYS_0002로 거절하고 앞쪽 기록도 남기지 않는다", async () => {
    // Given
    const { weeklyAchievementRepository, useCase } = setup();
    const tallies = [
      createWeeklyAchievementTallyFixture(),
      createWeeklyAchievementTallyFixture({ week: 11, totalTodos: 2, completedTodos: 5 }),
    ];

    // When
    const execution = useCase.execute({ tallies });

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
      details: { field: "completedTodos", completedTodos: 5, totalTodos: 2 },
    });
    expect(weeklyAchievementRepository.size).toBe(0);
  });
});
