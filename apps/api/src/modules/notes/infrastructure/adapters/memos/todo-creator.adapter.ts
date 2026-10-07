import type { Todo as TodoResponse } from "@aido/api";
import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateRecurringTodosResult,
  TODO_CREATOR,
  type TodoCreatorPort as PlanningTodoCreatorPort,
} from "#api/modules/planning/planning-todos.public";

import type {
  CreateRecurringTodoData,
  CreateTodoData,
  TodoCreatorPort,
} from "../../../application/ports/memos/todo-creator.port.js";

@Injectable()
export class TodoCreatorAdapter implements TodoCreatorPort {
  constructor(
    @Inject(TODO_CREATOR)
    private readonly todoCreator: PlanningTodoCreatorPort,
  ) {}

  createTodo(data: CreateTodoData): Promise<TodoResponse> {
    return this.todoCreator.createTodo(data);
  }

  createRecurringTodos(
    data: CreateRecurringTodoData,
    timezone: string,
  ): Promise<CreateRecurringTodosResult> {
    return this.todoCreator.createRecurringTodos(data, timezone);
  }
}
