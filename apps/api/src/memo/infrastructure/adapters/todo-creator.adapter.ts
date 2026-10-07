import type { Todo as TodoResponse } from "@aido/api";
import { Injectable } from "@nestjs/common";

import {
  type CreateRecurringTodosResult,
  CreateRecurringTodosUseCase,
  CreateTodoUseCase,
} from "#api/todo/index";

import type {
  CreateRecurringTodoData,
  CreateTodoData,
  TodoCreatorPort,
} from "../../application/ports/todo-creator.port.js";

/**
 * Memo가 요구하는 생성 계약을 Todo의 생성 UseCase에 연결한다.
 */
@Injectable()
export class TodoCreatorAdapter implements TodoCreatorPort {
  constructor(
    private readonly createTodoUseCase: CreateTodoUseCase,
    private readonly createRecurringTodosUseCase: CreateRecurringTodosUseCase,
  ) {}

  createTodo(data: CreateTodoData): Promise<TodoResponse> {
    return this.createTodoUseCase.execute(data);
  }

  createRecurringTodos(
    data: CreateRecurringTodoData,
    timezone: string,
  ): Promise<CreateRecurringTodosResult> {
    return this.createRecurringTodosUseCase.execute({ data, timezone });
  }
}
