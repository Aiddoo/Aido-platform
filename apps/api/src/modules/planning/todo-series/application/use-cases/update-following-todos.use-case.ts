import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS, TODO_SERIES_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { isEqual, sortBy, uniq, uniqBy } from "es-toolkit";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoCategoryLockKeys } from "../../../categories/application/categories.lock-keys.js";
import { addDaysToKey, dateKeyOf } from "../../../shared/domain/todo-calendar.domain-service.js";
import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import type { CategoryOwnershipPort } from "../../../todos/application/ports/category-ownership.port.js";
import type { TodoReadRepositoryPort } from "../../../todos/application/ports/todo-read.repository.port.js";
import type {
  TodoReminderSchedulerPort,
  TodoReminderSchedule,
} from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type {
  OccurrenceRow,
  OccurrenceTime,
  TodoRepositoryPort,
} from "../../../todos/application/ports/todo.repository.port.js";
import type { TodoReadModel } from "../../../todos/application/read-models/todo.read-model.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import { occurrenceHorizon } from "../../domain/occurrence-horizon.domain-service.js";
import { RepeatRule, type RepeatSpec } from "../../domain/repeat-rule.vo.js";
import { TodoOccurrencesChangedEvent } from "../../domain/todo-occurrences-changed.event.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeries, TodoSeriesChanges } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { MaterializeTodoOccurrencesUseCase } from "./materialize-todo-occurrences.use-case.js";
import type { PublishTodoSeriesEditUseCase } from "./publish-todo-series-edit.use-case.js";

export interface UpdateFollowingTodosInput {
  readonly id: number;
  readonly userId: string;
  /** 요청의 기기 시간대. 시간을 고칠 때만 그 시각의 시간대로 규칙에 저장한다. */
  readonly timezone: string;
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
  /** HH:mm. null은 시간 지우기, 생략은 유지다. */
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly repeat?: RepeatSpec;
  readonly checklist?: readonly { readonly title: string }[];
}

/** UoW 안에서 저장을 끝낸 결과. responseTodoId는 기준 회차가 다른 행으로 바뀌었을 때 그 행이다. */
export interface AppliedFollowingEdit {
  readonly source: TodoSeries;
  readonly target: TodoSeries;
  readonly isSplit: boolean;
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
    | "countCategoryUsage"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "lockFollowingSegments" | "insert" | "update" | "countActiveByUserId"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly materializer: Pick<MaterializeTodoOccurrencesUseCase, "planFirstRun" | "persist">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders" | "scheduleReminders">;
  readonly effects: Pick<PublishTodoSeriesEditUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 이 회차와 이후 미완료 회차를 함께 고친다. 제목·카테고리·공개·시간·체크리스트는 제자리 수정이고,
 * 규칙이 바뀌면 이 회차부터 새 규칙으로 나눈다. 기준이 첫 회차면 나누지 않는다.
 * 사용자에게는 한 반복이라 나뉜 뒤 구간까지 닿는다. 규칙을 바꾸면 뒤 구간을 끝내고 새 규칙 하나로 합친다.
 * 완료한 회차의 내용은 건드리지 않는다.
 */
export class UpdateFollowingTodosUseCase {
  readonly #dependencies: UpdateFollowingTodosDependencies;

  constructor(dependencies: UpdateFollowingTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateFollowingTodosInput): Promise<TodoReadModel> {
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

  /** 활성 UoW 안에서 호출한다. 이 회차의 날짜·완료 변경과 한 트랜잭션으로 묶을 때 EditTodoUseCase가 부른다. */
  async apply(input: UpdateFollowingTodosInput): Promise<AppliedFollowingEdit> {
    const { id, userId } = input;
    const { todoRepository, seriesRepository, mutationLock } = this.#dependencies;
    // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
    await mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
      TodoLockKeys.todo(id),
    ]);
    const todo = await todoRepository.findByIdAndUserId(id, userId);
    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    const { seriesId } = todo;
    if (seriesId == null) {
      throw new ApplicationException(ErrorCode.TODO_0844, {
        todoId: id,
        scope: "THIS_AND_FOLLOWING",
      });
    }
    const series = await seriesRepository.lockForUpdate(seriesId);
    if (series == null || series.userId.value !== userId) {
      throw new ApplicationException(ErrorCode.TODO_0841, { seriesId });
    }
    if (input.categoryId != null) {
      await this.#dependencies.categoryOwnership.validateOwnership(input.categoryId, userId);
    }
    const { occurrenceDate } = todo;
    if (occurrenceDate == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return this.#applyTo(input, series, dateKeyOf(occurrenceDate));
  }

  async publish(edited: AppliedFollowingEdit, userId: string): Promise<void> {
    await this.#dependencies.effects.execute({
      seriesId: edited.target.id.value,
      userId,
    });
    if (edited.isSplit) {
      this.#dependencies.logger.log({
        event: TodoSeriesLogEvent.SPLIT,
        seriesId: edited.source.id.value,
        newSeriesId: edited.target.id.value,
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
    const now = this.#dependencies.clock.now();
    const rule = input.repeat == null ? null : RepeatRule.create(input.repeat);
    const ruleChanged = rule != null && !rule.equals(series.rule);
    const checklistChanged =
      input.checklist != null && !isEqual(input.checklist, series.checklistTemplate);
    const scheduledLocalTime = resolveLocalTime(input);
    const details = {
      title: input.title,
      categoryId: input.categoryId,
      visibility: input.visibility,
      scheduledLocalTime,
      timezone: scheduledLocalTime == null ? undefined : input.timezone,
    };

    const following = await seriesRepository.lockFollowingSegments(series);
    if (ruleChanged && ![series, ...following].some((segment) => segment.isActive)) {
      // 끝난 규칙의 규칙을 바꾸면 다시 진행 중이 된다. 진행 중인 구간을 합치면 수가 늘지 않는다.
      await this.#assertSeriesLimit(series.userId.value);
    }
    if (
      input.categoryId != null &&
      [series, ...following].some((segment) => segment.categoryId !== input.categoryId)
    ) {
      await this.#assertCategoryLimit(series.userId.value, input.categoryId);
    }

    let target = series;
    let split = false;
    // 체크리스트는 새로 만드는 회차에만 복사하므로 규칙이 그대로면 나눌 이유가 없다.
    // 나누면 그 구간을 처음부터 다시 계산해 "이 할 일만" 지운 회차가 되살아난다.
    if (ruleChanged && pivot !== series.startDate) {
      target = series.splitFrom({
        pivotDate: pivot,
        changes: { ...details, rule, checklistTemplate: input.checklist },
        id: TodoSeriesId.generate(),
        now,
      });
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
    let reminders: TodoReminderSchedule[] = [];
    let responseTodoId = input.id;

    // 합칠 회차는 옮기기 전에 맞춘다. 옮긴 뒤에는 어느 구간의 행이었는지 알 수 없다.
    for (const segment of following) {
      const rescheduled = await this.#applyDetailsToSegment(
        segment,
        ruleChanged ? segment.resolveChangesToMatch(target) : details,
        pivot,
      );
      cancelledTodoIds.push(...rescheduled.map(({ todoId }) => todoId));
      reminders.push(...toReminders(rescheduled, series.userId.value));
    }

    if (ruleChanged || split) {
      const remapped = await this.#remapRows(input.id, series, following, target, pivot, now);
      cancelledTodoIds.push(...remapped.deletedTodoIds, ...remapped.movedTodoIds);
      const deleted = new Set(remapped.deletedTodoIds);
      reminders = [
        ...reminders.filter(({ todoId }) => !deleted.has(todoId)),
        ...remapped.reminders,
      ];
      responseTodoId = remapped.responseTodoId;
    }

    await todoRepository.updateFollowingOccurrences(target.id.value, pivot, {
      title: input.title,
      categoryId: input.categoryId,
      visibility: input.visibility,
    });

    // nullish-strict: null은 시간 지우기, undefined는 시간을 건드리지 않은 수정이다
    if (details.scheduledLocalTime !== undefined) {
      const rescheduled = await this.#rescheduleRows(target, pivot, details.scheduledLocalTime);
      cancelledTodoIds.push(...rescheduled.map(({ todoId }) => todoId));
      reminders.push(...toReminders(rescheduled, series.userId.value));
    }

    const drafts = ruleChanged || split ? materializer.planFirstRun(target, now) : [];
    await seriesRepository.update(series);
    if (split) {
      await seriesRepository.insert(target);
    }
    for (const segment of following) {
      if (ruleChanged) {
        segment.stopAfter(addDaysToKey(pivot, -1));
      } else if (checklistChanged) {
        segment.replaceChecklist(input.checklist ?? []);
      }
      await seriesRepository.update(segment);
    }
    await materializer.persist(target, drafts);
    // 지운 회차와 시각이 바뀐 회차의 예약을 지우고 새 시각으로 다시 잡는다. 행과 함께 커밋한다.
    await todoReminder.cancelReminders(uniq(cancelledTodoIds));
    await todoReminder.scheduleReminders(uniqBy(reminders, ({ todoId }) => todoId));
    await this.#dependencies.applyTodoEvents.execute([
      new TodoOccurrencesChangedEvent(target.id.value, target.userId.value),
    ]);

    return { source: series, target, isSplit: split, responseTodoId };
  }

  /** 뒤 구간의 규칙 값과 이미 있는 미완료 회차를 함께 고친다. 시각을 다시 계산했으면 그 회차들을 돌려준다. */
  async #applyDetailsToSegment(
    segment: TodoSeries,
    changes: Omit<TodoSeriesChanges, "rule" | "checklistTemplate">,
    pivot: string,
  ): Promise<readonly OccurrenceTime[]> {
    segment.applyDetails(changes);
    await this.#dependencies.todoRepository.updateFollowingOccurrences(segment.id.value, pivot, {
      title: changes.title,
      categoryId: changes.categoryId,
      visibility: changes.visibility,
    });
    // nullish-strict: null은 시간 지우기, undefined는 시간을 건드리지 않은 수정이다
    return changes.scheduledLocalTime === undefined
      ? []
      : this.#rescheduleRows(segment, pivot, changes.scheduledLocalTime);
  }

  /**
   * 규칙이 바뀌면 이후 회차를 새 날짜에 맞춘다. 맞는 행은 id를 유지해 옮기고(댓글·진행 보존),
   * 맞지 않는 미완료 행은 지운다. 기준 회차만은 지우지 않고 첫 날짜로 옮긴다.
   * 뒤 구간의 행도 같은 기준으로 합친다. 완료 행은 맞지 않아도 기록으로 원래 구간에 남는다.
   */
  async #remapRows(
    pivotTodoId: number,
    source: TodoSeries,
    following: readonly TodoSeries[],
    target: TodoSeries,
    pivot: string,
    now: Temporal.Instant,
  ) {
    const { todoRepository } = this.#dependencies;
    const rows = await todoRepository.findOccurrencesFrom(
      [source, ...following].map((segment) => segment.id.value),
      pivot,
    );
    const lastRowDate = rows.at(-1)?.occurrenceDate ?? pivot;
    const horizon = occurrenceHorizon(target.timezone, now);
    const through = lastRowDate > horizon ? lastRowDate : horizon;
    const dates = target.rule.occurrencesBetween(target.startDate, pivot, through, 0);
    const dateSet = new Set(dates);
    const firstDate = dates.at(0);

    const keep = pickOccurrencePerDate(
      rows.filter((row) => dateSet.has(row.occurrenceDate)),
      source.id.value,
    );
    const keptTodoIds = new Set(keep.map((row) => row.todoId));
    const deletedTodoIds = new Set(
      rows.filter((row) => !keptTodoIds.has(row.todoId) && !row.completed).map((row) => row.todoId),
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
      const localTime = target.scheduledLocalTime;
      const scheduledTime = resolveScheduledInstant(pivotMoveDate, localTime, target.timezone);
      await todoRepository.moveOccurrence(pivotTodoId, {
        occurrenceDate: pivotMoveDate,
        scheduledLocalTime: localTime,
        scheduledTime,
      });
      movedTodoIds.push(pivotTodoId);
      if (scheduledTime != null) {
        reminders.push({ todoId: pivotTodoId, scheduledTime, userId: target.userId.value });
      }
    }

    const reassigned = keep
      .filter((row) => row.seriesId !== target.id.value && !deletedTodoIds.has(row.todoId))
      .map((row) => row.todoId);
    await todoRepository.reassignOccurrences(
      target === source ? reassigned : [...reassigned, ...movedTodoIds],
      target.id.value,
    );
    return { deletedTodoIds: [...deletedTodoIds], movedTodoIds, reminders, responseTodoId };
  }

  /** DST로 오프셋이 달라지므로 회차의 실제 날짜마다 규칙 시간대로 다시 해석한다. */
  async #rescheduleRows(
    target: TodoSeries,
    pivot: string,
    localTime: string | null,
  ): Promise<readonly OccurrenceTime[]> {
    const { todoRepository } = this.#dependencies;
    const rows = await todoRepository.findOccurrencesFrom([target.id.value], pivot);
    const times = rows
      .filter((row) => !row.completed)
      .map((row) => ({
        todoId: row.todoId,
        scheduledLocalTime: localTime,
        scheduledTime: resolveScheduledInstant(row.startDate, localTime, target.timezone),
      }));
    await todoRepository.updateOccurrenceTimes(times);
    return times;
  }

  async #assertCategoryLimit(userId: string, categoryId: number): Promise<void> {
    const activeCount = await this.#dependencies.todoRepository.countCategoryUsage(
      userId,
      categoryId,
    );
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw new ApplicationException(ErrorCode.TODO_0811, {
        activeCount,
        maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
      });
    }
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

/**
 * 유니크 인덱스 때문에 합치는 규칙에는 날짜마다 한 행만 들어간다.
 * 완료 기록을 먼저 지키고, 그다음은 이미 기준 규칙에 있던 행이다.
 */
function pickOccurrencePerDate(
  rows: readonly OccurrenceRow[],
  sourceSeriesId: string,
): readonly OccurrenceRow[] {
  const ranked = sortBy(rows, [
    (row) => (row.completed ? 0 : 1),
    (row) => (row.seriesId === sourceSeriesId ? 0 : 1),
  ]);
  return uniqBy(ranked, (row) => row.occurrenceDate);
}

function toReminders(
  times: readonly OccurrenceTime[],
  userId: string,
): readonly TodoReminderSchedule[] {
  return times.flatMap(({ todoId, scheduledTime }) =>
    scheduledTime == null ? [] : [{ todoId, scheduledTime, userId }],
  );
}

function resolveLocalTime(input: UpdateFollowingTodosInput): string | null | undefined {
  // nullish-strict: 생략은 유지, null은 시간 지우기다
  if (input.scheduledTime !== undefined) {
    return input.scheduledTime;
  }
  return input.isAllDay === true ? null : undefined;
}
