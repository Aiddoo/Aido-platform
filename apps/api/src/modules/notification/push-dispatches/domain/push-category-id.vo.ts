import { EntityId } from "#api/shared/domain/model/entity-id";

// 앱이 같은 id로 등록한 알림 버튼 묶음이다
export class PushCategoryId extends EntityId<string> {
  static reconstitute(value: string): PushCategoryId {
    return new PushCategoryId(value);
  }
}
