import { Inject, Injectable } from "@nestjs/common";

import { TodoCategoryReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port.js";

@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "validateOwnership">;

  constructor(
    @Inject(TodoCategoryReaderPort)
    categoryReader: Pick<TodoCategoryReaderPort, "validateOwnership">,
  ) {
    this.#categoryReader = categoryReader;
  }

  async validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void> {
    await this.#categoryReader.validateOwnership(categoryId, userId);
  }
}
