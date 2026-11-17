import { SnoozeTodoReaderPort } from "#api/modules/notification/reminders/application/ports/snooze-todo.reader.port";
import type { SnoozeTodoReadModel } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";
import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";

// 넣어 둔 할 일만 있는 할 일로 답한다
export class StubSnoozeTodoReader extends SnoozeTodoReaderPort {
  readonly todos = new Map<number, SnoozeTodoReadModel>();

  async findTodo(todoId: TodoId): Promise<SnoozeTodoReadModel | null> {
    return this.todos.get(todoId.value) ?? null;
  }
}
