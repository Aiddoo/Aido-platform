import { CommentComposerTrigger } from '@src/features/todo-comment/presentations/components/CommentComposerTrigger';
import { CommentSortBar } from '@src/features/todo-comment/presentations/components/CommentSortBar';
import { CommentThreadList } from '@src/features/todo-comment/presentations/components/CommentThreadList';
import { useCommentComposer } from '@src/features/todo-comment/presentations/hooks/use-comment-composer';
import { useCommentSort } from '@src/features/todo-comment/presentations/hooks/use-comment-sort';
import { TodoDetailCard } from '@src/features/todo/presentations/components/TodoDetailCard';
import { TodoDetailTitleBar } from '@src/features/todo/presentations/components/TodoDetailTitleBar';
import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '@src/features/todo/presentations/queries/use-todo-page-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, StyledSafeAreaView, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';

export default function TodoDetailScreen() {
  const { todoId } = useTodoScreenParams();
  const [sort] = useCommentSort();

  return (
    <StyledSafeAreaView className="flex-1 bg-background" edges={['top']}>
      <QueryErrorBoundary resetKeys={[todoId]}>
        <Suspense fallback={<TodoDetailTitleBar.Loading />}>
          <TodoDetailTitleBar />
        </Suspense>
      </QueryErrorBoundary>

      <Separator />

      {/* CommentThreadList가 화면의 스크롤 컨테이너다 (RN 가상화의 구조적 요구).
          children은 댓글과 함께 스크롤되는 상단 영역이고, 배치는 여기서 정한다. */}
      <QueryErrorBoundary fallback={CommentThreadList.Error} resetKeys={[todoId, sort]}>
        <Suspense fallback={<CommentThreadList.Loading />}>
          <CommentThreadList>
            <QueryErrorBoundary resetKeys={[todoId]}>
              <Suspense fallback={<TodoDetailCard.Loading />}>
                <Box px={16} py={18}>
                  <TodoDetailCard />
                </Box>
              </Suspense>
            </QueryErrorBoundary>
            <Separator />
            <Box px={16} py={10}>
              <CommentSortBar />
            </Box>
          </CommentThreadList>
        </Suspense>
      </QueryErrorBoundary>

      <NewCommentTrigger />
    </StyledSafeAreaView>
  );
}

/** 이 화면의 댓글은 할 일에 바로 달린다. 작성 가능 여부는 서버가 판단한다. */
function NewCommentTrigger() {
  const { todoId } = useTodoScreenParams();
  const composer = useCommentComposer();
  const { data: canComment } = useQuery({
    ...useTodoDetailsQueryOptions(todoId),
    select: (detail) => detail.permissions.canComment,
  });

  if (canComment === false) {
    return <CommentingDisabledNotice />;
  }

  return <CommentComposerTrigger replyingTo={null} onPress={composer.writeComment} />;
}

function CommentingDisabledNotice() {
  const { t } = useTranslation('todoComment');

  return (
    <Box px={16} py={16} className="items-center border-t border-gray-2 bg-background">
      <Text size="b4" shade={6}>
        {t('input.commentingDisabled')}
      </Text>
    </Box>
  );
}
