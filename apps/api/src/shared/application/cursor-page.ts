import { clamp } from "es-toolkit";

export interface CursorPage<TItem, TCursor extends string | number> {
  readonly items: readonly TItem[];
  readonly pagination: {
    readonly nextCursor: TCursor | null;
    readonly hasNext: boolean;
    readonly size: number;
  };
}

// 계약의 size 범위(1-200, 기본 20)와 같다
export function clampPageSize(size: number | undefined): number {
  const PAGE_SIZE = { DEFAULT: 20, MIN: 1, MAX: 200 } as const;
  return clamp(size ?? PAGE_SIZE.DEFAULT, PAGE_SIZE.MIN, PAGE_SIZE.MAX);
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

export function emptyCursorPage<TItem, TCursor extends string | number>(
  size: number,
): CursorPage<TItem, TCursor> {
  return { items: [], pagination: { nextCursor: null, hasNext: false, size } };
}

// 그 사이 지워진 상대처럼 매핑에서 빠지는 행이 있어도 다음 쪽 여부와 커서는 읽은 원래 행으로 정한다
export async function toMappedCursorPage<TRow, TItem, TCursor extends string | number>(params: {
  readonly rows: readonly TRow[];
  readonly size: number;
  readonly toCursor: (row: TRow) => TCursor;
  readonly toItems: (rows: readonly TRow[]) => Promise<readonly TItem[]> | readonly TItem[];
}): Promise<CursorPage<TItem, TCursor>> {
  const { rows, size, toCursor, toItems } = params;
  const page = toCursorPage({ rows, size, toCursor });
  return { items: await toItems(page.items), pagination: page.pagination };
}
