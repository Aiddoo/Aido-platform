import type { FriendTodoReadModel } from "./todo.read-model.js";

export interface TodoAccessReadModel {
  readonly ownerId: string;
  readonly visibility: FriendTodoReadModel["visibility"];
}

export interface TodoDetailsReadModel {
  readonly todo: FriendTodoReadModel;
  readonly viewCount: number;
}
