import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_CATEGORY_READER,
  type TodoCategoryReaderPort,
} from "#api/modules/planning/planning-categories.public";

import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port.js";

@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "validateOwnership">;

  constructor(
    @Inject(TODO_CATEGORY_READER)
    categoryReader: Pick<TodoCategoryReaderPort, "validateOwnership">,
  ) {
    this.#categoryReader = categoryReader;
  }

  async validateOwnership(categoryId: number, userId: string): Promise<void> {
    await this.#categoryReader.validateOwnership(categoryId, userId);
  }
}
