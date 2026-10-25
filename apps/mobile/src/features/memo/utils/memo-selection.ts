import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

export type MemoSelectionNavigation =
  | { type: 'none' }
  | { type: 'push'; memoId: number }
  | { type: 'setParams'; params: { memoId: string | undefined } };

/** 접힌 화면은 상세 라우트로 push하고, 펼친 화면은 메모 탭 URL param으로 pane을 바꾼다. */
export function resolveMemoSelection(
  windowSizeClass: WindowSizeClass,
  memoId: number | undefined,
): MemoSelectionNavigation {
  if (windowSizeClass === 'compact') {
    return memoId == null ? { type: 'none' } : { type: 'push', memoId };
  }

  return {
    type: 'setParams',
    params: { memoId: memoId == null ? undefined : String(memoId) },
  };
}
