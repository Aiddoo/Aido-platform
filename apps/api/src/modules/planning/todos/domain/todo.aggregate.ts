import { TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { checklistLimitReached } from "../../shared/domain/planning.errors.js";
import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import { TodoCategoryId } from "../../todo-categories/domain/todo-category-id.vo.js";
import { TodoSeriesId } from "../../todo-series/domain/todo-series-id.vo.js";
import { TodoCategoryChangedEvent } from "./todo-category-changed.event.js";
import { TodoCreatedEvent } from "./todo-created.event.js";
import { TodoDeletedEvent } from "./todo-deleted.event.js";
import { TodoId } from "./todo-id.vo.js";
import type { TodoItemId } from "./todo-item-id.vo.js";
import { TodoItem, type TodoItemPrimitives } from "./todo-item.entity.js";
import { TodoRescheduledEvent } from "./todo-rescheduled.event.js";
import { TodoSchedule, type TodoSchedulePatch } from "./todo-schedule.vo.js";
import { TodoToggledEvent } from "./todo-toggled.event.js";
import { TodoUpdatedEvent } from "./todo-updated.event.js";
import { TodoVisibilityChangedEvent } from "./todo-visibility-changed.event.js";
import {
  checklistItemNotFound,
  duplicateChecklistItemIds,
  incompleteChecklistItemIds,
} from "./todos.errors.js";

export type TodoEvent =
  | TodoCreatedEvent
  | TodoToggledEvent
  | TodoRescheduledEvent
  | TodoUpdatedEvent
  | TodoDeletedEvent
  | TodoVisibilityChangedEvent
  | TodoCategoryChangedEvent;

export interface TodoPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly sortOrder: number;
  readonly completed: boolean;
  readonly completedAt: Temporal.Instant | null;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
  readonly isAllDay: boolean;
  readonly visibility: TodoVisibility;
  readonly seriesId: string | null;
  readonly occurrenceDate: Temporal.PlainDate | null;
  readonly items: readonly TodoItemPrimitives[];
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

export interface TodoDetailsPatch {
  readonly title?: string;
  readonly categoryId?: TodoCategoryId;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate | null;
  readonly scheduledLocalTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

export interface TodoItemChange {
  readonly title?: string;
  readonly completed?: boolean;
}

interface TodoProps {
  readonly userId: UserId;
  categoryId: TodoCategoryId;
  title: TodoTitle;
  sortOrder: number;
  completed: boolean;
  completedAt: Temporal.Instant | null;
  schedule: TodoSchedule;
  visibility: TodoVisibility;
  seriesId: TodoSeriesId | null;
  occurrenceDate: Temporal.PlainDate | null;
  items: TodoItem[];
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateTodoParams {
  readonly id: TodoId;
  readonly userId: UserId;
  readonly categoryId: TodoCategoryId;
  readonly title: TodoTitle;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
}

interface SeriesAttachment {
  readonly seriesId: TodoSeriesId;
  readonly occurrenceDate: Temporal.PlainDate;
  readonly schedule: TodoSchedule;
  readonly now: Temporal.Instant;
}

export class Todo extends AggregateRoot<TodoId, TodoProps, TodoEvent> {
  // 반복 회차는 규칙이 한 문장으로 만들어 이 경로를 거치지 않는다
  static create(params: CreateTodoParams): Todo {
    const todo = new Todo(params.id, {
      userId: params.userId,
      categoryId: params.categoryId,
      title: params.title,
      sortOrder: params.sortOrder,
      completed: false,
      completedAt: null,
      schedule: params.schedule,
      visibility: params.visibility,
      seriesId: null,
      occurrenceDate: null,
      items: [],
      createdAt: params.now,
      updatedAt: params.now,
    });
    todo.raise(
      new TodoCreatedEvent(params.id.value, params.userId.value, params.schedule.scheduledTime),
    );
    return todo;
  }

  static reconstitute(primitives: TodoPrimitives): Todo {
    return new Todo(TodoId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      categoryId: TodoCategoryId.reconstitute(primitives.categoryId),
      title: TodoTitle.reconstitute(primitives.title),
      sortOrder: primitives.sortOrder,
      completed: primitives.completed,
      completedAt: primitives.completedAt,
      schedule: TodoSchedule.reconstitute({
        startDate: primitives.startDate,
        endDate: primitives.endDate,
        scheduledLocalTime: primitives.scheduledLocalTime,
        scheduledTime: primitives.scheduledTime,
        isAllDay: primitives.isAllDay,
      }),
      visibility: primitives.visibility,
      seriesId: primitives.seriesId == null ? null : TodoSeriesId.reconstitute(primitives.seriesId),
      occurrenceDate: primitives.occurrenceDate,
      items: primitives.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  #deleted = false;

  get userId(): UserId {
    return this.props.userId;
  }

  get categoryId(): TodoCategoryId {
    return this.props.categoryId;
  }

  get title(): TodoTitle {
    return this.props.title;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get completed(): boolean {
    return this.props.completed;
  }

  get completedAt(): Temporal.Instant | null {
    return this.props.completedAt;
  }

  get schedule(): TodoSchedule {
    return this.props.schedule;
  }

  get visibility(): TodoVisibility {
    return this.props.visibility;
  }

  get seriesId(): TodoSeriesId | null {
    return this.props.seriesId;
  }

  get occurrenceDate(): Temporal.PlainDate | null {
    return this.props.occurrenceDate;
  }

  get items(): readonly TodoItem[] {
    return this.props.items;
  }

  isOccurrence(): boolean {
    return this.props.seriesId != null;
  }

  // 칸이 빈 옛 행도 사용자가 보던 시각으로 읽는다. 반복으로 전환할 때 규칙의 시각이 된다
  localTimeIn(timezone: string): string | null {
    return this.props.schedule.localTimeIn(timezone);
  }

  // timezone은 스트릭의 "오늘" 경계다. 완료하면 리마인더가 취소된다
  complete(timezone: string, now: Temporal.Instant): boolean {
    if (this.props.completed) {
      return false;
    }
    this.props.completed = true;
    this.props.completedAt = now;
    this.props.updatedAt = now;
    this.raise(new TodoToggledEvent(this.id.value, this.props.userId.value, true, timezone));
    return true;
  }

  // 완료하면 예약이 지워지므로 되돌리면 지금 시각으로 다시 잡는다
  reopen(timezone: string, now: Temporal.Instant): boolean {
    if (!this.props.completed) {
      return false;
    }
    this.props.completed = false;
    this.props.completedAt = null;
    this.props.updatedAt = now;
    this.raise(new TodoToggledEvent(this.id.value, this.props.userId.value, false, timezone));
    const { scheduledTime } = this.props.schedule;
    if (scheduledTime != null) {
      this.raise(new TodoRescheduledEvent(this.id.value, this.props.userId.value, scheduledTime));
    }
    return true;
  }

  rename(title: TodoTitle, now: Temporal.Instant): boolean {
    if (this.props.title.equals(title)) {
      return false;
    }
    this.props.title = title;
    this.props.updatedAt = now;
    this.raise(new TodoUpdatedEvent(this.id.value, this.props.userId.value, this.props.completed));
    return true;
  }

  // 검증을 모두 통과한 뒤에만 바꾼다. 완료 칸은 complete·reopen을 거쳐 전용 완료 경로와 같은 사실을 낸다
  updateDetails(patch: TodoDetailsPatch, timezone: string, now: Temporal.Instant): boolean {
    const title = patch.title == null ? null : TodoTitle.create(patch.title);
    const schedulePatch = toSchedulePatch(patch);
    const nextSchedule =
      Object.keys(schedulePatch).length > 0
        ? this.props.schedule.patch(schedulePatch, timezone)
        : null;
    const previousScheduledTime = this.props.schedule.scheduledTime;

    let detailsChanged = false;
    if (title != null && !title.equals(this.props.title)) {
      this.props.title = title;
      detailsChanged = true;
    }
    if (patch.categoryId != null && !patch.categoryId.equals(this.props.categoryId)) {
      this.props.categoryId = patch.categoryId;
      detailsChanged = true;
    }
    if (nextSchedule != null && !nextSchedule.equals(this.props.schedule)) {
      this.props.schedule = nextSchedule;
      detailsChanged = true;
    }
    if (patch.visibility != null && patch.visibility !== this.props.visibility) {
      this.props.visibility = patch.visibility;
      detailsChanged = true;
    }

    const reopens = patch.completed === false && this.props.completed;
    if (detailsChanged) {
      this.props.updatedAt = now;
      const completedAfter = patch.completed ?? this.props.completed;
      this.raise(new TodoUpdatedEvent(this.id.value, this.props.userId.value, completedAfter));
      const { scheduledTime } = this.props.schedule;
      // 되돌리기는 reopen이 새 시각으로 다시 잡는다. 시각만 바꾼 PATCH도 옛 시각의 예약이 남지 않게 한다
      if (!reopens && !isSameInstant(scheduledTime, previousScheduledTime)) {
        this.raise(new TodoRescheduledEvent(this.id.value, this.props.userId.value, scheduledTime));
      }
    }
    const completionChanged = this.#changeCompletion(patch.completed, timezone, now);
    return detailsChanged || completionChanged;
  }

  reschedule(schedule: TodoSchedule, now: Temporal.Instant): boolean {
    if (schedule.equals(this.props.schedule)) {
      return false;
    }
    this.props.schedule = schedule;
    this.props.updatedAt = now;
    this.raise(
      new TodoRescheduledEvent(this.id.value, this.props.userId.value, schedule.scheduledTime),
    );
    return true;
  }

  changeVisibility(visibility: TodoVisibility, now: Temporal.Instant): boolean {
    if (this.props.visibility === visibility) {
      return false;
    }
    this.props.visibility = visibility;
    this.props.updatedAt = now;
    this.raise(new TodoVisibilityChangedEvent(this.id.value, this.props.userId.value));
    return true;
  }

  changeCategory(categoryId: TodoCategoryId, now: Temporal.Instant): boolean {
    if (this.props.categoryId.equals(categoryId)) {
      return false;
    }
    this.props.categoryId = categoryId;
    this.props.updatedAt = now;
    this.raise(
      new TodoCategoryChangedEvent(this.id.value, this.props.userId.value, categoryId.value),
    );
    return true;
  }

  // 순서 바꾸기는 사용자 순서 잠금 아래에서 이웃 사이 값을 정해 넘긴다
  moveTo(sortOrder: number, now: Temporal.Instant): boolean {
    if (this.props.sortOrder === sortOrder) {
      return false;
    }
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = now;
    return true;
  }

  // 단일 할 일을 반복의 첫 회차로 삼는다. id·댓글·진행은 그대로이고 리마인더는 반복 시작이 다시 잡는다
  attachToSeries(attachment: SeriesAttachment): boolean {
    if (this.props.seriesId != null) {
      return false;
    }
    this.props.seriesId = attachment.seriesId;
    this.props.occurrenceDate = attachment.occurrenceDate;
    this.props.schedule = attachment.schedule;
    this.props.updatedAt = attachment.now;
    return true;
  }

  markDeleted(): boolean {
    if (this.#deleted) {
      return false;
    }
    this.#deleted = true;
    this.raise(new TodoDeletedEvent(this.id.value, this.props.userId.value));
    return true;
  }

  // 끝에 붙인다. 끝낸 일에 항목을 더하면 남은 일이 생긴 것이라 다시 연다("완료 + 0/N"을 막는다, QA #37)
  addItem(params: {
    readonly id: TodoItemId;
    readonly title: TodoTitle;
    readonly timezone: string;
    readonly now: Temporal.Instant;
  }): TodoItem {
    const { items } = this.props;
    if (items.length >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
      throw checklistLimitReached(items.length);
    }
    const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1);
    const item = TodoItem.create({
      id: params.id,
      title: params.title,
      sortOrder: maxSortOrder + 1,
      now: params.now,
    });
    this.props.items = [...items, item];
    this.reopen(params.timezone, params.now);
    return item;
  }

  // 제목을 먼저 검증해 실패하면 아무 값도 바꾸지 않는다
  updateItem(itemId: TodoItemId, change: TodoItemChange, now: Temporal.Instant): boolean {
    const item = this.#requireItem(itemId);
    const title = change.title == null ? null : TodoTitle.create(change.title);
    const renamed = title != null && item.rename(title, now);
    const completionChanged =
      change.completed != null && item.changeCompleted(change.completed, now);
    return renamed || completionChanged;
  }

  removeItem(itemId: TodoItemId): boolean {
    this.#requireItem(itemId);
    this.props.items = this.props.items.filter((item) => !item.id.equals(itemId));
    return true;
  }

  // 모든 하위 항목 id를 한 번씩 받아야 한다. 배열 순서가 새 순서다
  reorderItems(itemIds: readonly TodoItemId[], now: Temporal.Instant): boolean {
    this.#assertCompleteItemOrder(itemIds);
    const moved = itemIds.map((itemId, sortOrder) =>
      this.#requireItem(itemId).moveTo(sortOrder, now),
    );
    this.props.items = itemIds.map((itemId) => this.#requireItem(itemId));
    return moved.some(Boolean);
  }

  toPrimitives(): TodoPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      categoryId: this.props.categoryId.value,
      title: this.props.title.value,
      sortOrder: this.props.sortOrder,
      completed: this.props.completed,
      completedAt: this.props.completedAt,
      ...this.props.schedule.toPrimitives(),
      visibility: this.props.visibility,
      seriesId: this.props.seriesId?.value ?? null,
      occurrenceDate: this.props.occurrenceDate,
      items: this.props.items.map((item) => item.toPrimitives()),
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  #changeCompletion(
    completed: boolean | undefined,
    timezone: string,
    now: Temporal.Instant,
  ): boolean {
    if (completed == null) {
      return false;
    }
    return completed ? this.complete(timezone, now) : this.reopen(timezone, now);
  }

  #assertCompleteItemOrder(itemIds: readonly TodoItemId[]): void {
    const uniqueItemIds = new Set(itemIds.map((itemId) => itemId.value));
    if (uniqueItemIds.size !== itemIds.length) {
      throw duplicateChecklistItemIds(itemIds.length, uniqueItemIds.size);
    }
    const currentIds = new Set(this.props.items.map((item) => item.id.value));
    if (itemIds.length !== currentIds.size) {
      throw incompleteChecklistItemIds(currentIds.size, itemIds.length);
    }
    for (const itemId of itemIds) {
      if (!currentIds.has(itemId.value)) {
        throw checklistItemNotFound(itemId.value);
      }
    }
  }

  #requireItem(itemId: TodoItemId): TodoItem {
    const item = this.props.items.find((entry) => entry.id.equals(itemId));
    if (item == null) {
      throw checklistItemNotFound(itemId.value);
    }
    return item;
  }
}

function isSameInstant(left: Temporal.Instant | null, right: Temporal.Instant | null): boolean {
  return left == null || right == null ? left === right : left.equals(right);
}

function toSchedulePatch(patch: TodoDetailsPatch): TodoSchedulePatch {
  return {
    ...(patch.startDate == null ? {} : { startDate: patch.startDate }),
    // oxlint-disable-next-line aido/no-strict-nullish -- endDate null은 종료일 지우기다
    ...(patch.endDate === undefined ? {} : { endDate: patch.endDate }),
    // oxlint-disable-next-line aido/no-strict-nullish -- 벽시계 null은 시간 지우기다
    ...(patch.scheduledLocalTime === undefined
      ? {}
      : { scheduledLocalTime: patch.scheduledLocalTime }),
    ...(patch.isAllDay == null ? {} : { isAllDay: patch.isAllDay }),
  };
}
