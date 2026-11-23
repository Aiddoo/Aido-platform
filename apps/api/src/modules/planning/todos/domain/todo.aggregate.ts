import type { TodoVisibility } from "@aido/api/vocabulary";
import { pick } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import { TodoCategoryId } from "../../todo-categories/domain/todo-category-id.vo.js";
import { TodoOccurrencesChangedEvent } from "../../todo-series/domain/todo-occurrences-changed.event.js";
import { TodoSeriesId } from "../../todo-series/domain/todo-series-id.vo.js";
import { TodoCategoryChangedEvent } from "./todo-category-changed.event.js";
import {
  appendChecklistItem,
  findChecklistItem,
  orderChecklistItems,
} from "./todo-checklist.domain-service.js";
import { TodoCreatedEvent } from "./todo-created.event.js";
import { TodoDeletedEvent } from "./todo-deleted.event.js";
import {
  isSameInstant,
  isSameTodoDetails,
  patchTodoDetails,
  type TodoDetailsPatch,
} from "./todo-details-patch.domain-service.js";
import { TodoId } from "./todo-id.vo.js";
import type { TodoItemId } from "./todo-item-id.vo.js";
import { TodoItem, type TodoItemChange, type TodoItemPrimitives } from "./todo-item.entity.js";
import { TodoRescheduledEvent } from "./todo-rescheduled.event.js";
import { TODO_SCHEDULE_FIELDS, TodoSchedule } from "./todo-schedule.vo.js";
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
  | TodoCategoryChangedEvent
  | TodoOccurrencesChangedEvent;

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
      schedule: TodoSchedule.reconstitute(pick(primitives, TODO_SCHEDULE_FIELDS)),
      visibility: primitives.visibility,
      seriesId: primitives.seriesId == null ? null : TodoSeriesId.reconstitute(primitives.seriesId),
      occurrenceDate: primitives.occurrenceDate,
      items: primitives.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  #deleted = false;

  #itemsChanged = false;

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

  isCompleted(): boolean {
    return this.props.completed;
  }

  // 저장소가 하위 항목 문장을 건너뛸지 본다. 완료·제목·일정 같은 할 일 칸만 바뀐 저장은 항목을 다시 쓰지 않는다
  hasChangedItems(): boolean {
    return this.#itemsChanged;
  }

  isOccurrence(): boolean {
    return this.props.seriesId != null;
  }

  // timezone은 스트릭의 "오늘" 경계다. 완료하면 리마인더가 취소된다
  complete(timezone: string, now: Temporal.Instant): boolean {
    return this.#setCompleted(true, timezone, now);
  }

  // 완료하면 예약이 지워지므로 되돌리면 지금 시각으로 다시 잡는다
  reopen(timezone: string, now: Temporal.Instant): boolean {
    if (!this.#setCompleted(false, timezone, now)) {
      return false;
    }
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
    const next = patchTodoDetails(this.props, patch, timezone);
    const previousScheduledTime = this.props.schedule.scheduledTime;
    const detailsChanged = !isSameTodoDetails(this.props, next);
    Object.assign(this.props, next);

    const reopens = patch.completed === false && this.props.completed;
    if (detailsChanged) {
      this.props.updatedAt = now;
      const completedAfter = patch.completed ?? this.props.completed;
      this.raise(new TodoUpdatedEvent(this.id.value, this.props.userId.value, completedAfter));
      const { scheduledTime } = this.props.schedule;
      // 되돌리기는 reopen이 새 시각으로 다시 잡는다. 시각만 바꾼 PATCH도 옛 시각의 예약이 남지 않게 한다
      if (!reopens && !isSameInstant(scheduledTime, previousScheduledTime)) {
        this.#raiseRescheduled(completedAfter);
      }
    }
    const completionChanged =
      patch.completed === true
        ? this.complete(timezone, now)
        : patch.completed === false && this.reopen(timezone, now);
    return detailsChanged || completionChanged;
  }

  reschedule(schedule: TodoSchedule, now: Temporal.Instant): boolean {
    if (schedule.equals(this.props.schedule)) {
      return false;
    }
    this.props.schedule = schedule;
    this.props.updatedAt = now;
    this.#raiseRescheduled(this.props.completed);
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

  // 범위 수정·삭제가 이 회차가 속한 반복의 회차 행을 묶음 문장으로 바꿨을 때 행마다가 아니라 한 번 알린다
  markOccurrencesChanged(changedCount: number): boolean {
    const { seriesId } = this.props;
    if (seriesId == null || changedCount === 0) {
      return false;
    }
    this.raise(new TodoOccurrencesChangedEvent(seriesId.value, this.props.userId.value));
    return true;
  }

  // 끝에 붙인다. 끝낸 일에 항목을 더하면 남은 일이 생긴 것이라 다시 연다("완료 + 0/N"을 막는다, QA #37)
  addItem(params: {
    readonly id: TodoItemId;
    readonly title: TodoTitle;
    readonly timezone: string;
    readonly now: Temporal.Instant;
  }): TodoItem {
    const checklistItem = appendChecklistItem(this.props.items, params);
    this.props.items = [...this.props.items, checklistItem];
    this.#itemsChanged = true;
    this.reopen(params.timezone, params.now);
    return checklistItem;
  }

  updateItem(itemId: TodoItemId, change: TodoItemChange, now: Temporal.Instant): boolean {
    const changed = findChecklistItem(this.props.items, itemId).edit(change, now);
    this.#itemsChanged ||= changed;
    return changed;
  }

  removeItem(itemId: TodoItemId): boolean {
    findChecklistItem(this.props.items, itemId);
    this.props.items = this.props.items.filter((item) => !item.id.equals(itemId));
    this.#itemsChanged = true;
    return true;
  }

  reorderItems(itemIds: readonly TodoItemId[], now: Temporal.Instant): boolean {
    const ordered = orderChecklistItems(this.props.items, itemIds);
    const moved = ordered.map((item, sortOrder) => item.moveTo(sortOrder, now));
    this.props.items = ordered;
    this.#itemsChanged ||= moved.some(Boolean);
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

  #setCompleted(completed: boolean, timezone: string, now: Temporal.Instant): boolean {
    if (this.props.completed === completed) {
      return false;
    }
    this.props.completed = completed;
    this.props.completedAt = completed ? now : null;
    this.props.updatedAt = now;
    const userId = this.props.userId.value;
    this.raise(new TodoToggledEvent({ todoId: this.id.value, userId, completed, timezone }));
    return true;
  }

  // 끝낸 할 일은 울릴 알림이 없어 순간 없이 낸다. 리마인더는 지우고 다른 Context에는 일정이 바뀐 사실만 간다
  #raiseRescheduled(completed: boolean): void {
    const scheduledTime = completed ? null : this.props.schedule.scheduledTime;
    this.raise(new TodoRescheduledEvent(this.id.value, this.props.userId.value, scheduledTime));
  }
}
