import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class UserReportId extends EntityId<string> {
  static generate(): UserReportId {
    return new UserReportId(createEntityId());
  }

  static reconstitute(value: string): UserReportId {
    return new UserReportId(value);
  }
}
