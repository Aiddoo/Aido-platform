import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../domain/todo-id.vo.js";
import type { TodoBriefReadModel } from "../read-models/todo-brief.read-model.js";

// 다른 Context(social 콕)가 할 일 테이블을 직접 읽지 않고 할 일 요약을 받는 조회 포트다. 활성 UoW 안에서는 같은 트랜잭션으로 읽는다
export abstract class TodoBriefReaderPort {
  // 없는 id는 결과에 없다
  abstract findByIds(todoIds: readonly TodoId[]): Promise<TodoBriefReadModel[]>;
  // 그 주인의 할 일 행을 잠그고 읽는다. 완료·공개 변경과 다른 Context의 저장을 같은 행 잠금으로 직렬화한다
  abstract lockOwnedTodo(todoId: TodoId, ownerId: UserId): Promise<TodoBriefReadModel | null>;
  // 기간 할 일은 시작~종료일, 하루 할 일은 시작일에 센다
  abstract countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number>;
}
