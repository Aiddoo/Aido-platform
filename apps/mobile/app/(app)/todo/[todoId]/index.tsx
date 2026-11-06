import { TodoDetailPane } from '@src/features/engagement/comment/components/todo-detail-pane/todo-detail-pane';
import { todoScreenParamsSchema } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** 할 일 상세와 댓글·답글 한 화면. 알림·링크는 `?comment=`로 그 댓글 위치를 연다 */
export default function TodoDetailRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return <TodoDetailPane presentation="screen" />;
}
