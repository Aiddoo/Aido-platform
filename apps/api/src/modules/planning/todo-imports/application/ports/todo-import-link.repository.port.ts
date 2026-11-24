import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoImportId } from "../../domain/todo-import-id.vo.js";

export interface TodoImportLink {
  readonly todoId: TodoId;
  readonly userId: UserId;
  readonly sourceKey: string;
  readonly importId: TodoImportId;
  readonly createdAt: Temporal.Instant;
}

export interface LinkedTodoPageQuery {
  readonly importId: TodoImportId;
  // 앞 묶음의 마지막 할 일 id. 첫 묶음은 null이다
  readonly afterTodoId: TodoId | null;
  readonly limit: number;
}

/**
 * 가져온 일정과 만든 할 일의 연결. 할 일을 지우면 FK로 함께 지워져 같은 일정을 다시 가져올 수 있다.
 * 활성 UoW 안에서 부른다.
 */
export abstract class TodoImportLinkRepositoryPort {
  /** 이미 할 일로 만든 sourceKey */
  abstract listLinkedSourceKeys(
    userId: UserId,
    sourceKeys: readonly string[],
  ): Promise<ReadonlySet<string>>;
  abstract insertMany(links: readonly TodoImportLink[]): Promise<void>;
  // 할 일 id 오름차순이다
  abstract listTodoIds(query: LinkedTodoPageQuery): Promise<TodoId[]>;
  abstract countByImportId(importId: TodoImportId): Promise<number>;
}
