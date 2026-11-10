/**
 * Todo 삭제 도메인 이벤트
 *
 * 삭제(DELETE /todos/:id) 완료 시 발행됩니다. 리마인더 취소 부수효과가 동작합니다.
 */
import { TODO_EVENTS } from "./todo-event-names.constants.js";

export class TodoDeletedEvent {
  readonly eventName = TODO_EVENTS.DELETED;

  readonly todoId: number;
  readonly userId: string;

  constructor(todoId: number, userId: string) {
    this.todoId = todoId;
    this.userId = userId;
  }
}
