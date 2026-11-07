import { TodoCommentPane } from '@src/features/engagement/comment/components/todo-comment-pane';
import { TodoCommentSession } from '@src/features/engagement/comment/components/todo-comment-session';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

/** 할 일 상세와 댓글·답글 한 화면. 알림·링크는 `?comment=`로 그 댓글 위치를 연다 */
export default function TodoDetailRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return <TodoDetailScreen />;
}

function TodoDetailScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
      <TodoCommentSession>
        <TodoCommentTitleBar.StackHeader />
        <TodoCommentPane onClose={router.back} />
      </TodoCommentSession>
    </StyledSafeAreaView>
  );
}
