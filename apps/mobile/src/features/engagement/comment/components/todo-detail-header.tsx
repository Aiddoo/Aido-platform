import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Box, HStack, QueryErrorBoundary, Text, TextSkeleton } from '@src/shared/ui';
import { formatCompactCount } from '@src/shared/utils/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense, useState } from 'react';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import { useCommentParams } from '../hooks/use-comment-params';
import { useGetTodoCommentThreadsInfiniteQueryOptions } from '../queries/todo-comment.queries';
import { TodoCommentSortBar } from './todo-comment-sort-bar';
import { TodoDetailCard } from './todo-detail-card';

/** 할 일 본문과 댓글 수·정렬. 댓글과 함께 스크롤된다 */
export function TodoDetailHeader() {
  const { todoId } = useTodoScreenParams();
  const [{ sort }, setCommentParams] = useCommentParams();
  const changeSort = useChangeSort();

  return (
    <>
      <QueryErrorBoundary resetKeys={[todoId]}>
        <Suspense
          fallback={
            <Box px={16} py={18}>
              <TodoDetailCard.Loading />
            </Box>
          }
        >
          <Box px={16} py={18}>
            <TodoDetailCard />
          </Box>
        </Suspense>
      </QueryErrorBoundary>

      <Separator />

      <HStack justify="between" align="center" gap={12} px={16} py={4}>
        <CommentCount />
        <TodoCommentSortBar
          value={sort}
          isPending={changeSort.isPending}
          onChange={(next) =>
            changeSort.run(next, () => setCommentParams({ sort: next, comment: undefined }))
          }
        />
      </HStack>
    </>
  );
}

function CommentCount() {
  const { t } = useTranslation('todoComment');
  const { todoId } = useTodoScreenParams();
  const { resolvedLanguage } = useLanguage();
  const { data: detail, isPending } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <HStack gap={4} align="center" className="shrink">
      <Text size="b3" weight="semibold">
        {t('list.heading')}
      </Text>
      {isPending && <TextSkeleton size="b3" className="w-4" />}
      {detail != null && (
        <Text size="b3" weight="semibold" testID="todo-comment-count">
          {formatCompactCount(detail.metrics.commentCount, resolvedLanguage)}
        </Text>
      )}
    </HStack>
  );
}

/** 새 정렬의 첫 페이지를 먼저 받아 두고 바꿔 목록이 skeleton으로 깜박이지 않게 한다 */
function useChangeSort() {
  const { todoId } = useTodoScreenParams();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const [isPending, setIsPending] = useState(false);
  const latestOptions = useGetTodoCommentThreadsInfiniteQueryOptions({
    todoId,
    sort: TODO_COMMENT_SORT.LATEST,
    anchorCommentId: null,
  });
  const popularOptions = useGetTodoCommentThreadsInfiniteQueryOptions({
    todoId,
    sort: TODO_COMMENT_SORT.POPULAR,
    anchorCommentId: null,
  });

  const run = (sort: TodoCommentSort, commit: () => void) => {
    setIsPending(true);
    queryClient
      .prefetchInfiniteQuery(sort === TODO_COMMENT_SORT.POPULAR ? popularOptions : latestOptions)
      .finally(() => {
        setIsPending(false);
        commit();
        trackEvent('todo_comment_sorted', { todo_id: todoId, sort });
      })
      .catch((error) =>
        logger.warn(TODO_COMMENT_LOG_EVENT.SORT_CHANGE_FAILED, { error: getErrorMessage(error) }),
      );
  };

  return { isPending, run };
}
