import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoDetails } from '../__tests__/todo.fixtures';
import { TodoDetailsPolicy } from './todo-details.model';

describe('TodoDetailsPolicy', () => {
  describe('canReport', () => {
    it('수정할 수 없는 남의 할 일은 신고할 수 있다', () => {
      // Given
      const details = createTodoDetails({
        permissions: { canEdit: false, canComment: true, canNudge: true, canThank: false },
      });

      // When
      const result = TodoDetailsPolicy.canReport(details);

      // Then
      expect(result).toBe(true);
    });

    it('수정할 수 있는 내 할 일은 신고할 수 없다', () => {
      // Given
      const details = createTodoDetails({
        permissions: { canEdit: true, canComment: true, canNudge: true, canThank: false },
      });

      // When
      const result = TodoDetailsPolicy.canReport(details);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('withTodo', () => {
    it('할 일만 바꾸고 주인·권한·숫자는 그대로 둔다', () => {
      // Given
      const details = createTodoDetails();
      const completed = createParentTodo({ completed: true });

      // When
      const next = TodoDetailsPolicy.withTodo(details, completed);

      // Then
      expect(next).toEqual({ ...details, todo: completed });
      expect(next.permissions).toBe(details.permissions);
    });
  });
});
