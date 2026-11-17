import { eq } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { todoCategory } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 다른 Context가 한 사람의 카테고리 이름·색을 한 SQL로 읽는 하위 질의다
export function todoCategoriesOf(userId: UserId) {
  return new QueryBuilder()
    .select({ id: todoCategory.id, name: todoCategory.name, color: todoCategory.color })
    .from(todoCategory)
    .where(eq(todoCategory.userId, userId.value))
    .as("user_todo_categories");
}
