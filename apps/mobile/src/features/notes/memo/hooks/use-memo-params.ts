import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { noop } from 'es-toolkit';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';

import { memoScreenParamsSchema, selectedMemoParamsSchema } from '../schemas/memo-params.schema';

export function useMemoScreenParams() {
  return memoScreenParamsSchema.parse(useLocalSearchParams());
}

/** 메모 탭 URL의 `memoId`를 선택된 메모로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useSelectedMemo() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);
  const windowSizeClass = useWindowSizeClass();

  const setSelectedMemoId = useCallback(
    (memoId: number | undefined) => {
      match({ windowSizeClass, memoId })
        .with({ windowSizeClass: 'compact', memoId: P.nullish }, noop)
        .with({ windowSizeClass: 'compact', memoId: P.number }, ({ memoId: selected }) =>
          router.push({ pathname: '/memo/[memoId]', params: { memoId: selected } }),
        )
        .with({ windowSizeClass: P.union('medium', 'expanded') }, () => setParams({ memoId }))
        .exhaustive();
    },
    [windowSizeClass, setParams],
  );

  return [selectedMemoId, setSelectedMemoId] as const;
}

/** 펼친 화면에서 고른 메모가 있는 채로 접히면 그 메모를 상세 화면으로 넘긴다 */
export function useMemoDetailHandoff() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);

  useCompactDetailHandoff(selectedMemoId, (memoId) => {
    setParams({ memoId: undefined });
    router.push({ pathname: '/memo/[memoId]', params: { memoId } });
  });
}
