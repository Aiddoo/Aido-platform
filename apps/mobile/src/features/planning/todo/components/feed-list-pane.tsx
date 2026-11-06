import {
  parseTodoCommentRoute,
  serializeTodoCommentRoute,
} from '@src/features/engagement/comment/utils/navigation/todo-comment-route';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { Box } from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';

/** 피드 목록 pane. 접힌 화면으로 바뀌면 선택된 할 일과 댓글 위치를 상세 화면으로 넘긴다. */
export function FeedListPane({ children }: PropsWithChildren) {
  const [selectedTodoId] = useFeedSelectedTodo();
  const commentRoute = parseTodoCommentRoute(useLocalSearchParams());

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    router.setParams({ todoId: undefined, comment: undefined, sort: undefined });
    router.push({
      pathname: '/todo/[todoId]',
      params: { todoId, ...serializeTodoCommentRoute(commentRoute) },
    });
  });

  return (
    <Box flex={1} className="bg-white">
      {children}
    </Box>
  );
}
