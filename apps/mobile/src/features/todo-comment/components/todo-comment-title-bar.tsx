import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ScreenTitleBar } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';

const SUBTITLE_LAYOUT_PLACEHOLDER = '\u00a0';

interface TodoCommentTitleBarProps {
  /** 라우트를 pop하지 않는 pane에서 댓글 개요의 뒤로가기가 상세를 닫을 때 쓴다. */
  onBackPress?: () => void;
}

export function TodoCommentTitleBar({ onBackPress }: TodoCommentTitleBarProps) {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const { result: backResult, handleBack } = useTodoCommentBack();
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { t } = useTranslation(['todo', 'todoComment']);

  const handleBackPress = useSingleTap(() => {
    if (handleBack()) {
      return;
    }
    if (onBackPress) {
      onBackPress();
      return;
    }
    router.back();
  });

  return (
    <ScreenTitleBar
      title={
        commentRoute.view === 'conversation'
          ? t('todoComment:screen.replyTitle')
          : t('todo:detail.pageTitle')
      }
      subtitle={
        detail
          ? t('todo:detail.views', { count: detail.metrics.viewCount })
          : SUBTITLE_LAYOUT_PLACEHOLDER
      }
      onBackPress={handleBackPress}
      isBackDisabled={backResult.status === 'blocked'}
      backAccessibilityLabel={
        backResult.status === 'navigate' ? t(`todoComment:${backResult.labelKey}`) : undefined
      }
    />
  );
}
