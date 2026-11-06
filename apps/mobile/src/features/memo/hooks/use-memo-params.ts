import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { routeIdSchema } from '@src/shared/utils/route-params';
import { noop } from 'es-toolkit';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { memoDetailHref } from '../utils/memo-href';

export const memoScreenParamsSchema = z.object({ memoId: routeIdSchema });

const selectedMemoParamsSchema = z.object({
  memoId: routeIdSchema.optional().catch(undefined),
});

export function useMemoScreenParams() {
  return memoScreenParamsSchema.parse(useLocalSearchParams());
}

/** 메모 탭 URL의 `memoId`를 선택된 메모로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useSelectedMemo() {
  const { memoId: selectedMemoId } = selectedMemoParamsSchema.parse(useLocalSearchParams());
  const windowSizeClass = useWindowSizeClass();

  const setSelectedMemoId = useCallback(
    (memoId: number | undefined) => {
      match({ windowSizeClass, memoId })
        .with({ windowSizeClass: 'compact', memoId: P.nullish }, noop)
        .with({ windowSizeClass: 'compact', memoId: P.number }, ({ memoId: selected }) =>
          router.push(memoDetailHref(selected)),
        )
        .with({ windowSizeClass: P.union('medium', 'expanded') }, () =>
          router.setParams({ memoId: memoId == null ? undefined : String(memoId) }),
        )
        .exhaustive();
    },
    [windowSizeClass],
  );

  return [selectedMemoId, setSelectedMemoId] as const;
}
