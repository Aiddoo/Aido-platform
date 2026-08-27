import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '@src/features/todo/presentations/queries/use-todo-page-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ScreenTitleBar } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { KeyboardController } from 'react-native-keyboard-controller';

import { useCommentRouteState } from '../hooks/use-comment-route-state';
import { useIsTodoCommentComposerMutating } from '../hooks/use-is-todo-comment-composer-mutating';
import { useCancelTodoCommentScreenTransition } from '../providers/todo-comment-screen-transition';
import type { CommentRouteMode } from '../utils/comment-route-state';
import { getCommentScreenBackAction } from '../utils/comment-screen-back-action';

type CommentBackCopyKey = 'screen.backToOverview' | 'screen.backToThread' | 'screen.closeComposer';
const SUBTITLE_LAYOUT_PLACEHOLDER = '\u00a0';

function getCommentBackCopyKey(mode: CommentRouteMode): CommentBackCopyKey | undefined {
  if (mode === 'thread') {
    return 'screen.backToOverview';
  }

  if (mode === 'reply' || mode === 'edit') {
    return 'screen.backToThread';
  }

  if (mode === 'create') {
    return 'screen.closeComposer';
  }

  return undefined;
}

export function TodoCommentTitleBar() {
  const { todoId } = useTodoScreenParams();
  const { mode, closeComposer, clearThread } = useCommentRouteState();
  const isSubmitting = useIsTodoCommentComposerMutating();
  const cancelPendingTransition = useCancelTodoCommentScreenTransition();
  const { data: detail } = useQuery(useTodoDetailsQueryOptions(todoId));
  const { t } = useTranslation(['todo', 'todoComment']);
  const hasThreadContext = mode === 'thread' || mode === 'reply' || mode === 'edit';
  const backCopyKey = getCommentBackCopyKey(mode);
  const backAction = getCommentScreenBackAction({ mode, isSubmitting });

  const handleNativeBackPress = useSingleTap(() => {
    cancelPendingTransition();
    router.back();
  });

  const handleBackPress = useSingleTap(() => {
    if (backAction === 'native' || backAction === 'consume') {
      return;
    }

    cancelPendingTransition();
    KeyboardController.dismiss({ animated: false }).catch(() => undefined);

    if (backAction === 'clear-thread') {
      clearThread();
      return;
    }

    closeComposer();
  });

  return (
    <ScreenTitleBar
      title={hasThreadContext ? t('todoComment:screen.replyTitle') : t('todo:detail.pageTitle')}
      subtitle={
        detail
          ? t('todo:detail.views', { count: detail.metrics.viewCount })
          : SUBTITLE_LAYOUT_PLACEHOLDER
      }
      onBackPress={backAction === 'native' ? handleNativeBackPress : handleBackPress}
      isBackDisabled={backAction === 'consume'}
      backAccessibilityLabel={
        backCopyKey === undefined ? undefined : t(`todoComment:${backCopyKey}`)
      }
    />
  );
}
