import { TodoReminderReaderPort } from "#api/modules/notification/reminders/application/ports/todo-reminder-reader.port";
import type { ActiveTodo } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";
import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";

// 넣어 둔 할 일만 아직 보낼 할 일로 답한다. failWith를 두면 조회가 그 오류로 실패한다
export class StubTodoReminderReader extends TodoReminderReaderPort {
  readonly todos = new Map<number, ActiveTodo>();
  failWith: Error | null = null;

  async findActiveTodo(todo: TodoId): Promise<ActiveTodo | null> {
    const todoId = todo.value;
    if (this.failWith != null) {
      throw this.failWith;
    }
    return this.todos.get(todoId) ?? null;
  }
}
