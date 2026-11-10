import type { WeeklyAchievementRepositoryPort } from "#api/modules/insights/weekly-achievements/application/ports/weekly-achievement.repository.port";
import type {
  WeeklyAchievement,
  WeeklyAchievementPrimitives,
} from "#api/modules/insights/weekly-achievements/domain/weekly-achievement.entity";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createWeeklyAchievementFixture,
  WEEKLY_ACHIEVEMENT_FIXTURE_NOW,
  WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID,
  WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID,
} from "#test/fixtures/insights/weekly-achievement.fixture";

const USER = UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_USER_ID);
const OTHER = UserId.reconstitute(WEEKLY_ACHIEVEMENT_FIXTURE_OTHER_USER_ID);
const LATER = WEEKLY_ACHIEVEMENT_FIXTURE_NOW.add({ hours: 24 * 7 });

async function newAchievement(
  repository: WeeklyAchievementRepositoryPort,
  overrides: Partial<WeeklyAchievementPrimitives> = {},
): Promise<WeeklyAchievement> {
  const [id] = await repository.nextIds(1);
  if (id == null) {
    throw new Error("nextIds가 id를 주지 않았다");
  }
  return createWeeklyAchievementFixture({ id: id.value, ...overrides });
}

async function saveWeeks(
  repository: WeeklyAchievementRepositoryPort,
  weeks: readonly number[],
  overrides: Partial<WeeklyAchievementPrimitives> = {},
): Promise<void> {
  const achievements = [];
  for (const week of weeks) {
    achievements.push(await newAchievement(repository, { week, ...overrides }));
  }
  await repository.saveAll(achievements);
}

function weeksOf(achievements: readonly WeeklyAchievement[]): number[] {
  return achievements.map((achievement) => achievement.isoWeek.week);
}

export function describeWeeklyAchievementRepositoryContract(
  createRepository: () => Promise<WeeklyAchievementRepositoryPort>,
): void {
  describe("주간 성취 저장소 계약", () => {
    it("nextIds는 한 번에 서로 다른 id를 요청한 수만큼 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = await repository.nextIds(3);

      // Then
      expect(new Set(ids.map((id) => id.value)).size).toBe(3);
    });

    it("저장한 기록은 그 사용자·주로만 찾고 다른 사용자에게는 없다", async () => {
      // Given
      const repository = await createRepository();
      const achievement = await newAchievement(repository);
      await repository.saveAll([achievement]);

      // When
      const found = await repository.findByWeek({ userId: USER, isoWeek: achievement.isoWeek });
      const foreign = await repository.findByWeek({ userId: OTHER, isoWeek: achievement.isoWeek });

      // Then
      expect(found?.toPrimitives()).toEqual(achievement.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("같은 사용자·주를 다시 저장하면 처음 id를 두고 할 일 수·달성 시각만 바꾼다", async () => {
      // Given
      const repository = await createRepository();
      const first = await newAchievement(repository, { completedTodos: 3 });
      await repository.saveAll([first]);
      const again = await newAchievement(repository, { completedTodos: 9, achievedAt: LATER });

      // When
      await repository.saveAll([again]);
      const found = await repository.findByWeek({ userId: USER, isoWeek: first.isoWeek });

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...again.toPrimitives(),
        id: first.id.value,
      });
    });

    it("한 묶음 안 같은 주는 마지막 값이 이긴다", async () => {
      // Given
      const repository = await createRepository();
      const earlier = await newAchievement(repository, { completedTodos: 1 });
      const latest = await newAchievement(repository, { completedTodos: 4 });

      // When
      await repository.saveAll([earlier, latest]);
      const found = await repository.findByWeek({ userId: USER, isoWeek: latest.isoWeek });

      // Then
      expect(found?.completedTodos).toBe(4);
    });

    it("연도 목록은 주 내림차순이고 after 주 다음부터 주며 그 주가 그 사용자·연도에 없으면 비어 있다", async () => {
      // Given
      const repository = await createRepository();
      await saveWeeks(repository, [1, 2, 3, 4]);
      await saveWeeks(repository, [7], { userId: OTHER.value });
      await saveWeeks(repository, [8], { year: 2_025 });
      const list = (afterWeek: number | null) =>
        repository.listByYear({ userId: USER, year: 2_026, afterWeek, limit: 3 });

      // When
      const pages = {
        first: await list(null),
        afterAnchor: await list(4),
        afterFirstWeek: await list(1),
        missingAnchor: await list(99),
        foreignAnchor: await list(7),
        otherYearAnchor: await list(8),
      };

      // Then
      expect({
        first: weeksOf(pages.first),
        afterAnchor: weeksOf(pages.afterAnchor),
        afterFirstWeek: weeksOf(pages.afterFirstWeek),
        missingAnchor: weeksOf(pages.missingAnchor),
        foreignAnchor: weeksOf(pages.foreignAnchor),
        otherYearAnchor: weeksOf(pages.otherYearAnchor),
      }).toEqual({
        first: [4, 3, 2],
        afterAnchor: [3, 2, 1],
        afterFirstWeek: [],
        missingAnchor: [],
        foreignAnchor: [],
        otherYearAnchor: [],
      });
    });

    it("한 해 전체 목록은 그 사용자·연도만 주 오름차순으로 준다", async () => {
      // Given
      const repository = await createRepository();
      await saveWeeks(repository, [3, 1, 2]);
      await saveWeeks(repository, [5], { userId: OTHER.value });
      await saveWeeks(repository, [52], { year: 2_025 });

      // When
      const all = await repository.listAllByYear({ userId: USER, year: 2_026 });

      // Then
      expect(weeksOf(all)).toEqual([1, 2, 3]);
      expect(all.every((achievement) => achievement.isoWeek.year === 2_026)).toBe(true);
    });
  });
}
