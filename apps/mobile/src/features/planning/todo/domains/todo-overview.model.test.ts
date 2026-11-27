import { TodoOverviewPolicy } from './todo-overview.model';

describe('TodoOverviewPolicy', () => {
  describe('withTodoCreated', () => {
    it('이미 참이면 같은 객체를 돌려 구독자가 다시 그리지 않는다', () => {
      // Given
      const overview = { hasTodo: true, hasCompletedTodo: false, hasActiveRepeat: false };

      // When
      const created = TodoOverviewPolicy.withTodoCreated(overview);

      // Then
      expect(created).toBe(overview);
    });
  });

  describe('withTodoCompleted', () => {
    it('끝낸 적이 없던 기록은 끝낸 적 있음으로 바뀐다', () => {
      // Given
      const overview = { hasTodo: true, hasCompletedTodo: false, hasActiveRepeat: false };

      // When
      const completed = TodoOverviewPolicy.withTodoCompleted(overview);

      // Then
      expect(completed).toEqual({ hasTodo: true, hasCompletedTodo: true, hasActiveRepeat: false });
    });
  });
});
