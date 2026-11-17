import { randomUUID } from "node:crypto";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { CategoryChangedEvent, type CategoryChangeEventName } from "./category-changed.event.js";
import { CategoryColor } from "./category-color.vo.js";
import { CategoryName } from "./category-name.vo.js";
import { TodoCategoryId } from "./todo-category-id.vo.js";

export interface TodoCategoryPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly sortOrder: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface TodoCategoryProps {
  readonly userId: UserId;
  name: CategoryName;
  color: CategoryColor;
  sortOrder: number;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateTodoCategoryParams {
  readonly id: TodoCategoryId;
  readonly userId: UserId;
  readonly name: CategoryName;
  readonly color: CategoryColor;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
}

export class TodoCategory extends AggregateRoot<
  TodoCategoryId,
  TodoCategoryProps,
  CategoryChangedEvent
> {
  static create(params: CreateTodoCategoryParams): TodoCategory {
    return new TodoCategory(params.id, {
      userId: params.userId,
      name: params.name,
      color: params.color,
      sortOrder: params.sortOrder,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: TodoCategoryPrimitives): TodoCategory {
    return new TodoCategory(TodoCategoryId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      name: CategoryName.reconstitute(primitives.name),
      color: CategoryColor.reconstitute(primitives.color),
      sortOrder: primitives.sortOrder,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  #deleted = false;

  get userId(): UserId {
    return this.props.userId;
  }

  get name(): CategoryName {
    return this.props.name;
  }

  get color(): CategoryColor {
    return this.props.color;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  // 이름·색상을 모두 검증한 뒤에만 바꾼다. 친구 화면·일별 완료 색이 바뀌어 다른 Context에 알린다
  updateDetails(
    changes: { readonly name?: string; readonly color?: string },
    now: Temporal.Instant,
  ): boolean {
    const name = changes.name == null ? this.props.name : CategoryName.create(changes.name);
    const color = changes.color == null ? this.props.color : CategoryColor.create(changes.color);
    if (name.equals(this.props.name) && color.equals(this.props.color)) {
      return false;
    }
    this.props.name = name;
    this.props.color = color;
    this.props.updatedAt = now;
    this.#raiseChanged("planning.todo-category.updated", now);
    return true;
  }

  // 순서 바꾸기는 카테고리 잠금 아래에서 사이 카테고리를 민 뒤 새 자리를 넘긴다
  moveTo(sortOrder: number, now: Temporal.Instant): boolean {
    if (this.props.sortOrder === sortOrder) {
      return false;
    }
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = now;
    return true;
  }

  markDeleted(now: Temporal.Instant): boolean {
    if (this.#deleted) {
      return false;
    }
    this.#deleted = true;
    this.#raiseChanged("planning.todo-category.deleted", now);
    return true;
  }

  toPrimitives(): TodoCategoryPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      name: this.props.name.value,
      color: this.props.color.value,
      sortOrder: this.props.sortOrder,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  // 카테고리 사실은 안에서 쓰는 곳이 없어 내보내는 이벤트 그대로 낸다
  #raiseChanged(eventName: CategoryChangeEventName, now: Temporal.Instant): void {
    this.raise(
      new CategoryChangedEvent({
        eventName,
        eventId: randomUUID(),
        occurredAt: now,
        categoryId: this.id.value,
        userId: this.props.userId.value,
      }),
    );
  }
}
