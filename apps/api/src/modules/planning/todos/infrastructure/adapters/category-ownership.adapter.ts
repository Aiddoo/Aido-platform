import { Inject, Injectable } from "@nestjs/common";

import { TodoCategoryReaderPort } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port.js";

@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
  readonly #categoryReader: Pick<
    TodoCategoryReaderPort,
    "validateOwnership" | "listOwnedCategoryIds"
  >;

  constructor(
    @Inject(TodoCategoryReaderPort)
    categoryReader: Pick<TodoCategoryReaderPort, "validateOwnership" | "listOwnedCategoryIds">,
  ) {
    this.#categoryReader = categoryReader;
  }

  async validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void> {
    await this.#categoryReader.validateOwnership(categoryId, userId);
  }

  listOwnedCategoryIds(
    userId: UserId,
    categoryIds: readonly TodoCategoryId[],
  ): Promise<ReadonlySet<number>> {
    return this.#categoryReader.listOwnedCategoryIds(userId, categoryIds);
  }
}
