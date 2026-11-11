import { EntityId } from "#api/shared/domain/model/entity-id";

export class WeeklyAchievementId extends EntityId<number> {
  static reconstitute(value: number): WeeklyAchievementId {
    return new WeeklyAchievementId(value);
  }
}
