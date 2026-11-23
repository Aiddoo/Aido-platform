import { EntityId } from "#api/shared/domain/model/entity-id";

// 사용자마다 위치가 하나라 값은 그 사용자 id다. 행의 대리 키(id 칸)는 도메인이 읽지 않는다
export class UserLocationId extends EntityId<string> {
  static reconstitute(value: string): UserLocationId {
    return new UserLocationId(value);
  }
}
