import { createParentTodo } from '../__tests__/sub-todo.factories';
import { TodoPolicy } from './todo.model';

describe('TodoPolicy.completesAll', () => {
  it('할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다', () => {
    // Given
    const todos = [createParentTodo({ id: 1, completed: true })];

    // When / Then
    expect(TodoPolicy.completesAll(todos, 1)).toBe(true);
  });

  it('어제 시작한 여러 날 할 일을 오늘 끝내면 오늘 목록에 미완료로 남아 있어도 끝낸 것으로 본다', () => {
    // Given 낙관적 갱신은 시작일 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const multiDay = createParentTodo({
      id: 7,
      startDate: '2026-10-26',
      endDate: '2026-10-28',
      completed: false,
    });
    const lastOpen = [createParentTodo({ id: 1, completed: true }), multiDay];
    const oneMoreOpen = [...lastOpen, createParentTodo({ id: 2, completed: false })];

    // When / Then
    expect(TodoPolicy.completesAll(lastOpen, 7)).toBe(true);
    expect(TodoPolicy.completesAll(oneMoreOpen, 7)).toBe(false);
  });

  it('끝낸 할 일이 그날 목록에 없거나 할 일이 없는 날은 다 끝낸 날이 아니다', () => {
    expect(TodoPolicy.completesAll([createParentTodo({ id: 1, completed: true })], 9)).toBe(false);
    expect(TodoPolicy.completesAll([], 1)).toBe(false);
  });
});
