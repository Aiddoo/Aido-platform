import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";

export interface TodoCategoryCreationDraft {
  readonly name: string;
  readonly color: string;
}

// 다른 slice가 자기 UoW에서 카테고리를 함께 만든다. 사용자 카테고리 잠금을 쥔 뒤 부르고 한도·이름 규칙은 직접 만들기와 같다
export abstract class TodoCategoryCreatorPort {
  abstract createMany(
    userId: UserId,
    drafts: readonly TodoCategoryCreationDraft[],
  ): Promise<readonly TodoCategoryId[]>;
}
