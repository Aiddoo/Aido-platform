import { z } from 'zod';

/** 마지막 쪽이면 `nextCursor`가 null이다. 서버의 hasNext·hasMore와 커서 고르기는 mapper가 여기로 접는다 */
export function cursorPageSchema<TItem extends z.ZodType, TCursor extends z.ZodType>(
  item: TItem,
  cursor: TCursor,
) {
  return z.object({ items: z.array(item), nextCursor: cursor.nullable() });
}
