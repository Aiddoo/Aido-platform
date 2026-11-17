import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class QuotaChargeId extends EntityId<string> {
  static generate(): QuotaChargeId {
    return new QuotaChargeId(createEntityId());
  }

  static reconstitute(value: string): QuotaChargeId {
    return new QuotaChargeId(value);
  }
}
