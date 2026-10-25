import {
  createTodoCommentScreenHrefs,
  parseTodoCommentRoute,
} from '@src/features/todo-comment/utils/navigation/todo-comment-route';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { Box, QueryErrorBoundary } from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Suspense, type PropsWithChildren } from 'react';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';
import { FeedAvatarList } from './feed-avatar-list';

/** 피드 목록 pane. 접힌 화면으로 바뀌면 선택된 할 일과 댓글 단계를 상세 화면으로 넘긴다. */
export function FeedListPane({ children }: PropsWithChildren) {
  const [selectedTodoId] = useFeedSelectedTodo();
  const commentRoute = parseTodoCommentRoute(useLocalSearchParams());

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    router.setParams({
      todoId: undefined,
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
    });
    // pane에서 보던 댓글 단계를 그대로 Stack에 쌓아 접힌 화면에서도 뒤로가기가 한 단계씩 올라간다.
    const { overviewHref, threadHref } = createTodoCommentScreenHrefs({
      todoId,
      route: commentRoute,
    });
    router.push(overviewHref);
    if (threadHref != null) {
      router.push(threadHref);
    }
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
