/** 카테고리와 그 카테고리의 할 일 개수. 목록 캐시에 그대로 담는다. */
export interface TodoCategoryWithCountReadModel {
  readonly id: number;
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly todoCount: number;
}
