import type { TodoRepeat, Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { TodoUpdateScope } from "@aido/api/vocabulary";

import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { TodoRescheduledEvent } from "../../../domain/events/todos/todo-rescheduled.event.js";
import type { UpdateTodoData } from "../../models/todos/todo.types.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { StartSeriesFromTodo } from "../series/start-series-from-todo.use-case.js";
import type { StopTodoSeries } from "../series/stop-todo-series.use-case.js";
import type { UpdateFollowingTodos } from "../series/update-following-todos.use-case.js";
import type { UpdateTodo } from "./update-todo.use-case.js";

export interface EditTodoInput {
  readonly id: number;
  readonly userId: string;
  readonly timezone: string;
  readonly scope?: TodoUpdateScope;
  /** 생략은 변경 없음, null은 이 회차 뒤로 반복 끝내기, 값은 전환이나 범위 수정의 새 규칙이다. */
  readonly repeat?: TodoRepeat | null;
  readonly checklist?: readonly { readonly title: string }[];
  readonly data: UpdateTodoData;
}

interface EditTodoDependencies {
  readonly updateTodo: Pick<UpdateTodo, "execute" | "apply" | "publish">;
  readonly updateFollowingTodos: Pick<UpdateFollowingTodos, "execute" | "apply" | "publish">;
  readonly startSeriesFromTodo: Pick<StartSeriesFromTodo, "assertCanStart" | "apply" | "publish">;
  readonly stopTodoSeries: Pick<StopTodoSeries, "apply" | "publish">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

/**
 * PATCH /todos/:id 하나를 한 트랜잭션으로 처리한다. 요청 모양으로 경로를 고르고, 여러 변경이
 * 함께 오면 한 UoW에서 저장해 일부만 반영되는 일이 없게 한다. 효과는 커밋 뒤에 낸다.
 */
export class EditTodo {
  readonly #dependencies: EditTodoDependencies;

  constructor(dependencies: EditTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: EditTodoInput): Promise<TodoResponse> {
    const { scope, repeat, checklist } = input;
    if (checklist != null && scope !== "THIS_AND_FOLLOWING") {
      throw new ApplicationException(ErrorCode.TODO_0845, { field: "checklist" });
    }
    // nullish-strict: repeat null은 반복 끝내기라 범위를 고른 수정이 아니다
    if (scope === "THIS_AND_FOLLOWING" && repeat !== null) {
      return this.#editFollowing(input, repeat);
    }
    if (repeat != null) {
      if (scope != null) {
        throw new ApplicationException(ErrorCode.TODO_0845, { field: "scope" });
      }
      return this.#startSeries(input, repeat);
    }
    // nullish-strict: repeat null은 반복 끝내기, undefined는 변경 없음이다
    if (repeat === null) {
      return this.#stopSeries(input);
    }
    const { id, userId, timezone, data } = input;
    return this.#dependencies.updateTodo.execute({ id, userId, timezone, scope, data });
  }

  async #editFollowing(input: EditTodoInput, repeat: TodoRepeat | undefined) {
    const { id, userId, timezone, checklist, data } = input;
    const { updateFollowingTodos, updateTodo, unitOfWork } = this.#dependencies;
    const followingInput = {
      id,
      userId,
      title: data.title,
      categoryId: data.categoryId,
      visibility: data.visibility,
      scheduledTime: data.scheduledTime,
      isAllDay: data.isAllDay,
      repeat,
      checklist,
    };
    const { startDate, endDate, completed } = data;
    // nullish-strict: endDate null도 이 회차의 변경이다
    if (startDate == null && endDate === undefined && completed == null) {
      return updateFollowingTodos.execute(followingInput);
    }
    // 날짜 이동·완료는 범위와 상관없이 이 회차에만 적용한다.
    const applied = await unitOfWork.run(async () => {
      await this.#acquireLocks(id, userId);
      const following = await updateFollowingTodos.apply(followingInput);
      const thisOnly = await updateTodo.apply({
        id: following.responseTodoId,
        userId,
        timezone,
        data: { startDate, endDate, completed },
      });
      return { following, thisOnly };
    });
    await updateFollowingTodos.publish(applied.following, userId);
    await updateTodo.publish(applied.thisOnly);
    return this.#read(applied.following.responseTodoId, userId);
  }

  async #startSeries(input: EditTodoInput, repeat: TodoRepeat) {
    const { id, userId, timezone, data } = input;
    const { startSeriesFromTodo, updateTodo, unitOfWork } = this.#dependencies;
    const applied = await unitOfWork.run(async () => {
      await this.#acquireLocks(id, userId);
      await startSeriesFromTodo.assertCanStart(id, userId);
      const updated = await updateTodo.apply({ id, userId, timezone, data });
      const started = await startSeriesFromTodo.apply({ todoId: id, userId, repeat, timezone });
      return { updated, started };
    });
    await updateTodo.publish({
      ...applied.updated,
      // 첫 회차의 예약은 전환이 이미 새 날짜로 다시 잡았다. 옛 시각으로 덮지 않는다.
      events: applied.updated.events.filter((event) => !(event instanceof TodoRescheduledEvent)),
    });
    await startSeriesFromTodo.publish(applied.started);
    return this.#read(id, userId);
  }

  async #stopSeries(input: EditTodoInput) {
    const { id, userId, timezone, data } = input;
    const { stopTodoSeries, updateTodo, unitOfWork } = this.#dependencies;
    const applied = await unitOfWork.run(async () => {
      await this.#acquireLocks(id, userId);
      const stopped = await stopTodoSeries.apply({ todoId: id, userId });
      const updated = await updateTodo.apply({ id, userId, timezone, data });
      return { stopped, updated };
    });
    await stopTodoSeries.publish(applied.stopped);
    await updateTodo.publish(applied.updated);
    return this.#read(id, userId);
  }

  /** 단계마다 따로 잠그면 다른 요청과 순서가 엇갈릴 수 있어 쓸 잠금을 정렬해 한 번에 잡는다. */
  #acquireLocks(id: number, userId: string): Promise<void> {
    return this.#dependencies.mutationLock.acquire([
      MutationLockKeys.todoCategory(userId),
      MutationLockKeys.todoSortOrder(userId),
      MutationLockKeys.todo(id),
    ]);
  }

  async #read(id: number, userId: string): Promise<TodoResponse> {
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
