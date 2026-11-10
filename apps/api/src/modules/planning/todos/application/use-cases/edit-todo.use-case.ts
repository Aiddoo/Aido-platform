import { ErrorCode } from "@aido/api/errors";
import type { TodoUpdateScope } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import type { StartSeriesFromTodoUseCase } from "../../../todo-series/application/use-cases/start-series-from-todo.use-case.js";
import type { StopTodoSeriesUseCase } from "../../../todo-series/application/use-cases/stop-todo-series.use-case.js";
import type { UpdateFollowingTodosUseCase } from "../../../todo-series/application/use-cases/update-following-todos.use-case.js";
import type { RepeatSpec } from "../../../todo-series/domain/repeat-rule.vo.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";
import type { ResolveTodoTimezoneUseCase } from "./resolve-todo-timezone.use-case.js";
import type { UpdateTodoData } from "./update-todo.use-case.js";
import type { UpdateTodoUseCase } from "./update-todo.use-case.js";

export interface EditTodoInput {
  readonly id: number;
  readonly userId: string;
  /** 요청의 시간대. 없거나 잘못되면 저장된 사용자 시간대로 해석한다. */
  readonly timezone: string | undefined;
  readonly scope?: TodoUpdateScope;
  /** 생략은 변경 없음, null은 이 회차 뒤로 반복 끝내기, 값은 전환이나 범위 수정의 새 규칙이다. */
  readonly repeat?: RepeatSpec | null;
  readonly checklist?: readonly { readonly title: string }[];
  readonly data: UpdateTodoData;
}

interface EditTodoDependencies {
  readonly updateTodo: Pick<UpdateTodoUseCase, "execute" | "apply" | "publish">;
  readonly updateFollowingTodos: Pick<UpdateFollowingTodosUseCase, "execute" | "apply" | "publish">;
  readonly startSeriesFromTodo: Pick<
    StartSeriesFromTodoUseCase,
    "assertCanStart" | "apply" | "publish"
  >;
  readonly stopTodoSeries: Pick<StopTodoSeriesUseCase, "apply" | "publish">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly timezoneResolver: Pick<ResolveTodoTimezoneUseCase, "execute">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

interface ResolvedEditTodoInput extends EditTodoInput {
  readonly timezone: string;
}

/**
 * PATCH /todos/:id 하나를 한 트랜잭션으로 처리한다. 요청 모양으로 경로를 고르고, 여러 변경이
 * 함께 오면 한 UoW에서 저장해 일부만 반영되는 일이 없게 한다. 효과는 커밋 뒤에 낸다.
 */
export class EditTodoUseCase {
  readonly #dependencies: EditTodoDependencies;

  constructor(dependencies: EditTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(request: EditTodoInput): Promise<TodoReadModel> {
    const timezone = await this.#dependencies.timezoneResolver.execute(
      request.userId,
      request.timezone,
    );
    const input = { ...request, timezone };
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
    const { id, userId, data } = input;
    return this.#dependencies.updateTodo.execute({ id, userId, timezone, scope, data });
  }

  async #editFollowing(input: ResolvedEditTodoInput, repeat: RepeatSpec | undefined) {
    const { id, userId, timezone, checklist, data } = input;
    const { updateFollowingTodos, updateTodo, unitOfWork, applyTodoEvents } = this.#dependencies;
    const followingInput = {
      id,
      userId,
      timezone,
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
      await applyTodoEvents.execute(thisOnly.events);
      return { following, thisOnly };
    });
    await updateFollowingTodos.publish(applied.following, userId);
    await updateTodo.publish(applied.thisOnly);
    return this.#read(applied.following.responseTodoId, userId);
  }

  async #startSeries(input: ResolvedEditTodoInput, repeat: RepeatSpec) {
    const { id, userId, timezone, data } = input;
    const { startSeriesFromTodo, updateTodo, unitOfWork, applyTodoEvents } = this.#dependencies;
    const applied = await unitOfWork.run(async () => {
      await this.#acquireLocks(id, userId);
      await startSeriesFromTodo.assertCanStart(id, userId);
      const updated = await updateTodo.apply({ id, userId, timezone, data });
      // 첫 회차의 예약은 전환이 새 날짜로 다시 잡는다. 옛 시각으로 예약하거나 알리지 않는다.
      const events = updated.events.filter((event) => !(event instanceof TodoRescheduledEvent));
      const started = await startSeriesFromTodo.apply({ todoId: id, userId, repeat, timezone });
      // 옛 커밋 뒤 순서와 같게 전환 뒤에 반영한다(완료와 함께 전환하면 첫 회차 예약이 취소된다)
      await applyTodoEvents.execute(events);
      return { updated: { ...updated, events }, started };
    });
    await updateTodo.publish(applied.updated);
    await startSeriesFromTodo.publish(applied.started);
    return this.#read(id, userId);
  }

  async #stopSeries(input: ResolvedEditTodoInput) {
    const { id, userId, timezone, data } = input;
    const { stopTodoSeries, updateTodo, unitOfWork, applyTodoEvents } = this.#dependencies;
    const applied = await unitOfWork.run(async () => {
      await this.#acquireLocks(id, userId);
      const stopped = await stopTodoSeries.apply({ todoId: id, userId });
      const updated = await updateTodo.apply({ id, userId, timezone, data });
      await applyTodoEvents.execute(updated.events);
      return { stopped, updated };
    });
    await stopTodoSeries.publish(applied.stopped);
    await updateTodo.publish(applied.updated);
    return this.#read(id, userId);
  }

  /** 단계마다 따로 잠그면 다른 요청과 순서가 엇갈릴 수 있어 쓸 잠금을 정렬해 한 번에 잡는다. */
  #acquireLocks(id: number, userId: string): Promise<void> {
    return this.#dependencies.mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
      TodoLockKeys.todo(id),
    ]);
  }

  async #read(id: number, userId: string): Promise<TodoReadModel> {
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
