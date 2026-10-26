import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';
import {
  createTodoCommentThreadHref,
  parseTodoCommentRoute,
} from '@src/features/todo-comment/utils/navigation/todo-comment-route';
import { todoScreenParamsSchema } from '@src/features/todo/hooks/use-todo-screen-params';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** 할 일 상세와 댓글 개요. 댓글 대화는 `comments/[commentId]` 화면으로 한 단계 push한다. */
export default function TodoDetailRoute() {
  const searchParams = useLocalSearchParams();
  const params = todoScreenParamsSchema.safeParse(searchParams);

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  // 이전 앱·외부 링크의 `?comment=` 대화 URL은 대화 화면으로 옮긴다.
  const commentRoute = parseTodoCommentRoute(searchParams);
  if (commentRoute.view === 'conversation') {
    return (
      <Redirect
        href={createTodoCommentThreadHref({ todoId: params.data.todoId, route: commentRoute })}
      />
    );
  }

  return <TodoDetailPane presentation="screen" />;
}
