import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_CATEGORY_READER,
  type TodoCategoryReaderPort,
} from "#api/modules/planning/categories/planning-categories.public";

import type {
  UserCategory,
  UserCategoryReaderPort,
} from "../../application/ports/user-category.reader.port.js";

@Injectable()
export class TodoCategoryReaderAdapter implements UserCategoryReaderPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;

  constructor(
    @Inject(TODO_CATEGORY_READER)
    categoryReader: Pick<TodoCategoryReaderPort, "listForUser">,
  ) {
    this.#categoryReader = categoryReader;
  }

  async findByUserId(userId: string): Promise<UserCategory[]> {
    const categories = await this.#categoryReader.listForUser(userId);
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }
}
