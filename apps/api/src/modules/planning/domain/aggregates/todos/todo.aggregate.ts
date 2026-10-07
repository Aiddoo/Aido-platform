import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

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
  type TodoScheduleProps,
} from "../../value-objects/todos/todo-schedule.vo.js";
import { TodoTitle } from "../../value-objects/todos/todo-title.vo.js";

export type TodoVisibility = "PUBLIC" | "PRIVATE";

export interface TodoDetailsPatch {
  title?: string;
  categoryId?: number;
  startDate?: Date;
  endDate?: Date | null;
  scheduledTime?: Date | null;
  isAllDay?: boolean;
  visibility?: TodoVisibility;
  completed?: boolean;
}

export interface TodoCreationDraft {
  userId: string;
  categoryId: number;
  title: string;
  startDate: Date;
  endDate?: Date | null;
  scheduledTime?: Date | null;
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
  scheduledTime?: Date | null;
  isAllDay?: boolean;
  visibility?: TodoVisibility;
}

export interface TodoPersistenceSnapshot {
  title: string;
  categoryId: number;
  startDate: Date;
  endDate: Date | null;
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
  recurrenceGroupId: string | null;
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
      completedAt: props.completedAt === null ? null : new Date(props.completedAt),
      schedule: props.schedule,
      visibility: props.visibility,
      recurrenceGroupId: props.recurrenceGroupId,
      items: props.items.map((item) => item.clone()),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  static planCreation(input: TodoCreationInput): TodoCreationDraft {
    TodoTitle.create(input.title);
    // 생성 시점에도 일정 불변식(endDate >= startDate) 강제 — 도메인 자기방어
    TodoSchedule.create({
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      scheduledTime: input.scheduledTime ?? null,
      isAllDay: input.isAllDay ?? true,
    });

    return {
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      startDate: new Date(input.startDate),
      endDate: input.endDate == null ? input.endDate : new Date(input.endDate),
      scheduledTime:
        input.scheduledTime == null ? input.scheduledTime : new Date(input.scheduledTime),
      isAllDay: input.isAllDay ?? true,
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

  toggleComplete(completed: boolean, timezone: string): boolean {
    if (this.props.completed === completed) {
      return false;
    }

    this.props.completed = completed;
    this.props.completedAt = completed ? now() : null;

    this.raise(
      new TodoToggledEvent(this.props.id.getValue(), this.props.userId, completed, timezone),
    );
    return true;
  }

  updateDetails(patch: TodoDetailsPatch): void {
    if (Object.values(patch).every((value) => value === undefined)) {
      return;
    }

    // 검증을 모두 통과한 뒤에만 상태를 변경합니다 (부분 변경 방지)
    if (patch.title !== undefined) {
      TodoTitle.create(patch.title);
    }
    const schedulePatch: Partial<TodoScheduleProps> = {};
    if (patch.startDate !== undefined) {
      schedulePatch.startDate = patch.startDate;
    }
    if (patch.endDate !== undefined) {
      schedulePatch.endDate = patch.endDate;
    }
    if (patch.scheduledTime !== undefined) {
      schedulePatch.scheduledTime = patch.scheduledTime;
    }
    if (patch.isAllDay !== undefined) {
      schedulePatch.isAllDay = patch.isAllDay;
    }
    const nextSchedule =
      Object.keys(schedulePatch).length > 0 ? this.props.schedule.patch(schedulePatch) : null;

    if (patch.title !== undefined) {
      this.props.title = patch.title;
    }
    if (patch.categoryId !== undefined) {
      this.props.categoryId = patch.categoryId;
    }
    if (nextSchedule) {
      this.props.schedule = nextSchedule;
    }
    if (patch.visibility !== undefined) {
      this.props.visibility = patch.visibility;
    }
    this.applyCompletionPatch(patch.completed);

    this.raise(
      new TodoUpdatedEvent(this.props.id.getValue(), this.props.userId, this.props.completed),
    );
  }

  private applyCompletionPatch(requestedCompletion: boolean | undefined): void {
    if (requestedCompletion === undefined || requestedCompletion === this.props.completed) {
      return;
    }

    this.props.completed = requestedCompletion;
    this.props.completedAt = requestedCompletion ? now() : null;
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

  updateItem(itemId: number, patch: { title?: string; completed?: boolean }): TodoItem {
    const item = this.#requireItem(itemId);
    if (patch.title !== undefined) {
      item.rename(patch.title);
    }
    if (patch.completed !== undefined) {
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
      scheduledTime: schedule.scheduledTime,
      isAllDay: schedule.isAllDay,
      visibility: this.props.visibility,
      completed: this.props.completed,
      completedAt: this.props.completedAt ? new Date(this.props.completedAt) : null,
    };
  }

  getId(): TodoId {
    return this.props.id;
  }

  getUserId(): string {
    return this.props.userId;
  }

  getSortOrder(): number {
    return this.props.sortOrder;
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
