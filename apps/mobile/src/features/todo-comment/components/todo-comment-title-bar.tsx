import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ScreenTitleBar, STACK_BACK_ICON, useStackScreenOptions } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';

const SUBTITLE_LAYOUT_PLACEHOLDER = ' ';

interface TodoCommentTitleBarProps {
  /** 라우트를 pop하지 않는 pane에서 댓글 개요의 뒤로가기가 상세를 닫을 때 쓴다. */
  onBackPress: () => void;
}

/** 펼친 피드의 상세 pane 제목 바. pane은 Stack 화면이 아니라 네이티브 헤더가 없다. */
export function TodoCommentTitleBar({ onBackPress }: TodoCommentTitleBarProps) {
  const { title, subtitle, isBackDisabled, backAccessibilityLabel, handleBackPress } =
    useTodoCommentTitle(onBackPress);

  return (
    <ScreenTitleBar
      title={title}
      subtitle={subtitle}
      onBackPress={handleBackPress}
      isBackDisabled={isBackDisabled}
      backAccessibilityLabel={backAccessibilityLabel}
    />
  );
}

/** `/todo/[todoId]` 전체 화면의 네이티브 헤더. 조회수를 함께 보이려고 제목만 커스텀 뷰로 둔다. */
TodoCommentTitleBar.StackHeader = function StackHeader() {
  const screenOptions = useStackScreenOptions({ background: 'bg-background' });
  const { t } = useTranslation('common');
  const { title, subtitle, isBackDisabled, backAccessibilityLabel, handleBackPress } =
    useTodoCommentTitle(router.back);

  return (
    <>
      <Stack.Screen
        options={{
          ...screenOptions,
          headerTitle: () => <ScreenTitleBar.Title title={title} subtitle={subtitle} />,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_BACK_ICON}
          accessibilityLabel={backAccessibilityLabel ?? t('actions.goBack')}
          disabled={isBackDisabled}
          onPress={handleBackPress}
        />
      </Stack.Toolbar>
    </>
  );
};

/** 댓글 경로에 따라 제목·조회수와 뒤로가기(대화 → 개요 → 화면 나가기)를 정한다. */
function useTodoCommentTitle(onExit: () => void) {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const { result: backResult, handleBack } = useTodoCommentBack();
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { t } = useTranslation(['todo', 'todoComment']);

  const handleBackPress = useSingleTap(() => {
    if (handleBack()) {
      return;
    }
    onExit();
  });

  return {
    title:
      commentRoute.view === 'conversation'
        ? t('todoComment:screen.replyTitle')
        : t('todo:detail.pageTitle'),
    subtitle:
      detail != null
        ? t('todo:detail.views', { count: detail.metrics.viewCount })
        : SUBTITLE_LAYOUT_PLACEHOLDER,
    isBackDisabled: backResult.status === 'blocked',
    backAccessibilityLabel:
      backResult.status === 'navigate' ? t(`todoComment:${backResult.labelKey}`) : undefined,
    handleBackPress,
  };
}
