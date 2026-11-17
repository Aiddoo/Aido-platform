import { EntityId } from "#api/shared/domain/model/entity-id";

/** 스토어에 등록한 구독 상품의 ID. 플랜 판단은 상품 ID 모양으로 한다. */
export class StoreProductId extends EntityId<string> {
  static reconstitute(value: string): StoreProductId {
    return new StoreProductId(value);
  }
}
