import { WeeklyAchievementRepositoryPort } from "#api/modules/insights/weekly-achievements/application/ports/weekly-achievement.repository.port";
import type { IsoWeek } from "#api/modules/insights/weekly-achievements/domain/iso-week.vo";
import { WeeklyAchievementId } from "#api/modules/insights/weekly-achievements/domain/weekly-achievement-id.vo";
import { WeeklyAchievement } from "#api/modules/insights/weekly-achievements/domain/weekly-achievement.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function weekKey(userId: UserId, isoWeek: IsoWeek): string {
  return `${userId.value}:${isoWeek.year}:${isoWeek.week}`;
}

function copyOf(achievement: WeeklyAchievement): WeeklyAchievement {
  return WeeklyAchievement.reconstitute(achievement.toPrimitives());
}

// Drizzle 저장소처럼 사용자·주가 같으면 처음 id를 두고 할 일 수·달성 시각만 덮어쓴다
export class InMemoryWeeklyAchievementRepository extends WeeklyAchievementRepositoryPort {
  readonly #achievements = new Map<string, WeeklyAchievement>();
  #sequence: number;

  constructor(achievements: readonly WeeklyAchievement[] = []) {
    super();
    for (const achievement of achievements) {
      this.#achievements.set(weekKey(achievement.userId, achievement.isoWeek), copyOf(achievement));
    }
    this.#sequence = Math.max(0, ...achievements.map((achievement) => achievement.id.value));
  }

  get size(): number {
    return this.#achievements.size;
  }

  async nextIds(count: number): Promise<WeeklyAchievementId[]> {
    return Array.from({ length: count }, () => {
      this.#sequence += 1;
      return WeeklyAchievementId.reconstitute(this.#sequence);
    });
  }

  async listByYear(params: {
    readonly userId: UserId;
    readonly year: number;
    readonly afterWeek: number | null;
    readonly limit: number;
  }): Promise<WeeklyAchievement[]> {
    const owned = this.#ownedInYear(params.userId, params.year).toSorted(
      (left, right) => right.isoWeek.week - left.isoWeek.week,
    );
    const { afterWeek } = params;
    if (afterWeek == null) {
      return owned.slice(0, params.limit).map(copyOf);
    }
    if (!owned.some((achievement) => achievement.isoWeek.week === afterWeek)) {
      return [];
    }
    return owned
      .filter((achievement) => achievement.isoWeek.week < afterWeek)
      .slice(0, params.limit)
      .map(copyOf);
  }

  async listAllByYear(params: {
    readonly userId: UserId;
    readonly year: number;
  }): Promise<WeeklyAchievement[]> {
    return this.#ownedInYear(params.userId, params.year)
      .toSorted((left, right) => left.isoWeek.week - right.isoWeek.week)
      .map(copyOf);
  }

  async findByWeek(params: {
    readonly userId: UserId;
    readonly isoWeek: IsoWeek;
  }): Promise<WeeklyAchievement | null> {
    const found = this.#achievements.get(weekKey(params.userId, params.isoWeek));
    return found == null ? null : copyOf(found);
  }

  async saveAll(achievements: readonly WeeklyAchievement[]): Promise<void> {
    for (const achievement of achievements) {
      const key = weekKey(achievement.userId, achievement.isoWeek);
      const existing = this.#achievements.get(key);
      this.#achievements.set(
        key,
        existing == null
          ? copyOf(achievement)
          : WeeklyAchievement.reconstitute({
              ...achievement.toPrimitives(),
              id: existing.id.value,
            }),
      );
    }
  }

  #ownedInYear(userId: UserId, year: number): WeeklyAchievement[] {
    return [...this.#achievements.values()].filter(
      (achievement) => achievement.userId.equals(userId) && achievement.isoWeek.year === year,
    );
  }
}
