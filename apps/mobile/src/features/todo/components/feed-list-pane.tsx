import { useTodoCommentRoute } from '@src/features/todo-comment/hooks/use-todo-comment-route';
import { serializeTodoCommentRoute } from '@src/features/todo-comment/utils/navigation/todo-comment-route';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { Box, QueryErrorBoundary } from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense, type PropsWithChildren } from 'react';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';
import { FeedAvatarList } from './feed-avatar-list';

/** 피드 목록 pane. 접힌 화면으로 바뀌면 선택된 할 일을 상세 화면으로 넘긴다. */
export function FeedListPane({ children }: PropsWithChildren) {
  const [selectedTodoId] = useFeedSelectedTodo();
  const [commentRoute] = useTodoCommentRoute();

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    router.setParams({
      todoId: undefined,
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
    });
    router.push({
      pathname: '/todo/[todoId]',
      params: { todoId, ...serializeTodoCommentRoute(commentRoute) },
    });
  });

  return (
    <Box flex={1} className="bg-white">
      <QueryErrorBoundary fallback={FeedAvatarList.Error}>
        <Suspense fallback={<FeedAvatarList.Loading />}>
          <FeedAvatarList />
        </Suspense>
      </QueryErrorBoundary>
      {children}
    </Box>
  );
}
