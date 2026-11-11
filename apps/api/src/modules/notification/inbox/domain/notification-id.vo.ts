import { EntityId } from "#api/shared/domain/model/entity-id";

export class NotificationId extends EntityId<number> {
  static reconstitute(value: number): NotificationId {
    return new NotificationId(value);
  }
}
