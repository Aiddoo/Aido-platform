import { useOpenDetailWhenCompact } from '@src/shared/hooks/use-open-detail-when-compact';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { usePaneSizeClass } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';

import { memoParamsSchema, selectedMemoParamsSchema } from '../schemas/memo-params.schema';

/** `/memo/[memoId]` 경로의 메모. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useMemoId() {
  const [{ memoId }] = useRouteParams(memoParamsSchema);

  return [memoId] as const;
}

/** 메모 탭 URL의 `memoId`를 선택된 메모로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useSelectedMemoId() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);
  const paneSizeClass = usePaneSizeClass();

  const setSelectedMemoId = useCallback(
    (memoId: number | undefined) => {
      match({ paneSizeClass, memoId })
        .with({ paneSizeClass: 'compact', memoId: P.nullish }, noop)
        .with({ paneSizeClass: 'compact', memoId: P.number }, ({ memoId: selected }) =>
          router.push({ pathname: '/memo/[memoId]', params: { memoId: selected } }),
        )
        .with({ paneSizeClass: P.union('medium', 'expanded') }, () => setParams({ memoId }))
        .exhaustive();
    },
    [paneSizeClass, setParams],
  );

  return [selectedMemoId, setSelectedMemoId] as const;
}

/** 펼친 화면에서 고른 메모가 있는 채로 접히면 그 메모를 상세 화면으로 넘긴다 */
export function useMemoDetailHandoff() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);

  useOpenDetailWhenCompact(selectedMemoId, (memoId) => {
    setParams({ memoId: undefined });
    router.push({ pathname: '/memo/[memoId]', params: { memoId } });
  });
}
