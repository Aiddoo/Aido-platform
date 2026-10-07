import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_CATEGORY_READER,
  type TodoCategoryReaderPort,
} from "#api/modules/planning/planning-categories.public";

import type {
  UserCategory,
  UserCategoryReaderPort,
} from "../../../application/ports/parsing/user-category-reader.port.js";

@Injectable()
export class TodoCategoryReaderAdapter implements UserCategoryReaderPort {
  constructor(
    @Inject(TODO_CATEGORY_READER)
    private readonly categoryReader: Pick<TodoCategoryReaderPort, "listForUser">,
  ) {}

  async findByUserId(userId: string): Promise<UserCategory[]> {
    const categories = await this.categoryReader.listForUser(userId);
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }
}
