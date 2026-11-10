import { EntityId } from "#api/shared/domain/model/entity-id";

export class AiReportId extends EntityId<number> {
  static reconstitute(value: number): AiReportId {
    return new AiReportId(value);
  }
}
