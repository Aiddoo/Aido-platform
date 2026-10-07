import type { Todo } from "@aido/api";

import type { CreateRecurringTodoData, CreateTodoData } from "../../models/todos/todo.types.js";
import type { CreateRecurringTodosResult } from "../../use-cases/todos/create-recurring-todos.use-case.js";

export const TODO_CREATOR = Symbol("TODO_CREATOR");

export interface TodoCreatorPort {
  createTodo(input: CreateTodoData): Promise<Todo>;
  createRecurringTodos(
    input: CreateRecurringTodoData,
    timezone: string,
  ): Promise<CreateRecurringTodosResult>;
}
