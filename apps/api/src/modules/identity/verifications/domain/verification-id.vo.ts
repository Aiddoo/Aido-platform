import { EntityId } from "#api/shared/domain/model/entity-id";

export class VerificationId extends EntityId<number> {
  static reconstitute(value: number): VerificationId {
    return new VerificationId(value);
  }
}
