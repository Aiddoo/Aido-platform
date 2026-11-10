// 옛 Symbol 토큰. 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_CATEGORY_COUNT_READER = Symbol("TODO_CATEGORY_COUNT_READER");

/** 지금 가진 카테고리 개수. 카테고리 만들기 한도 검사와 같은 개수(countByUserId)를 캐시 없이 센다. */
export abstract class TodoCategoryCountReaderPort {
  abstract countCategories(userId: string): Promise<number>;
}
