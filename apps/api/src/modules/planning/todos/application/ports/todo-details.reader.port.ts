import type { FriendTodoReadModel } from "../read-models/todo.read-model.js";

export interface TodoAccessView {
  readonly ownerId: string;
  readonly visibility: FriendTodoReadModel["visibility"];
}

export interface TodoDetailsView {
  readonly todo: FriendTodoReadModel;
  readonly viewCount: number;
}

/** 다른 Context(engagement 댓글·상세)가 할 일 테이블을 직접 읽지 않고 할 일 하나를 받는 조회 포트 */
export abstract class TodoDetailsReaderPort {
  /** 주인과 공개 범위. 접근 판단은 읽는 쪽이 한다 */
  abstract findAccess(todoId: number): Promise<TodoAccessView | null>;
  /** 카테고리와 하위 항목(정렬 순서, 같으면 id 순)을 담은 할 일 */
  abstract findDetails(todoId: number): Promise<TodoDetailsView | null>;
}
