import { memoSchema as memoDtoSchema } from '@aido/api/contracts/memo/v1';
import { defineFixture } from '@src/testing/fixture';

export const MEMO_ID = 5;
export const ACCOUNT_ID = 'account-1';

/** 서버가 돌려주는 메모 한 건. 목록·상세·수정 응답이 함께 쓴다 */
export const createMemoDto = defineFixture(memoDtoSchema, {
  id: MEMO_ID,
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  content: '처음 메모',
  isPinned: false,
  sortOrder: 0,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});

/** 고친 글을 저장한 뒤의 메모. 수정 시각이 1분 늦다 */
export const SAVED_MEMO_DTO = createMemoDto({
  content: '고친 메모',
  updatedAt: '2026-11-06T00:01:00.000Z',
});

export function createMemoListDto(
  items: ReturnType<typeof createMemoDto>[],
  { nextCursor = null }: { nextCursor?: number | null } = {},
) {
  return {
    items,
    pagination: { nextCursor, hasNext: nextCursor != null, size: 20 },
  };
}
