import { Entity } from "#api/shared/domain/index";

import { TodoTitle } from "../../value-objects/todos/todo-title.vo.js";

export interface TodoItemProps {
  id: number;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TodoItem extends Entity<TodoItemProps> {
  private constructor(props: TodoItemProps) {
    super(props);
  }

  static reconstitute(props: TodoItemProps): TodoItem {
    return new TodoItem({
      id: props.id,
      title: props.title,
      completed: props.completed,
      sortOrder: props.sortOrder,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  clone(): TodoItem {
    return TodoItem.reconstitute(this.props);
  }

  rename(title: string): void {
    TodoTitle.create(title);
    this.props.title = title;
  }

  setCompleted(completed: boolean): void {
    this.props.completed = completed;
  }

  getId(): number {
    return this.props.id;
  }

  getTitle(): string {
    return this.props.title;
  }

  isCompleted(): boolean {
    return this.props.completed;
  }

  getSortOrder(): number {
    return this.props.sortOrder;
  }

  toPersistence(): { title: string; completed: boolean } {
    return {
      title: this.props.title,
      completed: this.props.completed,
    };
  }
}
