import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type {
  CreatedOccurrence,
  TodoRepositoryPort,
} from "../../../todos/application/ports/todo.repository.port.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import { RepeatRule, type RepeatSpec } from "../../domain/repeat-rule.vo.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import { TodoSeries } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import type { MaterializeTodoOccurrencesUseCase } from "./materialize-todo-occurrences.use-case.js";
import type { PublishTodoCreationUseCase } from "./publish-todo-creation.use-case.js";

export interface StartSeriesFromTodoInput {
  readonly todoId: number;
  readonly userId: string;
  readonly repeat: RepeatSpec;
  readonly timezone: string;
}

export interface StartedSeriesFromTodo {
  readonly series: TodoSeries;
  readonly occurrences: readonly CreatedOccurrence[];
}

interface StartSeriesFromTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "attachToSeries">;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId" | "insert">;
  readonly materializer: Pick<MaterializeTodoOccurrencesUseCase, "planFirstRun" | "persist">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders" | "scheduleReminders">;
  readonly effects: Pick<PublishTodoCreationUseCase, "publishSeriesStarted">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
}

/** 단일 할 일에 반복을 더한다. 그 할 일이 첫 회차가 되어 id·댓글·진행을 유지한다. */
export class StartSeriesFromTodoUseCase {
  readonly #dependencies: StartSeriesFromTodoDependencies;

  constructor(dependencies: StartSeriesFromTodoDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * 활성 UoW 안에서 상태만 먼저 확인한다. 다른 필드와 함께 온 PATCH가 쓰기 전에 거절되게 한다.
   * 이미 반복인 회차의 규칙을 바꾸는 것은 범위를 고른 수정이다.
   */
  async assertCanStart(todoId: number, userId: string): Promise<void> {
    const { todoRepository, seriesRepository } = this.#dependencies;
    const ownerId = UserId.reconstitute(userId);
    const todo = await todoRepository.findByIdAndUserId(TodoId.reconstitute(todoId), ownerId);
    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    if (todo.seriesId != null) {
      throw new ApplicationException(ErrorCode.TODO_0845, { field: "scope" });
    }
    const activeCount = await seriesRepository.countActiveByUserId(ownerId);
    if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
      throw new ApplicationException(ErrorCode.TODO_0842, {
        limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER,
        activeCount,
      });
    }
  }

  /** 활성 UoW 안에서 호출한다. */
  async apply(input: StartSeriesFromTodoInput): Promise<StartedSeriesFromTodo> {
    const { todoId, userId, repeat, timezone } = input;
    const { todoRepository, seriesRepository, materializer, todoReminder, mutationLock } =
      this.#dependencies;
    await mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
      TodoLockKeys.todo(todoId),
    ]);
    await this.assertCanStart(todoId, userId);
    const todo = await todoRepository.findByIdAndUserId(
      TodoId.reconstitute(todoId),
      UserId.reconstitute(userId),
    );
    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    const scheduledLocalTime = todo.localTimeIn(timezone);
    const now = this.#dependencies.clock.now();
    const startDate = todo.schedule.startDate.toString();
    const series = TodoSeries.create({
      id: TodoSeriesId.generate(),
      userId: todo.userId,
      categoryId: todo.categoryId,
      title: todo.title,
      visibility: todo.visibility,
      scheduledLocalTime,
      timezone,
      rule: RepeatRule.create(repeat),
      startDate,
      checklistTemplate: todo.items.map((item) => ({ title: item.title.value })),
      now,
    });
    series.assertWithinPastLimit(now);
    const drafts = materializer.planFirstRun(series, now);
    const [first, ...following] = drafts;
    if (first == null) {
      throw new ApplicationException(ErrorCode.TODO_0843, { startDate, repeat });
    }
    await seriesRepository.insert(series);
    // 시작일이 규칙에 맞지 않으면 다음 맞는 날로 옮겨 그 할 일을 첫 회차로 쓴다.
    const firstTime = resolveScheduledInstant(first.occurrenceDate, scheduledLocalTime, timezone);
    await todoRepository.attachToSeries(todo.id, series.id, {
      occurrenceDate: first.occurrenceDate,
      scheduledLocalTime,
      scheduledTime: firstTime,
    });
    // 첫 회차 날짜가 옮겨졌을 수 있어 옛 시각의 예약을 지우고 새 시각으로 다시 잡는다.
    await todoReminder.cancelReminders([todoId]);
    if (firstTime != null && !todo.completed) {
      await todoReminder.scheduleReminders([{ todoId, scheduledTime: firstTime, userId }]);
    }
    const occurrences = await materializer.persist(series, following);
    return { series, occurrences };
  }

  publish(started: StartedSeriesFromTodo): Promise<void> {
    return this.#dependencies.effects.publishSeriesStarted(started.series, started.occurrences);
  }
}
