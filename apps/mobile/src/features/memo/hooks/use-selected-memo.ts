import { memoIdParamSchema } from '@aido/api';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { resolveMemoSelection } from '../utils/memo-selection';

const selectedMemoParamsSchema = z.object({
  id: routeIntegerStringSchema.pipe(memoIdParamSchema.shape.id).optional().catch(undefined),
});

type SelectedMemoId = z.output<typeof selectedMemoParamsSchema>['id'];

/** 메모 탭 URL의 `id`를 선택된 메모로 읽고, 화면 크기에 맞는 방식으로 선택을 바꾼다. */
export function useSelectedMemo(): readonly [SelectedMemoId, (memoId: number | undefined) => void] {
  const { id: selectedMemoId } = selectedMemoParamsSchema.parse(useLocalSearchParams());
  const windowSizeClass = useWindowSizeClass();

  const setSelectedMemoId = useCallback(
    (memoId: number | undefined) => {
      const navigation = resolveMemoSelection(windowSizeClass, memoId);

      if (navigation.type === 'push') {
        router.push({ pathname: '/memo/[id]', params: { id: navigation.memoId } });
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
