import { Injectable } from "@nestjs/common";

import { TodoCategoryReaderPort } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserCategoryReaderPort } from "../../application/ports/user-category.reader.port.js";
import type { UserCategoryReadModel } from "../../application/read-models/user-category.read-model.js";

@Injectable()
export class TodoCategoryReaderAdapter extends UserCategoryReaderPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;

  constructor(categoryReader: TodoCategoryReaderPort) {
    super();
    this.#categoryReader = categoryReader;
  }

  async findByUserId(userId: UserId): Promise<UserCategoryReadModel[]> {
    const categories = await this.#categoryReader.listForUser(userId);
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }
}
