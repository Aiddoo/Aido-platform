import { z } from 'zod';

import { defineFixture } from './fixture';

const memoSchema = z.object({
  content: z.string().min(1),
  tags: z.array(z.string()),
});

describe('defineFixture', () => {
  it('스키마와 어긋난 기본값은 fixture를 정의하는 순간 실패한다', () => {
    // When
    const define = () => defineFixture(memoSchema, { content: '', tags: [] });

    // Then
    expect(define).toThrow(z.ZodError);
  });

  it('한 호출의 중첩 값을 고쳐도 다음 호출은 기본값 그대로다', () => {
    // Given
    const createMemo = defineFixture(memoSchema, { content: '장보기', tags: ['집'] });
    createMemo().tags.push('회사');

    // When
    const memo = createMemo({ content: '우유' });

    // Then
    expect(memo).toEqual({ content: '우유', tags: ['집'] });
  });
});
