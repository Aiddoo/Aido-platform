import { EntityId } from "#api/shared/domain/model/entity-id";

/** 결제 공급자가 구매자를 부르는 ID. 처음에는 User.id이고, 공급자가 별칭을 만들면 그 별칭이다. */
export class StoreCustomerId extends EntityId<string> {
  static reconstitute(value: string): StoreCustomerId {
    return new StoreCustomerId(value);
  }
}
