import { randomUUID } from "node:crypto";

import type { TodoRepeat, Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { isEqual } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/index";

import type { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { occurrenceHorizon } from "../../../domain/policies/series/occurrence-horizon.policy.js";
import { RepeatRule } from "../../../domain/value-objects/series/repeat-rule.vo.js";
import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import type { CategoryOwnershipPort } from "../../ports/todos/category-ownership.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type {
  TodoReminderPort,
  TodoReminderSchedule,
} from "../../ports/todos/todo-reminder.port.js";
import type { OccurrenceTime, TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoOccurrenceMaterializer } from "../../services/series/todo-occurrence-materializer.service.js";
import type { TodoSeriesEditEffects } from "../../services/series/todo-series-edit-effects.service.js";

export interface UpdateFollowingTodosInput {
  readonly id: number;
  readonly userId: string;
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
  /** HH:mm. null은 시간 지우기, 생략은 유지다. */
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly repeat?: TodoRepeat;
  readonly checklist?: readonly { readonly title: string }[];
}

/** UoW 안에서 저장을 끝낸 결과. responseTodoId는 기준 회차가 다른 행으로 바뀌었을 때 그 행이다. */
export interface AppliedFollowingEdit {
  readonly source: TodoSeries;
  readonly target: TodoSeries;
  readonly split: boolean;
  readonly responseTodoId: number;
}

interface UpdateFollowingTodosDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    | "findByIdAndUserId"
    | "findOccurrencesFrom"
    | "updateFollowingOccurrences"
    | "updateOccurrenceTimes"
    | "reassignOccurrences"
    | "moveOccurrence"
    | "deleteMany"
    | "getMaxSortOrder"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "insert" | "update" | "countActiveByUserId"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly materializer: Pick<TodoOccurrenceMaterializer, "planFirstRun" | "persist">;
  readonly todoReminder: Pick<TodoReminderPort, "cancelReminders" | "scheduleReminders">;
  readonly effects: Pick<TodoSeriesEditEffects, "publish">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/**
 * 이 회차와 이후 미완료 회차를 함께 고친다. 제목·카테고리·공개·시간은 제자리 수정이고,
 * 규칙·체크리스트가 바뀌면 이 회차부터 새 규칙으로 나눈다. 기준이 첫 회차면 나누지 않는다.
 * 완료한 회차의 내용은 건드리지 않는다.
 */
export class UpdateFollowingTodos {
  readonly #dependencies: UpdateFollowingTodosDependencies;

  constructor(dependencies: UpdateFollowingTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateFollowingTodosInput): Promise<TodoResponse> {
    const { userId } = input;
    const edited = await this.#dependencies.unitOfWork.run(() => this.apply(input));
    await this.publish(edited, userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      edited.responseTodoId,
      userId,
    );
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: edited.responseTodoId });
    }
    return response;
  }

  /** 활성 UoW 안에서 호출한다. 이 회차의 날짜·완료 변경과 한 트랜잭션으로 묶을 때 EditTodo가 부른다. */
  async apply(input: UpdateFollowingTodosInput): Promise<AppliedFollowingEdit> {
    const { id, userId } = input;
    const { todoRepository, seriesRepository, mutationLock } = this.#dependencies;
    // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
    await mutationLock.acquire([
      MutationLockKeys.todoCategory(userId),
      MutationLockKeys.todoSortOrder(userId),
      MutationLockKeys.todo(id),
    ]);
    const todo = await todoRepository.findByIdAndUserId(id, userId);
    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    const seriesId = todo.getSeriesId();
    if (seriesId == null) {
      throw new ApplicationException(ErrorCode.TODO_0844, {
        todoId: id,
        scope: "THIS_AND_FOLLOWING",
      });
    }
    const series = await seriesRepository.lockForUpdate(seriesId);
    if (series == null || series.getUserId() !== userId) {
      throw new ApplicationException(ErrorCode.TODO_0841, { seriesId });
    }
    if (input.categoryId != null) {
      await this.#dependencies.categoryOwnership.validateOwnership(input.categoryId, userId);
    }
    const occurrenceDate = todo.getOccurrenceDate();
    if (occurrenceDate == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return this.#applyTo(input, series, toDateString(occurrenceDate));
  }

  async publish(edited: AppliedFollowingEdit, userId: string): Promise<void> {
    await this.#dependencies.effects.publish({
      seriesId: edited.target.getId(),
      userId,
      events: [...edited.source.pullDomainEvents(), ...edited.target.pullDomainEvents()],
    });
    if (edited.split) {
      this.#dependencies.logger.log({
        event: PlanningTodoSeriesLogEvent.SPLIT,
        seriesId: edited.source.getId(),
        newSeriesId: edited.target.getId(),
        userId,
      });
    }
  }

  async #applyTo(
    input: UpdateFollowingTodosInput,
    series: TodoSeries,
    pivot: string,
  ): Promise<AppliedFollowingEdit> {
    const { todoRepository, seriesRepository, materializer, todoReminder } = this.#dependencies;
    const at = now();
    const rule = input.repeat == null ? null : RepeatRule.from(input.repeat);
    const ruleChanged = rule != null && !rule.equals(series.getRule());
    const checklistChanged =
      input.checklist != null && !isEqual(input.checklist, series.getChecklistTemplate());
    const details = {
      title: input.title,
      categoryId: input.categoryId,
      visibility: input.visibility,
      scheduledLocalTime: resolveLocalTime(input),
    };

    let target = series;
    let split = false;
    if ((ruleChanged || checklistChanged) && pivot !== series.getStartDate()) {
      if (!series.isActive()) {
        await this.#assertSeriesLimit(series.getUserId());
      }
      target = series.splitFrom(
        pivot,
        { ...details, rule: ruleChanged ? rule : undefined, checklistTemplate: input.checklist },
        randomUUID(),
        await todoRepository.getMaxSortOrder(series.getUserId()),
        at,
      );
      split = true;
    } else {
      series.applyDetails(details);
      if (ruleChanged) {
        series.replaceRule(rule);
      }
      if (checklistChanged) {
        series.replaceChecklist(input.checklist ?? []);
      }
    }

    const cancelledTodoIds: number[] = [];
    const reminders: TodoReminderSchedule[] = [];
    let responseTodoId = input.id;

    if (ruleChanged || split) {
      const remapped = await this.#remapRows(input.id, series, target, pivot, at);
      cancelledTodoIds.push(...remapped.deletedTodoIds, ...remapped.movedTodoIds);
      reminders.push(...remapped.reminders);
      responseTodoId = remapped.responseTodoId;
    }

    await todoRepository.updateFollowingOccurrences(target.getId(), pivot, {
      title: input.title,
      categoryId: input.categoryId,
      visibility: input.visibility,
    });

    // nullish-strict: null은 시간 지우기, undefined는 시간을 건드리지 않은 수정이다
    if (details.scheduledLocalTime !== undefined) {
      const rescheduled = await this.#rescheduleRows(target, pivot, details.scheduledLocalTime);
      cancelledTodoIds.push(...rescheduled.map(({ todoId }) => todoId));
      reminders.push(
        ...rescheduled.flatMap(({ todoId, scheduledTime }) =>
          scheduledTime == null ? [] : [{ todoId, scheduledTime, userId: series.getUserId() }],
        ),
      );
    }

    const drafts = ruleChanged || split ? materializer.planFirstRun(target, at) : [];
    await seriesRepository.update(series);
    if (split) {
      await seriesRepository.insert(target);
    }
    await materializer.persist(target, drafts);
    // 지운 회차와 시각이 바뀐 회차의 예약을 지우고 새 시각으로 다시 잡는다. 행과 함께 커밋한다.
    await todoReminder.cancelReminders(cancelledTodoIds);
    await todoReminder.scheduleReminders(reminders);

    return { source: series, target, split, responseTodoId };
  }

  /**
   * 규칙이 바뀌면 이후 회차를 새 날짜에 맞춘다. 맞는 행은 id를 유지해 옮기고(댓글·진행 보존),
   * 맞지 않는 미완료 행은 지운다. 기준 회차만은 지우지 않고 첫 날짜로 옮긴다.
   */
  async #remapRows(
    pivotTodoId: number,
    source: TodoSeries,
    target: TodoSeries,
    pivot: string,
    at: Date,
  ) {
    const { todoRepository } = this.#dependencies;
    const rows = await todoRepository.findOccurrencesFrom(source.getId(), pivot);
    const lastRowDate = rows.at(-1)?.occurrenceDate ?? pivot;
    const horizon = occurrenceHorizon(target.getTimezone(), at);
    const through = lastRowDate > horizon ? lastRowDate : horizon;
    const dates = target.getRule().occurrencesBetween(target.getStartDate(), pivot, through, 0);
    const dateSet = new Set(dates);
    const firstDate = dates.at(0);

    const keep = rows.filter((row) => dateSet.has(row.occurrenceDate));
    const deletedTodoIds = new Set(
      rows
        .filter((row) => !dateSet.has(row.occurrenceDate) && !row.completed)
        .map((row) => row.todoId),
    );
    let responseTodoId = pivotTodoId;
    let pivotMoveDate: string | null = null;

    if (deletedTodoIds.has(pivotTodoId) && firstDate != null) {
      const occupant = keep.find((row) => row.occurrenceDate === firstDate);
      if (occupant?.completed === true) {
        // 첫 날짜를 이미 완료했으면 기록을 지키고 그 회차를 돌려준다.
        responseTodoId = occupant.todoId;
      } else {
        deletedTodoIds.delete(pivotTodoId);
        if (occupant != null) {
          deletedTodoIds.add(occupant.todoId);
        }
        pivotMoveDate = firstDate;
      }
    }
    // 유니크 인덱스 때문에 자리를 비운 뒤 기준 회차를 옮긴다.
    await todoRepository.deleteMany([...deletedTodoIds]);

    const movedTodoIds: number[] = [];
    const reminders: TodoReminderSchedule[] = [];
    if (pivotMoveDate != null) {
      const localTime = target.getScheduledLocalTime();
      const scheduledTime =
        localTime == null
          ? null
          : parseLocalDateTime(pivotMoveDate, localTime, target.getTimezone());
      await todoRepository.moveOccurrence(pivotTodoId, pivotMoveDate, scheduledTime);
      movedTodoIds.push(pivotTodoId);
      if (scheduledTime != null) {
        reminders.push({ todoId: pivotTodoId, scheduledTime, userId: target.getUserId() });
      }
    }

    if (target !== source) {
      const kept = keep.map((row) => row.todoId).filter((todoId) => !deletedTodoIds.has(todoId));
      await todoRepository.reassignOccurrences([...kept, ...movedTodoIds], target.getId());
    }
    return { deletedTodoIds: [...deletedTodoIds], movedTodoIds, reminders, responseTodoId };
  }

  /** DST로 오프셋이 달라지므로 회차의 실제 날짜마다 규칙 시간대로 다시 해석한다. */
  async #rescheduleRows(
    target: TodoSeries,
    pivot: string,
    localTime: string | null,
  ): Promise<readonly OccurrenceTime[]> {
    const { todoRepository } = this.#dependencies;
    const rows = await todoRepository.findOccurrencesFrom(target.getId(), pivot);
    const times = rows
      .filter((row) => !row.completed)
      .map((row) => ({
        todoId: row.todoId,
        scheduledTime:
          localTime == null
            ? null
            : parseLocalDateTime(row.startDate, localTime, target.getTimezone()),
      }));
    await todoRepository.updateOccurrenceTimes(times);
    return times;
  }

  async #assertSeriesLimit(userId: string): Promise<void> {
    const activeCount = await this.#dependencies.seriesRepository.countActiveByUserId(userId);
    if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
      throw new ApplicationException(ErrorCode.TODO_0842, {
        limit: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER,
        activeCount,
      });
    }
  }
}

function resolveLocalTime(input: UpdateFollowingTodosInput): string | null | undefined {
  // nullish-strict: 생략은 유지, null은 시간 지우기다
  if (input.scheduledTime !== undefined) {
    return input.scheduledTime;
  }
  return input.isAllDay === true ? null : undefined;
}
