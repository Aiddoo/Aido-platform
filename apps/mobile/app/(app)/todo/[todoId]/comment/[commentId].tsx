import { TodoCommentPolicy } from '@src/features/todo-comment/models/todo-comment.model';
import { CommentComposerTrigger } from '@src/features/todo-comment/presentations/components/CommentComposerTrigger';
import { CommentSortBar } from '@src/features/todo-comment/presentations/components/CommentSortBar';
import { CommentThreadList } from '@src/features/todo-comment/presentations/components/CommentThreadList';
import { ThreadAncestors } from '@src/features/todo-comment/presentations/components/ThreadAncestors';
import { ThreadFocusedComment } from '@src/features/todo-comment/presentations/components/ThreadFocusedComment';
import { ThreadTodoCard } from '@src/features/todo-comment/presentations/components/ThreadTodoCard';
import { useCommentComposer } from '@src/features/todo-comment/presentations/hooks/use-comment-composer';
import { useCommentSort } from '@src/features/todo-comment/presentations/hooks/use-comment-sort';
import { useCommentThreadParams } from '@src/features/todo-comment/presentations/hooks/use-comment-thread-params';
import { useTodoCommentThreadQueryOptions } from '@src/features/todo-comment/presentations/queries/use-todo-comment-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, QueryErrorBoundary, ScreenTitleBar, StyledSafeAreaView, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';

/**
 * 한 댓글의 스레드. 위에서 아래로 원본 할 일 → 여기까지 내려온 조상 → 지금 보는 댓글 →
 * 그 댓글의 직계 답글 순으로 읽힌다.
 */
export default function CommentThreadScreen() {
  const { t } = useTranslation('todoComment');
  const { todoId, commentId } = useCommentThreadParams();
  const [sort] = useCommentSort();

  return (
    <StyledSafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenTitleBar title={t('thread.title')} />

      <Separator />

      <QueryErrorBoundary fallback={CommentThreadList.Error} resetKeys={[todoId, commentId, sort]}>
        <Suspense fallback={<CommentThreadList.Loading />}>
          {/* CommentThreadList가 화면의 스크롤 컨테이너다. children은 답글과 함께 스크롤되는 상단 영역. */}
          <CommentThreadList>
            <ThreadTodoCard />
            <ThreadAncestors />
            <ThreadFocusedComment />
            <Separator />
            <Box px={16} py={10}>
              <CommentSortBar />
            </Box>
          </CommentThreadList>

          <NewReplyTrigger />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

/** 이 화면의 답글은 지금 펼쳐 보는 댓글에 달린다. 묘비가 된 댓글에는 열지 않는다. */
function NewReplyTrigger() {
  const { t } = useTranslation('todoComment');
  const { todoId, commentId } = useCommentThreadParams();
  const composer = useCommentComposer();
  const { data: thread } = useSuspenseQuery(useTodoCommentThreadQueryOptions(todoId, commentId));

  if (!TodoCommentPolicy.canReply(thread.comment)) {
    return (
      <Box px={16} py={16} className="items-center border-t border-gray-2 bg-background">
        <Text size="b4" shade={6}>
          {t('input.replyingDisabled')}
        </Text>
      </Box>
    );
  }

  return (
    <CommentComposerTrigger
      replyingTo={thread.comment.author}
      onPress={() => composer.replyTo(thread.comment)}
    />
  );
}
