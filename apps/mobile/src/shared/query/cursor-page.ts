interface ItemPage<TItem> {
  items: TItem[];
}

interface Pages<TPage> {
  pages: TPage[];
}

// TanStack getNextPageParam은 undefined로 마지막 쪽을 알린다
export function getNextCursor<TCursor>(page: { nextCursor: TCursor | null }): TCursor | undefined {
  return page.nextCursor ?? undefined;
}

export function selectPageItems<TItem>(data: {
  pages: ReadonlyArray<{ items: readonly TItem[] }>;
}): TItem[] {
  return data.pages.flatMap((page) => page.items);
}

/** 바뀐 항목이 없는 쪽과 데이터는 그대로 돌려 그 쪽을 그리는 행이 다시 그려지지 않는다 */
export function mapInfiniteItems<TItem, TPage extends ItemPage<TItem>, TData extends Pages<TPage>>(
  data: TData & Pages<TPage & ItemPage<TItem>>,
  transform: (item: TItem) => TItem,
): TData {
  let hasChangedPage = false;
  const pages = data.pages.map((page) => {
    const items = page.items.map(transform);
    if (items.every((item, index) => item === page.items[index])) {
      return page;
    }
    hasChangedPage = true;
    return { ...page, items };
  });
  return hasChangedPage ? { ...data, pages } : data;
}
