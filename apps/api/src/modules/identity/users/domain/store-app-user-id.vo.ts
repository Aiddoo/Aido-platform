import { EntityId } from "#api/shared/domain/model/entity-id";

/** 결제 스토어가 사용자를 부르는 ID. 처음에는 User.id이고, 스토어가 별칭을 만들면 storeAppUserId다. */
export class StoreAppUserId extends EntityId<string> {
  static reconstitute(value: string): StoreAppUserId {
    return new StoreAppUserId(value);
  }
}
