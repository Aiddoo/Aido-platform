import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import { todoNotFound } from "../../../todos/application/todos.errors.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import { TodoSchedule } from "../../../todos/domain/todo-schedule.vo.js";
import { RepeatRule, type RepeatSpec } from "../../domain/repeat-rule.vo.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import { TodoSeries } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { noRepeatDates } from "../todo-series.errors.js";
import type { CheckTodoSeriesStartUseCase } from "./check-todo-series-start.use-case.js";
import type { MaterializeTodoOccurrencesUseCase } from "./materialize-todo-occurrences.use-case.js";
import type { StartedTodoSeries } from "./publish-todo-series-started.use-case.js";

export interface StartSeriesFromTodoInput {
  readonly todoId: number;
  readonly userId: string;
  readonly repeat: RepeatSpec;
  readonly timezone: string;
}

interface StartSeriesFromTodoDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "lockByIdAndUserId" | "save">;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "insert">;
  readonly checkStart: Pick<CheckTodoSeriesStartUseCase, "execute">;
  readonly materializer: Pick<MaterializeTodoOccurrencesUseCase, "execute">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders" | "scheduleReminders">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
}

/**
 * 단일 할 일에 반복을 더한다. 그 할 일이 첫 회차가 되어 id·댓글·진행을 유지한다. 활성 UoW 안에서 호출하고
 * 커밋 뒤 효과는 PublishTodoSeriesStartedUseCase가 낸다.
 */
export class StartSeriesFromTodoUseCase {
  readonly #dependencies: StartSeriesFromTodoDependencies;

  constructor(dependencies: StartSeriesFromTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StartSeriesFromTodoInput): Promise<StartedTodoSeries> {
    const { todoId, userId, repeat, timezone } = input;
    const { todoRepository, seriesRepository, materializer, mutationLock } = this.#dependencies;
    await mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
      TodoLockKeys.todo(todoId),
    ]);
    await this.#dependencies.checkStart.execute({ todoId, userId });
    const todo = await todoRepository.lockByIdAndUserId(
      TodoId.reconstitute(todoId),
      UserId.reconstitute(userId),
    );
    if (todo == null) {
      throw todoNotFound(todoId);
    }
    const { scheduledLocalTime } = todo.schedule;
    const now = this.#dependencies.clock.now();
    const { startDate } = todo.schedule;
    const series = TodoSeries.create({
      id: TodoSeriesId.generate(),
      userId: todo.userId,
      categoryId: todo.categoryId.value,
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
    const [first, ...following] = series.planFirstRun(now);
    if (first == null) {
      throw noRepeatDates(startDate.toString(), repeat);
    }
    await seriesRepository.insert(series);
    // 시작일이 규칙에 맞지 않으면 다음 맞는 날로 옮겨 그 할 일을 첫 회차로 쓴다
    const { occurrenceDate } = first;
    const schedule = TodoSchedule.create({
      startDate: occurrenceDate,
      endDate: null,
      scheduledLocalTime,
      isAllDay: scheduledLocalTime == null,
      timezone,
    });
    todo.attachToSeries({ seriesId: series.id, occurrenceDate, schedule, now });
    await todoRepository.save(todo);
    const firstTime = schedule.scheduledTime;
    // 첫 회차 날짜가 옮겨졌을 수 있어 옛 시각의 예약을 지우고 새 시각으로 다시 잡는다.
    await this.#dependencies.todoReminder.cancelReminders([todo.id]);
    if (firstTime != null && !todo.isCompleted()) {
      await this.#dependencies.todoReminder.scheduleReminders([
        { todoId: todo.id, scheduledTime: firstTime, userId: todo.userId },
      ]);
    }
    const occurrences = await materializer.execute({ series, drafts: following });
    return { series, createdCount: occurrences.length };
  }
}
