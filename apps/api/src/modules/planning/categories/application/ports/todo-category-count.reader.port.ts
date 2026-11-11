import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 지금 가진 카테고리 개수. 카테고리 만들기 한도 검사와 같은 개수(countByUserId)를 캐시 없이 센다. */
export abstract class TodoCategoryCountReaderPort {
  abstract countCategories(userId: UserId): Promise<number>;
}
