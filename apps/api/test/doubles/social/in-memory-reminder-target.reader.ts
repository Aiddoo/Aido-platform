import { ReminderTargetReaderPort } from "#api/modules/social/reminder-nudges/application/ports/reminder-target.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { ReminderTargetTodoSeed } from "#test/fixtures/social/reminder-nudge.fixture";

export class InMemoryReminderTargetReader extends ReminderTargetReaderPort {
  readonly #todos: ReminderTargetTodoSeed[] = [];

  async addTodo(seed: ReminderTargetTodoSeed): Promise<void> {
    this.#todos.push(seed);
  }

  async countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return this.#todos.filter(
      (todo) =>
        todo.ownerId === ownerId.value &&
        (todo.endDate == null
          ? todo.startDate.equals(date)
          : Temporal.PlainDate.compare(todo.startDate, date) <= 0 &&
            Temporal.PlainDate.compare(date, todo.endDate) <= 0),
    ).length;
  }
}
