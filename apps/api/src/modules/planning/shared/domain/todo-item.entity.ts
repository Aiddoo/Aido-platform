import { Entity } from "#api/shared/domain/model/entity";

import { TodoItemId } from "./todo-item-id.vo.js";
import { TodoTitle } from "./todo-title.vo.js";

export interface TodoItemPrimitives {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly sortOrder: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface TodoItemProps {
  title: TodoTitle;
  completed: boolean;
  readonly sortOrder: number;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateTodoItemParams {
  readonly id: TodoItemId;
  readonly title: TodoTitle;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
}

export class TodoItem extends Entity<TodoItemId, TodoItemProps> {
  static create(params: CreateTodoItemParams): TodoItem {
    return new TodoItem(params.id, {
      title: params.title,
      completed: false,
      sortOrder: params.sortOrder,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: TodoItemPrimitives): TodoItem {
    return new TodoItem(TodoItemId.reconstitute(primitives.id), {
      title: TodoTitle.reconstitute(primitives.title),
      completed: primitives.completed,
      sortOrder: primitives.sortOrder,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get title(): TodoTitle {
    return this.props.title;
  }

  get completed(): boolean {
    return this.props.completed;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  rename(title: TodoTitle, now: Temporal.Instant): boolean {
    if (this.props.title.equals(title)) {
      return false;
    }
    this.props.title = title;
    this.props.updatedAt = now;
    return true;
  }

  changeCompleted(completed: boolean, now: Temporal.Instant): boolean {
    if (this.props.completed === completed) {
      return false;
    }
    this.props.completed = completed;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): TodoItemPrimitives {
    return {
      id: this.id.value,
      title: this.props.title.value,
      completed: this.props.completed,
      sortOrder: this.props.sortOrder,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
