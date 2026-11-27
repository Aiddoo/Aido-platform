import { usePaneSizeClass } from '@src/shared/ui';
import { useRouter } from 'expo-router';
import { match, P } from 'ts-pattern';

import { useFeedSelectedTodoId } from './use-feed-params';

/** 피드에서 할 일의 상세를 연다. 접힌 화면은 상세 화면으로 가고, 펼친 화면은 옆 칸에 고른다 */
export function useOpenFeedTodoDetail() {
  const [, setSelectedTodoId] = useFeedSelectedTodoId();
  const paneSizeClass = usePaneSizeClass();
  const router = useRouter();

  return (todoId: number) => {
    match(paneSizeClass)
      // 상세 행의 Link가 navigate로 열어 같은 상세가 겹쳐 쌓이지 않게 같은 동사를 쓴다
      .with('compact', () => router.navigate({ pathname: '/todo/[todoId]', params: { todoId } }))
      .with(P.union('medium', 'expanded'), () => setSelectedTodoId(todoId))
      .exhaustive();
  };
}
