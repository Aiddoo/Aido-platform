import { useOpenDetailWhenCompact } from '@src/shared/hooks/use-open-detail-when-compact';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useRouter } from 'expo-router';

import { feedParamsSchema } from '../schemas/feed-params.schema';
import { useFeedSelectedTodoId } from './use-feed-params';

/** 펼친 화면에서 고른 할 일이 있는 채로 접히면 그 할 일과 댓글 위치를 상세 화면으로 넘긴다 */
export function useFeedTodoDetailHandoff() {
  const [{ sort, comment }] = useRouteParams(feedParamsSchema);
  const [selectedTodoId, setSelectedTodoId] = useFeedSelectedTodoId();

  const router = useRouter();
  useOpenDetailWhenCompact(selectedTodoId, (todoId) => {
    setSelectedTodoId(undefined);
    router.push({ pathname: '/todo/[todoId]', params: { todoId, sort, comment } });
  });
}
