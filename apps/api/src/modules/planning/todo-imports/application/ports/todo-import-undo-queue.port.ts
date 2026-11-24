import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

import type { TodoImportId } from "../../domain/todo-import-id.vo.js";

export interface TodoImportUndoRound {
  readonly importId: TodoImportId;
  readonly round: number;
  // 이 할 일 id 뒤부터 이어서 지운다. 처음은 null이다
  readonly afterTodoId: TodoId | null;
}

// 되돌리기 작업을 활성 트랜잭션에 넣는다
export abstract class TodoImportUndoQueuePort {
  abstract enqueue(round: TodoImportUndoRound): Promise<void>;
}
