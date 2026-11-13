import { EntityId } from "#api/shared/domain/model/entity-id";

/** 결제 공급자가 웹훅 이벤트마다 주는 ID. 공급자 안에서만 유일하다. */
export class ProviderEventId extends EntityId<string> {
  static reconstitute(value: string): ProviderEventId {
    return new ProviderEventId(value);
  }
}
