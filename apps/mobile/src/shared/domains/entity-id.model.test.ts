import { entityIdSchema } from './entity-id.model';

describe('entityIdSchema', () => {
  it.each([
    ['지금 서버의 c+16진수 24자(25자)', 'c0a1b2c3d4e5f60718293a4b5'],
    ['예전 CUID v1(25자)', 'cjld2cjxh0000qzrmn831i7rn'],
    ['예전 사용자 id(29자)', 'cm4k2x9p7q0r5s8t1u4v6w9y2z0ab'],
    ['가장 긴 64자', `c${'a'.repeat(63)}`],
  ])('%s를 받는다', (_label, id) => {
    // When
    const result = entityIdSchema.safeParse(id);

    // Then
    expect(result.success).toBe(true);
  });

  it.each([
    ['대문자', 'cJLD2CJXH0000QZRMN831I7RN'],
    ['하이픈', 'c0a1b2c3-d4e5-f607-1829-3a4b5'],
    ['빈 문자열', ''],
    ['65자', `c${'a'.repeat(64)}`],
    ['c가 아닌 접두사', 'a0a1b2c3d4e5f60718293a4b5'],
  ])('%s는 거부한다', (_label, id) => {
    // When
    const result = entityIdSchema.safeParse(id);

    // Then
    expect(result.success).toBe(false);
  });
});
