/**
 * Todo 카테고리 변경 도메인 이벤트 (PATCH /todos/:id/category)
 *
 * 일별 완료 통계는 각 할 일의 카테고리 색상을 일자별로 집계하므로,
 * 카테고리가 바뀌면 daily-completion 캐시(캘린더 dot 색상)가 스테일해집니다.
 * planning.todo.category-changed로 바뀌어 insights가 커밋 뒤 캐시를 지웁니다.
 */
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
