import { Inject, Injectable } from "@nestjs/common";

import { TodoCategoryReaderPort } from "#api/modules/planning/categories/planning-categories.public";

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

  async validateOwnership(categoryId: number, userId: string): Promise<void> {
    await this.#categoryReader.validateOwnership(categoryId, userId);
  }
}
