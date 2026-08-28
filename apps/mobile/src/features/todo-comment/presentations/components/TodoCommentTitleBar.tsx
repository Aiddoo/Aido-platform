import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '@src/features/todo/presentations/queries/use-todo-page-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ScreenTitleBar } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';

const SUBTITLE_LAYOUT_PLACEHOLDER = '\u00a0';

export function TodoCommentTitleBar() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const { result: backResult, handleBack } = useTodoCommentBack();
  const { data: detail } = useQuery(useTodoDetailsQueryOptions(todoId));
  const { t } = useTranslation(['todo', 'todoComment']);

  const handleBackPress = useSingleTap(() => {
    if (!handleBack()) {
      router.back();
    }
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
