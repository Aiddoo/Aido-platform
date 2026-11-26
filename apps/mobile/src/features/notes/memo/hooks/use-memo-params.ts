import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { usePaneSizeClass } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { useRouter } from 'expo-router';
import { match, P } from 'ts-pattern';

import { memoParamsSchema, selectedMemoParamsSchema } from '../schemas/memo-params.schema';

/** `/memo/[memoId]` 경로의 메모. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useMemoId() {
  const [{ memoId }] = useRouteParams(memoParamsSchema);

  return [memoId] as const;
}

export function useSelectedMemoId() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);
  const paneSizeClass = usePaneSizeClass();

  const router = useRouter();
  const setSelectedMemoId = (memoId: number | undefined) => {
    match({ paneSizeClass, memoId })
      .with({ paneSizeClass: 'compact', memoId: P.nullish }, noop)
      // 카드의 Link가 navigate로 열어 같은 상세가 겹쳐 쌓이지 않게 같은 동사를 쓴다
      .with({ paneSizeClass: 'compact', memoId: P.number }, ({ memoId: selected }) =>
        router.navigate({ pathname: '/memo/[memoId]', params: { memoId: selected } }),
      )
      .with({ paneSizeClass: P.union('medium', 'expanded') }, () => setParams({ memoId }))
      .exhaustive();
  };

  return [selectedMemoId, setSelectedMemoId] as const;
}

/** 메모 탭 URL의 `memoId` 값만 읽고 쓴다. 칸 크기에 따른 이동은 부르는 훅이 고른다 */
export function useSelectedMemoIdParam() {
  const [{ memoId: selectedMemoId }, setParams] = useRouteParams(selectedMemoParamsSchema);
  const setSelectedMemoIdParam = (memoId: number | undefined) => {
    setParams({ memoId });
  };

  return [selectedMemoId, setSelectedMemoIdParam] as const;
}
