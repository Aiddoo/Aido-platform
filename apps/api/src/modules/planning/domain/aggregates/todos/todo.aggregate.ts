import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, type TodoVisibility } from "@aido/api/vocabulary";

import { now } from "#api/shared/domain/date/utils/core";
import { AggregateRoot, DomainException } from "#api/shared/domain/index";

import type { TodoItem } from "../../entities/todos/todo-item.entity.js";
import { TodoCategoryChangedEvent } from "../../events/todos/todo-category-changed.event.js";
import { TodoCreatedEvent } from "../../events/todos/todo-created.event.js";
import { TodoDeletedEvent } from "../../events/todos/todo-deleted.event.js";
import { TodoRescheduledEvent } from "../../events/todos/todo-rescheduled.event.js";
import { TodoToggledEvent } from "../../events/todos/todo-toggled.event.js";
import { TodoUpdatedEvent } from "../../events/todos/todo-updated.event.js";
import { TodoVisibilityChangedEvent } from "../../events/todos/todo-visibility-changed.event.js";
import type { TodoId } from "../../value-objects/todos/todo-id.vo.js";
import {
  TodoSchedule,
  type TodoSchedulePatch,
} from "../../value-objects/todos/todo-schedule.vo.js";
import { TodoTitle } from "../../value-objects/todos/todo-title.vo.js";

export interface TodoDetailsPatch {
  title?: string;
  categoryId?: number;
  startDate?: Date;
  endDate?: Date | null;
  scheduledLocalTime?: string | null;
  isAllDay?: boolean;
  visibility?: TodoVisibility;
  completed?: boolean;
}

export interface TodoCreationDraft {
  userId: string;
  categoryId: number;
  title: string;
  startDate: Date;
  endDate: Date | null;
  scheduledLocalTime: string | null;
  scheduledTime: Date | null;
  isAllDay: boolean;
  visibility: TodoVisibility;
}

export interface TodoCreationPlan extends TodoCreationDraft {
  sortOrder: number;
}

export interface TodoCreationInput {
  userId: string;
  categoryId: number;
  title: string;
  startDate: Date;
  endDate?: Date | null;
  scheduledLocalTime?: string | null;
  timezone: string;
  isAllDay?: boolean;
  visibility?: TodoVisibility;
}

export interface TodoPersistenceSnapshot {
  title: string;
  categoryId: number;
  startDate: Date;
  endDate: Date | null;
  scheduledLocalTime: string | null;
  scheduledTime: Date | null;
  isAllDay: boolean;
  visibility: TodoVisibility;
  completed: boolean;
  completedAt: Date | null;
}

export interface TodoProps {
  id: TodoId;
  userId: string;
  title: string;
  categoryId: number;
  sortOrder: number;
  completed: boolean;
  completedAt: Date | null;
  schedule: TodoSchedule;
  visibility: TodoVisibility;
  seriesId: string | null;
  occurrenceDate: Date | null;
  items: TodoItem[];
  createdAt: Date;
  updatedAt: Date;
}

export class Todo extends AggregateRoot<TodoProps> {
  private constructor(props: TodoProps) {
    super(props);
  }

  static reconstitute(props: TodoProps): Todo {
    return new Todo({
      id: props.id,
      userId: props.userId,
      title: props.title,
      categoryId: props.categoryId,
      sortOrder: props.sortOrder,
      completed: props.completed,
      completedAt: props.completedAt == null ? null : new Date(props.completedAt),
      schedule: props.schedule,
      visibility: props.visibility,
      seriesId: props.seriesId,
      occurrenceDate: props.occurrenceDate == null ? null : new Date(props.occurrenceDate),
      items: props.items.map((item) => item.clone()),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  static planCreation(input: TodoCreationInput): TodoCreationDraft {
    TodoTitle.create(input.title);
    const schedule = TodoSchedule.create({
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      scheduledLocalTime: input.scheduledLocalTime ?? null,
      isAllDay: input.isAllDay ?? true,
      timezone: input.timezone,
    }).getValue();

    return {
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      ...schedule,
      visibility: input.visibility ?? "PUBLIC",
    };
  }

  markCreated(): void {
    this.raise(
      new TodoCreatedEvent(
        this.props.id.getValue(),
        this.props.userId,
        this.props.schedule.getScheduledTime(),
      ),
    );
  }

  /** timezone은 스트릭의 "오늘" 경계다. */
  toggleComplete(completed: boolean, timezone: string): boolean {
    if (this.props.completed === completed) {
      return false;
    }

    this.props.completed = completed;
    this.props.completedAt = completed ? now() : null;

    this.raise(
      new TodoToggledEvent(this.props.id.getValue(), this.props.userId, completed, timezone),
    );
    if (!completed) {
      this.#restoreReminders();
    }
    return true;
  }

  /** 완료하면 예약이 지워지므로 되돌릴 때 다시 잡는다. 순간은 재계산이 늘 맞춰 둔다. */
  #restoreReminders(): void {
    const scheduledTime = this.props.schedule.getScheduledTime();
    if (scheduledTime != null) {
      this.raise(
        new TodoRescheduledEvent(this.props.id.getValue(), this.props.userId, scheduledTime),
      );
    }
  }

  rename(title: string): void {
    TodoTitle.create(title);
    this.props.title = title;
    this.raise(
      new TodoUpdatedEvent(this.props.id.getValue(), this.props.userId, this.props.completed),
    );
  }

  updateDetails(patch: TodoDetailsPatch, timezone: string): void {
    // nullish-strict: PATCH에서 null(비우기)도 변경이다
    if (Object.values(patch).every((value) => value === undefined)) {
      return;
    }

    // 검증을 모두 통과한 뒤에만 상태를 변경합니다 (부분 변경 방지)
    if (patch.title != null) {
      TodoTitle.create(patch.title);
    }
    const schedulePatch: TodoSchedulePatch = {};
    if (patch.startDate != null) {
      schedulePatch.startDate = patch.startDate;
    }
    // nullish-strict: endDate null은 종료일 지우기다
    if (patch.endDate !== undefined) {
      schedulePatch.endDate = patch.endDate;
    }
    // nullish-strict: 벽시계 null은 시간 지우기다
    if (patch.scheduledLocalTime !== undefined) {
      schedulePatch.scheduledLocalTime = patch.scheduledLocalTime;
    }
    if (patch.isAllDay != null) {
      schedulePatch.isAllDay = patch.isAllDay;
    }
    const nextSchedule =
      Object.keys(schedulePatch).length > 0
        ? this.props.schedule.patch(schedulePatch, timezone)
        : null;
    const previousTimeMs = this.props.schedule.getScheduledTime()?.getTime();

    if (patch.title != null) {
      this.props.title = patch.title;
    }
    if (patch.categoryId != null) {
      this.props.categoryId = patch.categoryId;
    }
    if (nextSchedule) {
      this.props.schedule = nextSchedule;
    }
    if (patch.visibility != null) {
      this.props.visibility = patch.visibility;
    }
    const reopened = this.applyCompletionPatch(patch.completed);

    this.raise(
      new TodoUpdatedEvent(this.props.id.getValue(), this.props.userId, this.props.completed),
    );
    if (reopened) {
      this.#restoreReminders();
    } else if (
      nextSchedule != null &&
      nextSchedule.getScheduledTime()?.getTime() !== previousTimeMs
    ) {
      // 수정 화면의 일반 PATCH로 시각을 바꿔도 옛 시각의 예약이 남지 않게 한다.
      this.raise(
        new TodoRescheduledEvent(
          this.props.id.getValue(),
          this.props.userId,
          nextSchedule.getScheduledTime(),
        ),
      );
    }
  }

  /** 완료를 되돌렸으면 true다. */
  private applyCompletionPatch(requestedCompletion: boolean | undefined): boolean {
    if (requestedCompletion == null || requestedCompletion === this.props.completed) {
      return false;
    }

    this.props.completed = requestedCompletion;
    this.props.completedAt = requestedCompletion ? now() : null;
    return !requestedCompletion;
  }

  reschedule(schedule: TodoSchedule): void {
    this.props.schedule = schedule;

    this.raise(
      new TodoRescheduledEvent(
        this.props.id.getValue(),
        this.props.userId,
        schedule.getScheduledTime(),
      ),
    );
  }

  markDeleted(): void {
    this.raise(new TodoDeletedEvent(this.props.id.getValue(), this.props.userId));
  }

  changeVisibility(visibility: TodoVisibility): void {
    this.props.visibility = visibility;
    this.raise(new TodoVisibilityChangedEvent(this.props.id.getValue(), this.props.userId));
  }

  changeCategory(categoryId: number): void {
    this.props.categoryId = categoryId;
    this.raise(
      new TodoCategoryChangedEvent(this.props.id.getValue(), this.props.userId, categoryId),
    );
  }

  // ── 하위 항목 (자식 엔티티) ───────────────────────────────────────────

  planItemAddition(title: string): { title: string; sortOrder: number } {
    TodoTitle.create(title);

    if (this.props.items.length >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
      throw new DomainException(ErrorCode.TODO_0821, {
        currentCount: this.props.items.length,
        maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
      });
    }

    const maxSortOrder = this.props.items.reduce(
      (max, item) => Math.max(max, item.getSortOrder()),
      -1,
    );
    return { title, sortOrder: maxSortOrder + 1 };
  }

  /** 끝낸 일에 항목을 더하면 남은 일이 생긴 것이라 완료를 유지하면 "완료 + 0/N"이 된다(QA #37). */
  reopenForAddedItem(timezone: string): boolean {
    return this.toggleComplete(false, timezone);
  }

  updateItem(itemId: number, patch: { title?: string; completed?: boolean }): TodoItem {
    const item = this.#requireItem(itemId);
    if (patch.title != null) {
      item.rename(patch.title);
    }
    if (patch.completed != null) {
      item.setCompleted(patch.completed);
    }
    return item.clone();
  }

  removeItem(itemId: number): void {
    this.#requireItem(itemId);
    this.props.items = this.props.items.filter((item) => item.getId() !== itemId);
  }

  validateItemsReorder(itemIds: readonly number[]): void {
    const currentIds = new Set(this.getItemIds());
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

  #requireItem(itemId: number): TodoItem {
    const item = this.props.items.find((entry) => entry.getId() === itemId);
    if (!item) {
      throw new DomainException(ErrorCode.TODO_0822, { itemId });
    }
    return item;
  }

  // ── 조회/스냅샷 ─────────────────────────────────────────────────────

  toPersistence(): TodoPersistenceSnapshot {
    const schedule = this.props.schedule.getValue();
    return {
      title: this.props.title,
      categoryId: this.props.categoryId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      scheduledLocalTime: schedule.scheduledLocalTime,
      scheduledTime: schedule.scheduledTime,
      isAllDay: schedule.isAllDay,
      visibility: this.props.visibility,
      completed: this.props.completed,
      completedAt: this.props.completedAt ? new Date(this.props.completedAt) : null,
    };
  }

  /** 칸이 빈 옛 행도 사용자가 보던 시각으로 읽는다. 반복으로 전환할 때 규칙의 시각이 된다. */
  getLocalTimeIn(timezone: string): string | null {
    return this.props.schedule.getLocalTimeIn(timezone);
  }

  getId(): TodoId {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getSeriesId(): string | null {
    return this.props.seriesId;
  }

  getOccurrenceDate(): Date | null {
    return this.props.occurrenceDate == null ? null : new Date(this.props.occurrenceDate);
  }

  getSortOrder(): number {
    return this.props.sortOrder;
  }

  getItemTitles(): { title: string }[] {
    return this.props.items.map((item) => ({ title: item.getTitle() }));
  }

  getItemIds(): number[] {
    return this.props.items.map((item) => item.getId());
  }

  hasItem(itemId: number): boolean {
    return this.props.items.some((item) => item.getId() === itemId);
  }

  isCompleted(): boolean {
    return this.props.completed;
  }

  getCompletedAt(): Date | null {
    return this.props.completedAt ? new Date(this.props.completedAt) : null;
  }
}
