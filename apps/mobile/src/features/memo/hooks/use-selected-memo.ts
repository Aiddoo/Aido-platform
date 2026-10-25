import { memoIdParamSchema } from '@aido/api';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { resolveMemoSelection } from '../utils/memo-selection';
import { memoDetailHref } from '../utils/navigation/memo-href';

const selectedMemoParamsSchema = z.object({
  memoId: routeIntegerStringSchema.pipe(memoIdParamSchema.shape.id).optional().catch(undefined),
});

type SelectedMemoId = z.output<typeof selectedMemoParamsSchema>['memoId'];

/** 메모 탭 URL의 `memoId`를 선택된 메모로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useSelectedMemo(): readonly [SelectedMemoId, (memoId: number | undefined) => void] {
  const { memoId: selectedMemoId } = selectedMemoParamsSchema.parse(useLocalSearchParams());
  const windowSizeClass = useWindowSizeClass();

  const setSelectedMemoId = useCallback(
    (memoId: number | undefined) => {
      const navigation = resolveMemoSelection(windowSizeClass, memoId);

      if (navigation.type === 'push') {
        router.push(memoDetailHref(navigation.memoId));
        return;
      }

      if (navigation.type === 'setParams') {
        router.setParams(navigation.params);
      }
    },
    [windowSizeClass],
  );

  return [selectedMemoId, setSelectedMemoId] as const;
}
