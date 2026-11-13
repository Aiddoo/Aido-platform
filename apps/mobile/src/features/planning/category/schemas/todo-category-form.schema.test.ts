import { todoCategoryFormSchema } from './todo-category-form.schema';

describe('todoCategoryFormSchema', () => {
  it.each([
    ['', false],
    ['   ', false],
    ['가', true],
    ['가'.repeat(50), true],
    ['가'.repeat(51), false],
  ])('카테고리 이름 %j 검사 결과는 %s다', (name, expected) => {
    // When
    const result = todoCategoryFormSchema.safeParse({ name, color: '#FF5733' });

    // Then
    expect(result.success).toBe(expected);
  });

  it('앞뒤 공백은 지우고 돌려준다', () => {
    // When
    const result = todoCategoryFormSchema.parse({ name: '  공부  ', color: '#FF5733' });

    // Then
    expect(result.name).toBe('공부');
  });
});
