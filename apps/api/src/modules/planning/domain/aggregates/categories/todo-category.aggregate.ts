import { AggregateRoot } from "#api/shared/domain/index";

import { TodoCategoryUpdatedEvent } from "../../events/categories/todo-category-updated.event.js";
import { CategoryColor } from "../../value-objects/categories/category-color.vo.js";
import { CategoryName } from "../../value-objects/categories/category-name.vo.js";

export interface TodoCategoryProps {
  id: number;
  userId: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TodoCategory extends AggregateRoot<{
  id: number;
  userId: string;
  name: CategoryName;
  color: CategoryColor;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}> {
  private constructor(props: {
    id: number;
    userId: string;
    name: CategoryName;
    color: CategoryColor;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    super(props);
  }

  static reconstitute(props: TodoCategoryProps): TodoCategory {
    return new TodoCategory({
      id: props.id,
      userId: props.userId,
      sortOrder: props.sortOrder,
      name: CategoryName.of(props.name),
      color: CategoryColor.of(props.color),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  get id(): number {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name.value;
  }

  get color(): string {
    return this.props.color.value;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  updateDetails(changes: { name?: string; color?: string }): void {
    const name = changes.name === undefined ? this.props.name : CategoryName.of(changes.name);
    const color = changes.color === undefined ? this.props.color : CategoryColor.of(changes.color);
    const changed = name.value !== this.name || color.value !== this.color;
    this.props.name = name;
    this.props.color = color;
    if (changed) {
      this.raise(new TodoCategoryUpdatedEvent(this.userId, this.id));
    }
  }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }
}
