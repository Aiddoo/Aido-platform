import { EntityId } from "#api/shared/domain/model/entity-id";

export class UserReportId extends EntityId<string> {
  static reconstitute(value: string): UserReportId {
    return new UserReportId(value);
  }
}
