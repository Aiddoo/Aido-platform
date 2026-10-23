import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

export interface MemoColumn<Memo> {
  key: string;
  items: Memo[];
}

/** 펼친 화면에서는 목록 pane이 좁아 한 열로 보여준다. */
export function getMemoColumnCount(windowSizeClass: WindowSizeClass): number {
  return windowSizeClass === 'compact' ? 2 : 1;
}

/** 메모를 왼쪽 열부터 번갈아 배치한다. */
export function distributeMemosIntoColumns<Memo>(
  memos: Memo[],
  columnCount: number,
): MemoColumn<Memo>[] {
  return Array.from({ length: columnCount }, (_, columnIndex) => ({
    key: `column-${columnIndex}`,
    items: memos.filter((_, memoIndex) => memoIndex % columnCount === columnIndex),
  }));
}
