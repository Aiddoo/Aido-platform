import { TODO_LIMITS, TODO_SERIES_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";
import { isEqual, uniq, uniqBy } from "es-toolkit";

import {
  TodoCategoryLockKeys,
  TodoCategoryId,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import type { CategoryOwnershipPort } from "../../../todos/application/ports/category-ownership.port.js";
import type {
  TodoOccurrencePatch,
  TodoOccurrenceTime,
  TodoOccurrenceWriterPort,
} from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type {
  TodoReminderSchedulerPort,
  TodoReminderSchedule,
} from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import { categoryTodoLimitReached, todoNotFound } from "../../../todos/application/todos.errors.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import { RepeatRule, type RepeatSpec } from "../../domain/repeat-rule.vo.js";
import {
  changesToMatch,
  type TodoSeriesChanges,
  type TodoSeriesDetailChanges,
} from "../../domain/series-changes.domain-service.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import {
  todoNotRepeating,
  todoSeriesLimitReached,
  todoSeriesNotFound,
} from "../todo-series.errors.js";
import type { MaterializeTodoOccurrencesUseCase } from "./materialize-todo-occurrences.use-case.js";
import type { RemapFollowingOccurrencesUseCase } from "./remap-following-occurrences.use-case.js";

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

interface FollowingEdit {
  /** 규칙이 바뀔 때만 새 규칙이다 */
  readonly changedRule: RepeatRule | null;
  readonly checklistChanged: boolean;
  readonly details: TodoSeriesDetailChanges;
}

// 지운 회차와 시각이 바뀐 회차의 예약을 지우고 새 시각으로 다시 잡는다. 행과 함께 커밋한다
interface ReminderPlan {
  readonly cancelledTodoIds: number[];
  reminders: TodoReminderSchedule[];
}

interface SegmentEdit {
  readonly input: UpdateFollowingTodosInput;
  readonly edit: FollowingEdit;
  readonly series: TodoSeries;
  readonly following: readonly TodoSeries[];
  readonly pivot: Temporal.PlainDate;
  readonly now: Temporal.Instant;
}

interface ApplyFollowingTodosUpdateDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "countCategoryUsage">;
  readonly occurrenceWriter: Pick<
    TodoOccurrenceWriterPort,
    "findOccurrencesFrom" | "updateFollowingOccurrences" | "updateOccurrenceTimes"
  >;
  readonly remapOccurrences: Pick<RemapFollowingOccurrencesUseCase, "execute">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "lockFollowingSegments" | "insert" | "save" | "countActiveByUserId"
  >;
  readonly categoryOwnership: Pick<CategoryOwnershipPort, "validateOwnership">;
  readonly materializer: Pick<MaterializeTodoOccurrencesUseCase, "execute">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders" | "scheduleReminders">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

/**
 * 이 회차와 이후 미완료 회차를 함께 고친다. 제목·카테고리·공개·시간·체크리스트는 제자리 수정이고,
 * 규칙이 바뀌면 이 회차부터 새 규칙으로 나눈다. 기준이 첫 회차면 나누지 않는다.
 * 사용자에게는 한 반복이라 나뉜 뒤 구간까지 닿는다. 규칙을 바꾸면 뒤 구간을 끝내고 새 규칙 하나로 합친다.
 * 완료한 회차의 내용은 건드리지 않는다. 활성 UoW 안에서 호출한다(EditTodoUseCase가 이 회차의 날짜·완료 변경과 묶는다).
 */
export class ApplyFollowingTodosUpdateUseCase {
  readonly #dependencies: ApplyFollowingTodosUpdateDependencies;

  constructor(dependencies: ApplyFollowingTodosUpdateDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateFollowingTodosInput): Promise<AppliedFollowingEdit> {
    const { id, userId } = input;
    const { todoRepository, seriesRepository, mutationLock } = this.#dependencies;
    // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
    await mutationLock.acquire([
      TodoCategoryLockKeys.userCategories(userId),
      TodoLockKeys.sortOrder(userId),
      TodoLockKeys.todo(id),
    ]);
    const ownerId = UserId.reconstitute(userId);
    const todo = await todoRepository.findByIdAndUserId(TodoId.reconstitute(id), ownerId);
    if (todo == null) {
      throw todoNotFound(id);
    }
    const { seriesId } = todo;
    if (seriesId == null) {
      throw todoNotRepeating(id, "THIS_AND_FOLLOWING");
    }
    const series = await seriesRepository.lockForUpdate(seriesId);
    if (series == null || !series.userId.equals(ownerId)) {
      throw todoSeriesNotFound(seriesId.value);
    }
    if (input.categoryId != null) {
      await this.#dependencies.categoryOwnership.validateOwnership(
        TodoCategoryId.reconstitute(input.categoryId),
        ownerId,
      );
    }
    const { occurrenceDate } = todo;
    if (occurrenceDate == null) {
      throw todoNotFound(id);
    }
    return this.#applyTo(input, series, occurrenceDate);
  }

  async #applyTo(
    input: UpdateFollowingTodosInput,
    series: TodoSeries,
    pivot: Temporal.PlainDate,
  ): Promise<AppliedFollowingEdit> {
    const edit = toFollowingEdit(input, series);
    const following = await this.#dependencies.seriesRepository.lockFollowingSegments(series);
    await this.#assertLimits(input, edit, [series, ...following]);
    const segmentEdit = {
      input,
      edit,
      series,
      following,
      pivot,
      now: this.#dependencies.clock.now(),
    };
    const { target, split } = reshapeSeries(segmentEdit);
    const plan: ReminderPlan = { cancelledTodoIds: [], reminders: [] };

    // 합칠 회차는 옮기기 전에 맞춘다. 옮긴 뒤에는 어느 구간의 행이었는지 알 수 없다.
    for (const segment of following) {
      const changes = edit.changedRule == null ? edit.details : changesToMatch(segment, target);
      addRescheduled(plan, await this.#applyDetailsToSegment(segment, changes, pivot));
    }
    const responseTodoId =
      edit.changedRule != null || split ? await this.#remap(segmentEdit, target, plan) : input.id;
    await this.#dependencies.occurrenceWriter.updateFollowingOccurrences(
      target.id,
      pivot.toString(),
      toOccurrencePatch(input),
    );
    const { scheduledLocalTime } = edit.details;
    // oxlint-disable-next-line aido/no-strict-nullish -- null은 시간 지우기, undefined는 시간을 건드리지 않은 수정이다
    if (scheduledLocalTime !== undefined) {
      addRescheduled(plan, await this.#rescheduleRows(target, pivot, scheduledLocalTime));
    }

    await this.#saveSegments(segmentEdit, target, split);
    await this.#commitReminders(plan);
    await this.#dependencies.applyTodoEvents.execute(
      [series, ...following, target].flatMap((segment) => segment.pullDomainEvents()),
    );
    return { source: series, target, isSplit: split, responseTodoId };
  }

  async #remap(segmentEdit: SegmentEdit, target: TodoSeries, plan: ReminderPlan): Promise<number> {
    const { input, series, following, pivot, now } = segmentEdit;
    const remapped = await this.#dependencies.remapOccurrences.execute({
      pivotTodoId: input.id,
      source: series,
      following,
      target,
      pivot,
      now,
    });
    plan.cancelledTodoIds.push(...remapped.deletedTodoIds, ...remapped.movedTodoIds);
    const deleted = new Set(remapped.deletedTodoIds);
    plan.reminders = [
      ...plan.reminders.filter(({ todoId }) => !deleted.has(todoId.value)),
      ...remapped.reminders,
    ];
    return remapped.responseTodoId;
  }

  async #saveSegments(segmentEdit: SegmentEdit, target: TodoSeries, split: boolean): Promise<void> {
    const { input, edit, series, following, pivot, now } = segmentEdit;
    const { seriesRepository, materializer } = this.#dependencies;
    const drafts = edit.changedRule != null || split ? target.planFirstRun(now) : [];
    await seriesRepository.save(series);
    if (split) {
      await seriesRepository.insert(target);
    }
    for (const segment of following) {
      if (edit.changedRule != null) {
        segment.stopAfter(pivot.subtract({ days: 1 }));
      } else if (edit.checklistChanged) {
        segment.replaceChecklist(input.checklist ?? []);
      }
      await seriesRepository.save(segment);
    }
    await materializer.execute({ series: target, drafts });
  }

  async #commitReminders(plan: ReminderPlan): Promise<void> {
    const { todoReminder } = this.#dependencies;
    await todoReminder.cancelReminders(
      uniq(plan.cancelledTodoIds).map((todoId) => TodoId.reconstitute(todoId)),
    );
    await todoReminder.scheduleReminders(uniqBy(plan.reminders, ({ todoId }) => todoId.value));
  }

  /** 뒤 구간의 규칙 값과 이미 있는 미완료 회차를 함께 고친다. 시각을 다시 계산했으면 그 회차들을 돌려준다. */
  async #applyDetailsToSegment(
    segment: TodoSeries,
    changes: TodoSeriesDetailChanges,
    pivot: Temporal.PlainDate,
  ): Promise<readonly RescheduledOccurrence[]> {
    segment.applyDetails(changes);
    await this.#dependencies.occurrenceWriter.updateFollowingOccurrences(
      segment.id,
      pivot.toString(),
      toOccurrencePatch(changes),
    );
    // oxlint-disable-next-line aido/no-strict-nullish -- null은 시간 지우기, undefined는 시간을 건드리지 않은 수정이다
    return changes.scheduledLocalTime === undefined
      ? []
      : this.#rescheduleRows(segment, pivot, changes.scheduledLocalTime);
  }

  /** DST로 오프셋이 달라지므로 회차의 실제 날짜마다 규칙 시간대로 다시 해석한다. */
  async #rescheduleRows(
    target: TodoSeries,
    pivot: Temporal.PlainDate,
    localTime: string | null,
  ): Promise<readonly RescheduledOccurrence[]> {
    const { occurrenceWriter } = this.#dependencies;
    const rows = await occurrenceWriter.findOccurrencesFrom([target.id], pivot.toString());
    const times = rows
      .filter((row) => !row.completed)
      .map((row) => ({
        todoId: TodoId.reconstitute(row.todoId),
        scheduledLocalTime: localTime,
        scheduledTime: resolveScheduledInstant(row.startDate, localTime, target.timezone),
      }));
    await occurrenceWriter.updateOccurrenceTimes(times);
    return times.map((time) => ({ ...time, userId: target.userId }));
  }

  async #assertLimits(
    input: UpdateFollowingTodosInput,
    edit: FollowingEdit,
    segments: readonly TodoSeries[],
  ): Promise<void> {
    const [series] = segments;
    if (series == null) {
      return;
    }
    if (edit.changedRule != null && !segments.some((segment) => segment.isActive())) {
      // 끝난 규칙의 규칙을 바꾸면 다시 진행 중이 된다. 진행 중인 구간을 합치면 수가 늘지 않는다.
      await this.#assertSeriesLimit(series.userId);
    }
    const { categoryId } = input;
    if (categoryId != null && segments.some((segment) => segment.categoryId !== categoryId)) {
      await this.#assertCategoryLimit(series.userId, categoryId);
    }
  }

  async #assertCategoryLimit(userId: UserId, categoryId: number): Promise<void> {
    const activeCount = await this.#dependencies.todoRepository.countCategoryUsage(
      userId,
      TodoCategoryId.reconstitute(categoryId),
    );
    if (activeCount >= TODO_LIMITS.MAX_PER_CATEGORY) {
      throw categoryTodoLimitReached(activeCount);
    }
  }

  async #assertSeriesLimit(userId: UserId): Promise<void> {
    const activeCount = await this.#dependencies.seriesRepository.countActiveByUserId(userId);
    if (activeCount >= TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER) {
      throw todoSeriesLimitReached(TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER, activeCount);
    }
  }
}

interface RescheduledOccurrence extends TodoOccurrenceTime {
  readonly userId: UserId;
}

function toFollowingEdit(input: UpdateFollowingTodosInput, series: TodoSeries): FollowingEdit {
  const rule = input.repeat == null ? null : RepeatRule.create(input.repeat);
  const scheduledLocalTime = resolveLocalTime(input);
  return {
    changedRule: rule == null || rule.equals(series.rule) ? null : rule,
    checklistChanged:
      input.checklist != null && !isEqual(input.checklist, series.checklistTemplate),
    details: {
      title: input.title,
      categoryId: input.categoryId,
      visibility: input.visibility,
      scheduledLocalTime,
      timezone: scheduledLocalTime == null ? undefined : input.timezone,
    },
  };
}

// 체크리스트는 새로 만드는 회차에만 복사하므로 규칙이 그대로면 나눌 이유가 없다.
// 나누면 그 구간을 처음부터 다시 계산해 "이 할 일만" 지운 회차가 되살아난다.
function reshapeSeries(segmentEdit: SegmentEdit): { target: TodoSeries; split: boolean } {
  const { input, edit, series, pivot, now } = segmentEdit;
  const { changedRule } = edit;
  if (changedRule != null && !pivot.equals(series.startDate)) {
    const target = series.splitFrom({
      pivotDate: pivot,
      changes: { ...edit.details, rule: changedRule, checklistTemplate: input.checklist },
      id: TodoSeriesId.generate(),
      now,
    });
    return { target, split: true };
  }
  series.applyDetails(edit.details);
  if (changedRule != null) {
    series.replaceRule(changedRule);
  }
  if (edit.checklistChanged) {
    series.replaceChecklist(input.checklist ?? []);
  }
  return { target: series, split: false };
}

function addRescheduled(plan: ReminderPlan, rescheduled: readonly RescheduledOccurrence[]): void {
  plan.cancelledTodoIds.push(...rescheduled.map(({ todoId }) => todoId.value));
  plan.reminders.push(
    ...rescheduled.flatMap(({ todoId, scheduledTime, userId }) =>
      scheduledTime == null ? [] : [{ todoId, scheduledTime, userId }],
    ),
  );
}

function toOccurrencePatch(
  changes: Pick<TodoSeriesChanges, "title" | "categoryId" | "visibility">,
): TodoOccurrencePatch {
  return {
    title: changes.title,
    categoryId:
      changes.categoryId == null ? undefined : TodoCategoryId.reconstitute(changes.categoryId),
    visibility: changes.visibility,
  };
}

function resolveLocalTime(input: UpdateFollowingTodosInput): string | null | undefined {
  // oxlint-disable-next-line aido/no-strict-nullish -- 생략은 유지, null은 시간 지우기다
  if (input.scheduledTime !== undefined) {
    return input.scheduledTime;
  }
  return input.isAllDay === true ? null : undefined;
}
