import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { TodoCategoryChangedEvent } from "./todo-category-changed.event.js";
import { TodoCreatedEvent } from "./todo-created.event.js";
import { TodoDeletedEvent } from "./todo-deleted.event.js";
import { TodoId } from "./todo-id.vo.js";
import type { TodoItemId } from "./todo-item-id.vo.js";
import { TodoItem, type TodoItemPrimitives } from "./todo-item.entity.js";
import { TodoRescheduledEvent } from "./todo-rescheduled.event.js";
import { TodoSchedule, type TodoSchedulePatch } from "./todo-schedule.vo.js";
import { TodoTitle } from "./todo-title.vo.js";
import { TodoToggledEvent } from "./todo-toggled.event.js";
import { TodoUpdatedEvent } from "./todo-updated.event.js";
import { TodoVisibilityChangedEvent } from "./todo-visibility-changed.event.js";

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
  readonly categoryId?: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate | null;
  readonly scheduledLocalTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

interface TodoProps {
  readonly userId: UserId;
  categoryId: number;
  title: TodoTitle;
  readonly sortOrder: number;
  completed: boolean;
  completedAt: Temporal.Instant | null;
  schedule: TodoSchedule;
  visibility: TodoVisibility;
  readonly seriesId: string | null;
  readonly occurrenceDate: Temporal.PlainDate | null;
  items: TodoItem[];
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateTodoParams {
  readonly id: TodoId;
  readonly userId: UserId;
  readonly categoryId: number;
  readonly title: TodoTitle;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
}

export class Todo extends AggregateRoot<TodoId, TodoProps, TodoEvent> {
  /** 단일 할 일을 만든다. 반복 회차는 규칙이 한 문장으로 만들어 이 경로를 거치지 않는다. */
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
      categoryId: primitives.categoryId,
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
      seriesId: primitives.seriesId,
      occurrenceDate: primitives.occurrenceDate,
      items: primitives.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get categoryId(): number {
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

  get seriesId(): string | null {
    return this.props.seriesId;
  }

  get occurrenceDate(): Temporal.PlainDate | null {
    return this.props.occurrenceDate;
  }

  get items(): readonly TodoItem[] {
    return this.props.items;
  }

  /** 칸이 빈 옛 행도 사용자가 보던 시각으로 읽는다. 반복으로 전환할 때 규칙의 시각이 된다. */
  localTimeIn(timezone: string): string | null {
    return this.props.schedule.localTimeIn(timezone);
  }

  /** timezone은 스트릭의 "오늘" 경계다. */
  toggleComplete(completed: boolean, timezone: string, now: Temporal.Instant): boolean {
    if (!this.#applyCompletion(completed, now)) {
      return false;
    }
    this.raise(new TodoToggledEvent(this.id.value, this.props.userId.value, completed, timezone));
    if (!completed) {
      this.#restoreReminders();
    }
    return true;
  }

  /** 끝낸 일에 항목을 더하면 남은 일이 생긴 것이라 완료를 유지하면 "완료 + 0/N"이 된다(QA #37). */
  reopenForAddedItem(timezone: string, now: Temporal.Instant): boolean {
    return this.toggleComplete(false, timezone, now);
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

  /** 검증을 모두 통과한 뒤에만 상태를 바꾼다(부분 변경 방지). 같은 값만 보냈으면 false다. */
  updateDetails(patch: TodoDetailsPatch, timezone: string, now: Temporal.Instant): boolean {
    const title = patch.title == null ? null : TodoTitle.create(patch.title);
    const schedulePatch = toSchedulePatch(patch);
    const nextSchedule =
      Object.keys(schedulePatch).length > 0
        ? this.props.schedule.patch(schedulePatch, timezone)
        : null;
    const previousScheduledTime = this.props.schedule.scheduledTime;

    let changed = false;
    if (title != null && !title.equals(this.props.title)) {
      this.props.title = title;
      changed = true;
    }
    if (patch.categoryId != null && patch.categoryId !== this.props.categoryId) {
      this.props.categoryId = patch.categoryId;
      changed = true;
    }
    if (nextSchedule != null && !nextSchedule.equals(this.props.schedule)) {
      this.props.schedule = nextSchedule;
      changed = true;
    }
    if (patch.visibility != null && patch.visibility !== this.props.visibility) {
      this.props.visibility = patch.visibility;
      changed = true;
    }
    const reopened = patch.completed === false && this.props.completed;
    if (patch.completed != null && this.#applyCompletion(patch.completed, now)) {
      changed = true;
    }
    if (!changed) {
      return false;
    }

    this.props.updatedAt = now;
    this.raise(new TodoUpdatedEvent(this.id.value, this.props.userId.value, this.props.completed));
    const scheduledTime = this.props.schedule.scheduledTime;
    if (reopened) {
      this.#restoreReminders();
    } else if (!isSameInstant(scheduledTime, previousScheduledTime)) {
      // 수정 화면의 일반 PATCH로 시각을 바꿔도 옛 시각의 예약이 남지 않게 한다.
      this.raise(new TodoRescheduledEvent(this.id.value, this.props.userId.value, scheduledTime));
    }
    return true;
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

  changeCategory(categoryId: number, now: Temporal.Instant): boolean {
    if (this.props.categoryId === categoryId) {
      return false;
    }
    this.props.categoryId = categoryId;
    this.props.updatedAt = now;
    this.raise(new TodoCategoryChangedEvent(this.id.value, this.props.userId.value, categoryId));
    return true;
  }

  markDeleted(): void {
    this.raise(new TodoDeletedEvent(this.id.value, this.props.userId.value));
  }

  /** 끝에 붙인다. 상한에 닿았으면 TODO_0821이다. */
  addItem(params: {
    readonly id: TodoItemId;
    readonly title: TodoTitle;
    readonly now: Temporal.Instant;
  }): TodoItem {
    const { items } = this.props;
    if (items.length >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
      throw new DomainException(ErrorCode.TODO_0821, {
        currentCount: items.length,
        maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
      });
    }
    const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1);
    const item = TodoItem.create({
      id: params.id,
      title: params.title,
      sortOrder: maxSortOrder + 1,
      now: params.now,
    });
    this.props.items = [...items, item];
    return item;
  }

  /** 제목을 먼저 검증해 실패하면 아무 값도 바꾸지 않는다. 바뀐 값이 없으면 false다. */
  updateItem(
    itemId: number,
    patch: { readonly title?: string; readonly completed?: boolean },
    now: Temporal.Instant,
  ): boolean {
    const item = this.#requireItem(itemId);
    const title = patch.title == null ? null : TodoTitle.create(patch.title);
    const renamed = title != null && item.rename(title, now);
    const completionChanged = patch.completed != null && item.changeCompleted(patch.completed, now);
    return renamed || completionChanged;
  }

  removeItem(itemId: number): void {
    this.#requireItem(itemId);
    this.props.items = this.props.items.filter((item) => item.id.value !== itemId);
  }

  validateItemsReorder(itemIds: readonly number[]): void {
    const currentIds = new Set(this.props.items.map((item) => item.id.value));
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { received: itemIds.length, unique: uniqueItemIds.size },
        "중복된 하위 항목 ID가 있습니다",
      );
    }
    if (itemIds.length !== currentIds.size) {
      throw new DomainException(
        ErrorCode.SYS_0002,
        { expected: currentIds.size, received: itemIds.length },
        "모든 하위 항목 ID를 전달해야 합니다",
      );
    }
    for (const id of itemIds) {
      if (!currentIds.has(id)) {
        throw new DomainException(ErrorCode.TODO_0822, { itemId: id });
      }
    }
  }

  toPrimitives(): TodoPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      categoryId: this.props.categoryId,
      title: this.props.title.value,
      sortOrder: this.props.sortOrder,
      completed: this.props.completed,
      completedAt: this.props.completedAt,
      ...this.props.schedule.toPrimitives(),
      visibility: this.props.visibility,
      seriesId: this.props.seriesId,
      occurrenceDate: this.occurrenceDate,
      items: this.props.items.map((item) => item.toPrimitives()),
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  /** 바뀌었으면 true다. 완료하면 그 시각을 남기고 되돌리면 지운다. */
  #applyCompletion(completed: boolean, now: Temporal.Instant): boolean {
    if (this.props.completed === completed) {
      return false;
    }
    this.props.completed = completed;
    this.props.completedAt = completed ? now : null;
    this.props.updatedAt = now;
    return true;
  }

  /** 완료하면 예약이 지워지므로 되돌릴 때 다시 잡는다. 순간은 재계산이 늘 맞춰 둔다. */
  #restoreReminders(): void {
    const scheduledTime = this.props.schedule.scheduledTime;
    if (scheduledTime != null) {
      this.raise(new TodoRescheduledEvent(this.id.value, this.props.userId.value, scheduledTime));
    }
  }

  #requireItem(itemId: number): TodoItem {
    const item = this.props.items.find((entry) => entry.id.value === itemId);
    if (item == null) {
      throw new DomainException(ErrorCode.TODO_0822, { itemId });
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
    // nullish-strict: endDate null은 종료일 지우기다
    ...(patch.endDate === undefined ? {} : { endDate: patch.endDate }),
    // nullish-strict: 벽시계 null은 시간 지우기다
    ...(patch.scheduledLocalTime === undefined
      ? {}
      : { scheduledLocalTime: patch.scheduledLocalTime }),
    ...(patch.isAllDay == null ? {} : { isAllDay: patch.isAllDay }),
  };
}
