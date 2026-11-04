import { randomUUID } from "node:crypto";

import type { TodoRepeat, Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { RepeatRule } from "../../../domain/value-objects/series/repeat-rule.vo.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoOccurrenceMaterializer } from "../../services/series/todo-occurrence-materializer.service.js";
import type { TodoCreationEffects } from "../../services/todos/todo-creation-effects.service.js";

export interface StartSeriesFromTodoInput {
  readonly todoId: number;
  readonly userId: string;
  readonly repeat: TodoRepeat;
  readonly timezone: string;
}

interface StartSeriesFromTodoDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "attachToSeries" | "getMaxSortOrder"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId" | "insert">;
  readonly materializer: Pick<TodoOccurrenceMaterializer, "planFirstRun" | "persist">;
  readonly effects: Pick<TodoCreationEffects, "publishSeriesStarted">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

/** 단일 할 일에 반복을 더한다. 그 할 일이 첫 회차가 되어 id·댓글·진행을 유지한다. */
export class StartSeriesFromTodo {
  readonly #dependencies: StartSeriesFromTodoDependencies;

  constructor(dependencies: StartSeriesFromTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StartSeriesFromTodoInput): Promise<TodoResponse> {
    const { todoId, userId, repeat, timezone } = input;
    const { todoRepository, seriesRepository, materializer, unitOfWork, mutationLock } =
      this.#dependencies;
    const started = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todoSortOrder(userId),
        MutationLockKeys.todo(todoId),
      ]);
      const todo = await todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }
      if (todo.getSeriesId() != null) {
        // 이미 반복인 회차의 규칙을 바꾸는 것은 범위를 고른 수정이다.
        throw new ApplicationException(ErrorCode.TODO_0845, { field: "scope" });
      }
      const activeCount = await seriesRepository.countActiveByUserId(userId);
      if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
        throw new ApplicationException(ErrorCode.TODO_0842, {
          limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER,
          activeCount,
        });
      }
      const snapshot = todo.toPersistence();
      const scheduledLocalTime =
        snapshot.scheduledTime == null ? null : toLocalTimeString(snapshot.scheduledTime, timezone);
      const at = now();
      const startDate = toDateString(snapshot.startDate);
      const series = TodoSeries.planCreation({
        id: randomUUID(),
        userId,
        categoryId: snapshot.categoryId,
        title: snapshot.title,
        visibility: snapshot.visibility,
        scheduledLocalTime,
        timezone,
        rule: RepeatRule.from(repeat),
        startDate,
        checklistTemplate: todo.getItemTitles(),
        sortOrder: await todoRepository.getMaxSortOrder(userId),
        at,
      });
      const drafts = materializer.planFirstRun(series, at);
      const [first, ...following] = drafts;
      if (first == null) {
        throw new ApplicationException(ErrorCode.TODO_0843, { startDate, repeat });
      }
      await seriesRepository.insert(series);
      // 시작일이 규칙에 맞지 않으면 다음 맞는 날로 옮겨 그 할 일을 첫 회차로 쓴다.
      await todoRepository.attachToSeries(todoId, series.getId(), {
        occurrenceDate: first.occurrenceDate,
        scheduledTime:
          scheduledLocalTime == null
            ? null
            : parseLocalDateTime(first.occurrenceDate, scheduledLocalTime, timezone),
      });
      const occurrences = await materializer.persist(series, following);
      return { series, occurrences };
    });

    await this.#dependencies.effects.publishSeriesStarted(started.series, started.occurrences);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}
