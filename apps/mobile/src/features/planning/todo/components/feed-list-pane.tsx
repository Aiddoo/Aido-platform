import { useCommentParams } from '@src/features/engagement/comment/hooks/use-comment-params';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { Box } from '@src/shared/ui';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';

/** 피드 목록 pane. 접힌 화면으로 바뀌면 선택된 할 일과 댓글 위치를 상세 화면으로 넘긴다. */
export function FeedListPane({ children }: PropsWithChildren) {
  const [selectedTodoId] = useFeedSelectedTodo();
  const { sort, comment } = useCommentParams();

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    router.setParams({ todoId: undefined, comment: undefined, sort: undefined });
    router.push({
      pathname: '/todo/[todoId]',
      params: { todoId, sort, comment: comment ?? undefined },
    });
  });

  return (
    <Box flex={1} className="bg-white">
      {children}
    </Box>
  );
}
