import { EntityId } from "#api/shared/domain/model/entity-id";

export class MemoId extends EntityId<number> {
  static reconstitute(value: number): MemoId {
    return new MemoId(value);
  }
}
