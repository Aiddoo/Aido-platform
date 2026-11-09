import { subTodoFormSchema } from './sub-todo-form.schema';

describe('subTodoFormSchema', () => {
  it('공백만 있는 제목은 빈 제목이라 저장할 수 없다', () => {
    // Given
    const values = { title: '   ' };

    // When
    const result = subTodoFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(false);
  });

  it('앞뒤 공백을 지운 제목을 저장한다', () => {
    // Given
    const values = { title: '  우유 사기  ' };

    // When
    const result = subTodoFormSchema.parse(values);

    // Then
    expect(result.title).toBe('우유 사기');
  });
});
