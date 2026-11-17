import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

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
  readonly sortOrder: number;
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

export class TodoCategory extends AggregateRoot<TodoCategoryId, TodoCategoryProps> {
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

  /** 이름·색상을 모두 검증한 뒤에만 바꾼다. 같은 값만 보냈으면 false다. */
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
}
