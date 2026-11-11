import { z } from "zod";

interface CursorPageDescriptions {
  readonly items: string;
  readonly pagination: string;
}

/**
 * 표준 커서 목록 `{ items, pagination: { nextCursor, hasNext, size } }`. 새 목록 endpoint는 이 모양만 쓴다.
 * 설명은 Swagger 문서라 기존 계약을 옮길 때 그 계약의 문구를 그대로 넘긴다.
 */
export function cursorPageSchema<TItem extends z.ZodType, TCursor extends z.ZodType>(
  item: TItem,
  cursor: TCursor,
  descriptions?: CursorPageDescriptions,
) {
  const items = z.array(item);
  const pagination = z.object({
    nextCursor: cursor.nullable(),
    hasNext: z.boolean(),
    size: z.number(),
  });

  return z.object({
    items: descriptions == null ? items : items.describe(descriptions.items),
    pagination: descriptions == null ? pagination : pagination.describe(descriptions.pagination),
  });
}
