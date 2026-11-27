import { useOpenDetailWhenCompact } from '@src/shared/hooks/use-open-detail-when-compact';
import { useRouter } from 'expo-router';

import { useSelectedMemoIdParam } from './use-memo-params';

/** 펼친 화면에서 고른 메모가 있는 채로 접히면 그 메모를 상세 화면으로 넘긴다 */
export function useMemoDetailHandoff() {
  const [selectedMemoId, setSelectedMemoIdParam] = useSelectedMemoIdParam();

  const router = useRouter();
  useOpenDetailWhenCompact(selectedMemoId, (memoId) => {
    setSelectedMemoIdParam(undefined);
    router.push({ pathname: '/memo/[memoId]', params: { memoId } });
  });
}
