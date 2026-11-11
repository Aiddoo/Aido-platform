import { randomUUID } from "node:crypto";

import { EntityId } from "#api/shared/domain/model/entity-id";

export class TodoSeriesId extends EntityId<string> {
  static generate(): TodoSeriesId {
    return new TodoSeriesId(randomUUID());
  }

  static reconstitute(value: string): TodoSeriesId {
    return new TodoSeriesId(value);
  }
}
