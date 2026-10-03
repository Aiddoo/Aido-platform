import { memoListResponseSchema } from '@aido/validators';

import { toMemoPage } from './memo.mapper';

describe('메모 페이지 응답 매핑', () => {
  test('날짜를 변환하고 다음 페이지 커서를 화면 모델로 분리한다', () => {
    // Given
    const dto = memoListResponseSchema.parse({
      items: [
        {
          id: 12,
          userId: 'clz7x5p8k0010qz0z8z8z8z8z',
          content: '장보기',
          isPinned: false,
          sortOrder: 0,
          createdAt: '2026-10-03T00:00:00Z',
          updatedAt: '2026-10-03T01:00:00Z',
        },
      ],
      pagination: { nextCursor: 12, hasNext: true, size: 20 },
    });
    // When
    const result = toMemoPage(dto);
    // Then
    expect(result.nextCursor).toBe(12);
    expect(result.hasNext).toBe(true);
    expect(result.items[0]?.createdAt).toEqual(new Date('2026-10-03T00:00:00Z'));
    expect(result.items[0]).not.toHaveProperty('userId');
  });

  test('빈 마지막 페이지는 추가 조회를 유발하는 커서를 만들지 않는다', () => {
    // Given
    const dto = memoListResponseSchema.parse({
      items: [],
      pagination: { nextCursor: null, hasNext: false, size: 20 },
    });
    // When
    const result = toMemoPage(dto);
    // Then
    expect(result).toEqual({ items: [], nextCursor: null, hasNext: false });
  });
});
