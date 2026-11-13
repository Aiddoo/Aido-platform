import { EntityId } from "#api/shared/domain/model/entity-id";

export class ReminderNudgeId extends EntityId<number> {
  static reconstitute(value: number): ReminderNudgeId {
    return new ReminderNudgeId(value);
  }
}
