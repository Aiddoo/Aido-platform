// 일별 완료 달력 점 색이 카테고리 색이라 바뀌면 insights가 커밋 뒤 캐시를 지운다
export class TodoCategoryChangedEvent {
  readonly eventName = "todo.category-changed";

  readonly todoId: number;
  readonly userId: string;
  readonly categoryId: number;

  constructor(todoId: number, userId: string, categoryId: number) {
    this.todoId = todoId;
    this.userId = userId;
    this.categoryId = categoryId;
  }
}
