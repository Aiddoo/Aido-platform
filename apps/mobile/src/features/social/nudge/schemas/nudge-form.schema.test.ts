import { nudgeFormSchema } from './nudge-form.schema';

describe('nudgeFormSchema', () => {
  it.each([
    { length: 200, expected: true },
    { length: 201, expected: false },
  ])('메시지가 $length자면 보낼 수 있는지는 $expected다', ({ length, expected }) => {
    // When
    const result = nudgeFormSchema.safeParse({ message: 'a'.repeat(length) });

    // Then
    expect(result.success).toBe(expected);
  });

  it('메시지 칸이 없어도 보낼 수 있다', () => {
    // When
    const result = nudgeFormSchema.safeParse({});

    // Then
    expect(result.success).toBe(true);
  });

  it('앞뒤 공백까지 세어 한도를 넘으면 막는다', () => {
    // Given
    // 공백을 지우면 200자로 한도 안이지만 폼은 입력한 그대로 센다
    const message = ` ${'a'.repeat(200)} `;

    // When
    const result = nudgeFormSchema.safeParse({ message });

    // Then
    expect(result.success).toBe(false);
  });
});
