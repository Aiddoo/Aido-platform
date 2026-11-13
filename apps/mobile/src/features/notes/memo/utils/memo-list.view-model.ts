import type { WindowSizeClass } from '@src/shared/ui';
import { clamp } from 'es-toolkit';
import { match, P } from 'ts-pattern';

/** 펼친 화면에서는 목록 pane이 좁아 한 열이다. 메모가 하나면 옆 칸이 비지 않게 한 열이다 */
export function getMemoColumnCount(paneSizeClass: WindowSizeClass, memoCount: number) {
  const columnCount = match(paneSizeClass)
    .with('compact', () => 2)
    .with(P.union('medium', 'expanded'), () => 1)
    .exhaustive();

  return clamp(memoCount, 1, columnCount);
}

/** 지난 그림 뒤 목록 앞·사이에 새로 생긴 메모만 고른다. 다음 쪽으로 끝에 붙은 메모는 제외하고, 아는 메모가 없으면 모두 고른다 */
export function getEnteringMemoIds(
  knownIds: ReadonlySet<number>,
  memoIds: readonly number[],
): number[] {
  const lastKnownIndex = memoIds.findLastIndex((id) => knownIds.has(id));

  return memoIds.filter(
    (id, index) => !knownIds.has(id) && (lastKnownIndex === -1 || index < lastKnownIndex),
  );
}

export type MemoListChange = 'same' | 'appended' | 'reordered';

/**
 * 목록이 어떻게 바뀌었는지. 순서가 같으면(내용 수정) same, 앞 목록 뒤에 붙기만 했으면(다음 쪽) appended,
 * 그 밖(만들기·고정·삭제·다른 기기 변경)은 reordered다. 카드가 새 자리로 움직이는 것은 reordered뿐이다
 */
export function getMemoListChange(
  previousIds: readonly number[],
  nextIds: readonly number[],
): MemoListChange {
  const isPrefixKept = previousIds.every((id, index) => nextIds[index] === id);
  if (!isPrefixKept) {
    return 'reordered';
  }
  return nextIds.length === previousIds.length ? 'same' : 'appended';
}
