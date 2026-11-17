import { EntityId } from "#api/shared/domain/model/entity-id";

// 앱이 글마다 만드는 멱등 키다. 같은 작성자가 같은 키로 다시 보내면 이미 쓴 글을 돌려준다
export class TodoCommentRequestId extends EntityId<string> {
  static reconstitute(value: string): TodoCommentRequestId {
    return new TodoCommentRequestId(value);
  }
}
