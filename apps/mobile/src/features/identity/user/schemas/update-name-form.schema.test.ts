import { updateNameFormSchema } from './update-name-form.schema';

describe('updateNameFormSchema', () => {
  it.each([
    ['', false],
    ['   ', false],
    ['가', true],
    ['가'.repeat(20), true],
    ['가'.repeat(21), false],
  ])('이름 %j 검사 결과는 %s다', (name, expected) => {
    // When
    const result = updateNameFormSchema.safeParse({ name });

    // Then
    expect(result.success).toBe(expected);
  });

  it('앞뒤 공백은 지우고 돌려준다', () => {
    // When
    const result = updateNameFormSchema.parse({ name: '  가나  ' });

    // Then
    expect(result.name).toBe('가나');
  });
});
