import { EntityId } from "#api/shared/domain/model/entity-id";

// 사용자마다 로그인 수단 묶음이 하나라 값은 그 사용자 id다. 수단 한 건의 id는 LinkedAccountId다
export class LinkedAccountsId extends EntityId<string> {
  static reconstitute(value: string): LinkedAccountsId {
    return new LinkedAccountsId(value);
  }
}
