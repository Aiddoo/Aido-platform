import {
  type ChangeTodoCategoryInput,
  dailyCompletionsRangeResponseSchema,
  deleteTodoResponseSchema,
  friendTodoListResponseSchema,
  type GetTodosQuery,
  type ReorderTodoInput,
  type ToggleTodoCompleteInput,
  todoOverviewResponseSchema,
  todoSummaryResponseSchema,
  type UpdateTodoInput,
  type UpdateTodoScheduleInput,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import type { DailyCompletionsResult } from '../domains/daily-completion.model';
import type { TodoEditScope, TodoUpdateScope } from '../domains/todo-repeat.model';
import type { TodoSeries } from '../domains/todo-series.model';
import type {
  Todo,
  TodoDetails,
  TodoOverview,
  TodoSummary,
  TodoListResult,
} from '../domains/todo.model';
import type { TodoFormValues } from '../schemas/todo-form.schema';
import {
  createRepeatingTodoEnvelopeSchema,
  createTodoEnvelopeSchema,
  reorderTodoEnvelopeSchema,
  todoDetailsEnvelopeSchema,
  todoListEnvelopeSchema,
  updateTodoEnvelopeSchema,
} from '../schemas/todo-response.schema';
import type { TodoSeriesEditOptions } from '../schemas/todo-series-request.schema';
import {
  toFollowingCategoryRequest,
  toFollowingScheduleRequest,
  toTodoSeries,
  toUpdateTodoRequest,
} from './todo-series.mapper';
import {
  toCreateTodoRequest,
  toDailyCompletionsResult,
  toFriendTodoListResult,
  toTodo,
  toTodoDetails,
  toTodoListResult,
  toTodoOverview,
  toTodoSummary,
} from './todo.mapper';

export class TodoApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getTodos = async (
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoListResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos', {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        completed: params.completed,
        categoryId: params.categoryId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    return parseApiResponse(
      result,
      todoListEnvelopeSchema,
      toTodoListResult,
      '[TodoApi] Invalid getTodos response',
    );
  };

  getTodoOverview = async (signal?: AbortSignal): Promise<Result<TodoOverview, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos/overview', { signal });

    return parseApiResponse(
      result,
      todoOverviewResponseSchema,
      toTodoOverview,
      '[TodoApi] Invalid getTodoOverview response',
    );
  };

  getFriendTodos = async (
    friendUserId: string,
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoListResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/todos/friends/${friendUserId}`, {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    return parseApiResponse(
      result,
      friendTodoListResponseSchema,
      toFriendTodoListResult,
      '[TodoApi] Invalid getFriendTodos response',
    );
  };

  toggleTodoComplete = async (
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/complete`, body);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid toggleTodoComplete response',
    );
  };

  createTodo = async (values: TodoFormValues): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', toCreateTodoRequest(values));

    return parseApiResponse(
      result,
      createTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid createTodo response',
    );
  };

  updateTodo = async (
    todoId: number,
    input: UpdateTodoInput,
    options: TodoSeriesEditOptions = {},
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(
      `v1/todos/${todoId}`,
      toUpdateTodoRequest(input, options),
    );

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid updateTodo response',
    );
  };

  updateTodoSchedule = async (
    todoId: number,
    input: UpdateTodoScheduleInput,
    scope?: TodoUpdateScope,
  ): Promise<Result<Todo, ApiError>> => {
    const result =
      scope === 'THIS_AND_FOLLOWING'
        ? await this.#httpClient.patch(`v1/todos/${todoId}`, toFollowingScheduleRequest(input))
        : await this.#httpClient.patch(`v1/todos/${todoId}/schedule`, input);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid updateTodoSchedule response',
    );
  };

  deleteTodo = async (todoId: number, scope?: TodoEditScope): Promise<Result<void, ApiError>> => {
    const result =
      scope == null
        ? await this.#httpClient.delete(`v1/todos/${todoId}`)
        : await this.#httpClient.delete(`v1/todos/${todoId}`, { params: { scope } });

    return parseApiResponse(
      result,
      deleteTodoResponseSchema,
      noop,
      '[TodoApi] Invalid deleteTodo response',
    );
  };

  getDailyCompletions = async (
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/daily-completions', {
      signal,
      params: { startDate, endDate },
    });

    return parseApiResponse(
      result,
      dailyCompletionsRangeResponseSchema,
      toDailyCompletionsResult,
      '[TodoApi] Invalid getDailyCompletions response',
    );
  };

  /** 친구의 일일 완료 현황 — 공개(PUBLIC) 할 일 기준 집계 (친구 캘린더 마커용) */
  getFriendDailyCompletions = async (
    friendUserId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/daily-completions/friends/${friendUserId}`, {
      signal,
      params: { startDate, endDate },
    });

    return parseApiResponse(
      result,
      dailyCompletionsRangeResponseSchema,
      toDailyCompletionsResult,
      '[TodoApi] Invalid getFriendDailyCompletions response',
    );
  };

  /** 하루의 할 일 요약 (홈 위젯 스냅샷) — 서버는 기기 시간대 기준 오늘·내일만 허용한다 */
  getTodoSummary = async (
    date: string,
    signal?: AbortSignal,
  ): Promise<Result<TodoSummary, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos/summary', { signal, params: { date } });

    return parseApiResponse(
      result,
      todoSummaryResponseSchema,
      toTodoSummary,
      '[TodoApi] Invalid getTodoSummary response',
    );
  };

  createRepeatingTodo = async (
    values: TodoFormValues,
  ): Promise<Result<{ todo: Todo; series: TodoSeries }, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', toCreateTodoRequest(values));

    return parseApiResponse(
      result,
      createRepeatingTodoEnvelopeSchema,
      ({ todo, series }) => ({ todo: toTodo(todo), series: toTodoSeries(series) }),
      '[TodoApi] Invalid createRepeatingTodo response',
    );
  };

  /** 이 회차 뒤로 반복을 끝낸다. 이미 끝났으면 서버가 TODO_0846으로 알린다 */
  stopTodoSeries = async (todoId: number): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(
      `v1/todos/${todoId}`,
      toUpdateTodoRequest({}, { repeat: null }),
    );

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid stopTodoSeries response',
    );
  };

  reorderTodo = async (
    todoId: number,
    input: ReorderTodoInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/reorder`, input);

    return parseApiResponse(
      result,
      reorderTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid reorderTodo response',
    );
  };

  getTodoDetails = async (
    todoId: number,
    signal?: AbortSignal,
  ): Promise<Result<TodoDetails, ApiError>> => {
    const response = await this.#httpClient.get(`v1/todos/${todoId}/details`, { signal });

    return parseApiResponse(
      response,
      todoDetailsEnvelopeSchema,
      toTodoDetails,
      '[TodoApi] Invalid todo details',
    );
  };

  changeTodoCategory = async (
    todoId: number,
    input: ChangeTodoCategoryInput,
    scope?: TodoUpdateScope,
  ): Promise<Result<Todo, ApiError>> => {
    const result =
      scope === 'THIS_AND_FOLLOWING'
        ? await this.#httpClient.patch(`v1/todos/${todoId}`, toFollowingCategoryRequest(input))
        : await this.#httpClient.patch(`v1/todos/${todoId}/category`, input);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoApi] Invalid changeTodoCategory response',
    );
  };
}
