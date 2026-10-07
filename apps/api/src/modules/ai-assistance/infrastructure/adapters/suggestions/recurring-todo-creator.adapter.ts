import { Inject, Injectable } from "@nestjs/common";

import { TODO_CREATOR, type TodoCreatorPort } from "#api/modules/planning/planning-todos.public";

import type {
  CreateRecurringTodoInput,
  RecurringTodoCreatorPort,
} from "../../../application/ports/suggestions/recurring-todo-creator.port.js";

@Injectable()
export class RecurringTodoCreatorAdapter implements RecurringTodoCreatorPort {
  constructor(
    @Inject(TODO_CREATOR)
    private readonly todoCreator: Pick<TodoCreatorPort, "createRecurringTodos">,
  ) {}

  async createRecurring(
    input: CreateRecurringTodoInput,
    timezone: string,
  ): Promise<{ count: number }> {
    const result = await this.todoCreator.createRecurringTodos(input, timezone);
    return { count: result.count };
  }
}
