import { clamp } from "es-toolkit";

import { PAGINATION_DEFAULT } from "./pagination/constants/pagination.constant.js";

export interface CursorPage<TItem, TCursor extends string | number> {
  readonly items: readonly TItem[];
  readonly pagination: {
    readonly nextCursor: TCursor | null;
    readonly hasNext: boolean;
    readonly size: number;
  };
}

export function clampPageSize(size: number | undefined): number {
  return clamp(
    size ?? PAGINATION_DEFAULT.SIZE,
    PAGINATION_DEFAULT.MIN_SIZE,
    PAGINATION_DEFAULT.MAX_SIZE,
  );
}

// rows는 다음 페이지가 있는지 보려고 size+1개까지 읽은 결과다
export function toCursorPage<TItem, TCursor extends string | number>(params: {
  readonly rows: readonly TItem[];
  readonly size: number;
  readonly toCursor: (item: TItem) => TCursor;
}): CursorPage<TItem, TCursor> {
  const { rows, size, toCursor } = params;
  const hasNext = rows.length > size;
  const items = hasNext ? rows.slice(0, size) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    pagination: {
      nextCursor: hasNext && lastItem != null ? toCursor(lastItem) : null,
      hasNext,
      size,
    },
  };
}
