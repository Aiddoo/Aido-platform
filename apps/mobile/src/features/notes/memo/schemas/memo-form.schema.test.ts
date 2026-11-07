import { memoFormSchema } from './memo-form.schema';

describe('memoFormSchema', () => {
  it.each([
    { content: '', expected: false },
    { content: '   ', expected: false },
    { content: 'a'.repeat(5000), expected: true },
    { content: 'a'.repeat(5001), expected: false },
  ])('$content.length자는 통과 여부가 $expected다', ({ content, expected }) => {
    // Given
    const values = { content };

    // When
    const result = memoFormSchema.safeParse(values);

    // Then
    expect(result.success).toBe(expected);
  });
});
