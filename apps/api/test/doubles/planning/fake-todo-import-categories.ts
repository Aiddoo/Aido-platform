import type { TodoCategoryWithCountReadModel } from "#api/modules/planning/todo-categories/application/read-models/todo-category-with-count.read-model";
import {
  type TodoCategoryCreationDraft,
  TodoCategoryCreatorPort,
  TodoCategoryId,
  TodoCategoryReaderPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface FakeCategory {
  readonly id: number;
  readonly name: string;
  usage: number;
}

/**
 * 가져오기가 쓰는 카테고리 문 둘(목록·일괄 만들기)을 한 사용자의 메모리 목록으로 흉내 낸다.
 * 한도·이름 규칙은 가져오기 쪽 검사로 보므로 만들기는 그대로 더한다.
 */
export class FakeTodoImportCategories {
  readonly categories: FakeCategory[];
  readonly created: TodoCategoryCreationDraft[] = [];
  #sequence = 100;

  constructor(categories: readonly { id: number; name: string; usage?: number }[] = []) {
    this.categories = categories.map((category) => ({ ...category, usage: category.usage ?? 0 }));
  }

  get reader(): Pick<TodoCategoryReaderPort, "listForUser"> {
    return {
      listForUser: async (userId: UserId): Promise<TodoCategoryWithCountReadModel[]> =>
        this.categories.map((category, sortOrder) => ({
          id: category.id,
          userId: userId.value,
          name: category.name,
          color: "#3B82F6",
          sortOrder,
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
          todoCount: category.usage,
        })),
    };
  }

  get creator(): Pick<TodoCategoryCreatorPort, "createMany"> {
    return {
      createMany: async (_userId: UserId, drafts: readonly TodoCategoryCreationDraft[]) =>
        drafts.map((draft) => {
          this.#sequence += 1;
          this.created.push(draft);
          this.categories.push({ id: this.#sequence, name: draft.name, usage: 0 });
          return TodoCategoryId.reconstitute(this.#sequence);
        }),
    };
  }
}
