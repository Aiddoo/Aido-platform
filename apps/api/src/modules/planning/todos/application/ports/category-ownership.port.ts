import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";

/**
 * 카테고리 소유권 확인 포트 (todo-category 컨텍스트 경계)
 *
 * 소유권 위반 시 예외를 던집니다(구현체가 기존 검증 로직에 위임).
 */
export abstract class CategoryOwnershipPort {
  abstract validateOwnership(categoryId: TodoCategoryId, userId: UserId): Promise<void>;
}
