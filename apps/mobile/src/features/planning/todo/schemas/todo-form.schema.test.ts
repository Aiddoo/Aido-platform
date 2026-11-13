import { TODO_LIMITS } from '@aido/api/vocabulary';

import { createTodoFormValues } from '../__tests__/todo.fixtures';
import { todoFormSchema } from './todo-form.schema';

describe('todoFormSchema', () => {
  it.each([
    { name: '빈 제목', title: '', expected: false },
    { name: '공백만 쓴 제목', title: '   ', expected: false },
    { name: '한 글자', title: '가', expected: true },
    { name: '한도 글자 수', title: '가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH), expected: true },
    {
      name: '한도를 넘은 글자 수',
      title: '가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH + 1),
      expected: false,
    },
    {
      name: '공백을 지우면 한도인 제목',
      title: ` ${'가'.repeat(TODO_LIMITS.TITLE_MAX_LENGTH)} `,
      expected: true,
    },
  ])('$name으로 저장할 수 있는지는 $expected다', ({ title, expected }) => {
    // When
    const result = todoFormSchema.safeParse(createTodoFormValues({ title }));

    // Then
    expect(result.success).toBe(expected);
  });
});
