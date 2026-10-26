import { createParentTodo } from '../__tests__/sub-todo.factories';
import { TodoPolicy } from './todo.model';

describe('TodoPolicy.areAllCompleted', () => {
  it('할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다', () => {
    expect(TodoPolicy.areAllCompleted([createParentTodo({ completed: true })])).toBe(true);
  });

  it('남은 할 일이 있거나 할 일이 없는 날은 다 끝낸 날이 아니다', () => {
    expect(
      TodoPolicy.areAllCompleted([
        createParentTodo({ id: 1, completed: true }),
        createParentTodo({ id: 2, completed: false }),
      ]),
    ).toBe(false);
    expect(TodoPolicy.areAllCompleted([])).toBe(false);
  });
});
