import { TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";

import type {
  MaterializeTodoOccurrencesUseCase,
  StartedTodoSeries,
  TodoSeriesRepositoryPort,
} from "#api/modules/planning/todo-series/planning-todo-series.public";
import {
  invalidRepeatRule,
  RepeatRule,
  type RepeatSpec,
  TodoSeries,
  TodoSeriesId,
  todoSeriesLimitReached,
} from "#api/modules/planning/todo-series/planning-todo-series.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import type { CategoryOwnershipPort } from "../ports/category-ownership.port.js";
import type { ResolvedCreateTodoData } from "../ports/staged-todo-creator.port.js";
import type { TodoRepositoryPort } from "../ports/todo.repository.port.js";
import { recurringTodoCategoryLimitReached } from "../todos.errors.js";

export interface WriteTodoSeriesInput {
  readonly data: ResolvedCreateTodoData;
  readonly repeat: RepeatSpec;
}

interface WriteTodoSeriesDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "countCategoryUsage">;
  readonly todoSeriesRepository: Pick<TodoSeriesRepositoryPort, "countActiveByUserId" | "insert">;
  readonly occurrenceMaterializer: Pick<MaterializeTodoOccurrencesUseCase, "execute">;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly clock: ClockPort;
}

/** 상한 확인 → 규칙 저장 → 회차를 한 번에 만든다. 활성 UoW와 생성 잠금 안에서 호출한다. */
export class WriteTodoSeriesUseCase {
  readonly #dependencies: WriteTodoSeriesDependencies;

  constructor(dependencies: WriteTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(write: WriteTodoSeriesInput): Promise<StartedTodoSeries> {
    const { data: input, repeat } = write;
    const { userId, categoryId } = input;
    if (input.endDate != null) {
      throw invalidRepeatRule("endDate");
    }
    const now = this.#dependencies.clock.now();
    // 옛 순서 그대로 규칙 → 제목 → 체크리스트 순으로 검증한다
    const rule = RepeatRule.create(repeat);
    const title = TodoTitle.create(input.title);
    const series = TodoSeries.create({
      id: TodoSeriesId.generate(),
      userId,
      categoryId: categoryId.value,
      title,
      visibility: input.visibility ?? "PUBLIC",
      scheduledLocalTime: input.scheduledTime ?? null,
      timezone: input.timezone,
      rule,
      startDate: input.startDate,
      checklistTemplate: input.items ?? [],
      now,
    });
    series.assertWithinPastLimit(now);
    await this.#dependencies.categoryOwnership.validateOwnership(categoryId, userId);
    await this.#assertSeriesLimit(userId, input.usesLegacySeriesLimit === true);
    const activeInCategory = await this.#dependencies.todoRepository.countCategoryUsage(
      userId,
      categoryId,
    );
    if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw recurringTodoCategoryLimitReached(activeInCategory, TODO_LIMITS.MAX_PER_CATEGORY);
    }
    const drafts = series.planFirstRun(now);
    await this.#dependencies.todoSeriesRepository.insert(series);
    const occurrences = await this.#dependencies.occurrenceMaterializer.execute({
      series,
      drafts,
    });
    return { series, createdCount: occurrences.length };
  }

  async #assertSeriesLimit(userId: UserId, usesLegacyLimit: boolean): Promise<void> {
    const limit = usesLegacyLimit
      ? TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY
      : TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER;
    const activeCount = await this.#dependencies.todoSeriesRepository.countActiveByUserId(userId);
    if (activeCount < limit) {
      return;
    }
    if (usesLegacyLimit) {
      // 출시 앱은 TODO_0842를 몰라 SYS_0001로 보인다. 이 경로에서 이미 받는 한도 거절로 돌려준다.
      throw recurringTodoCategoryLimitReached(activeCount, limit);
    }
    throw todoSeriesLimitReached(limit, activeCount);
  }
}
