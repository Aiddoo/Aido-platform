import { z } from 'zod';

import { trimmed } from './trimmed.schema';

const MAX_LENGTH = 5;
const schema = trimmed(z.string().min(1).max(MAX_LENGTH));

describe('trimmed', () => {
  it.each([
    { name: '빈 값', value: '', expected: false },
    { name: '공백만 쓴 값', value: '   ', expected: false },
    { name: '한 글자', value: '가', expected: true },
    { name: '한도 글자 수', value: '가'.repeat(MAX_LENGTH), expected: true },
    { name: '한도를 넘은 글자 수', value: '가'.repeat(MAX_LENGTH + 1), expected: false },
    {
      name: '앞뒤 공백을 지우면 한도인 값',
      value: ` ${'가'.repeat(MAX_LENGTH)}\n`,
      expected: true,
    },
  ])('$name이면 통과 여부가 $expected다', ({ value, expected }) => {
    // When
    const result = schema.safeParse(value);

    // Then
    expect(result.success).toBe(expected);
  });

  it('앞뒤 공백을 지운 값을 돌려준다', () => {
    // When
    const result = schema.parse('  우유  ');

    // Then
    expect(result).toBe('우유');
  });
});
