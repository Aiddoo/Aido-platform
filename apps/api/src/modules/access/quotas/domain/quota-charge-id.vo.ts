import { EntityId } from "#api/shared/domain/model/entity-id";

export class QuotaChargeId extends EntityId<string> {
  static reconstitute(value: string): QuotaChargeId {
    return new QuotaChargeId(value);
  }
}
