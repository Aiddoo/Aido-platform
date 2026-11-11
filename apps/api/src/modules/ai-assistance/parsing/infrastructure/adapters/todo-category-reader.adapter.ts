import { Injectable } from "@nestjs/common";

import { TodoCategoryReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type UserCategory,
  UserCategoryReaderPort,
} from "../../application/ports/user-category.reader.port.js";

@Injectable()
export class TodoCategoryReaderAdapter extends UserCategoryReaderPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;

  constructor(categoryReader: TodoCategoryReaderPort) {
    super();
    this.#categoryReader = categoryReader;
  }

  async findByUserId(userId: UserId): Promise<UserCategory[]> {
    const categories = await this.#categoryReader.listForUser(userId);
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }
}
