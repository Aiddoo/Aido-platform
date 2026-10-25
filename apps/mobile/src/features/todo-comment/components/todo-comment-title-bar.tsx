import MoreHoriz from '@expo/material-symbols/more_horiz.xml';
import { useTodoModerationActions } from '@src/features/moderation/hooks/use-todo-moderation-actions';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { MoreIcon, ScreenTitleBar, STACK_BACK_ICON, useStackScreenOptions } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Menu, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';

const SUBTITLE_LAYOUT_PLACEHOLDER = ' ';

/** 헤더 ⋯ 아이콘. iOS는 SF Symbol, Android는 Material Symbol을 쓴다. */
const MORE_ICON = process.env.EXPO_OS === 'ios' ? 'ellipsis' : MoreHoriz;

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
      right={<TodoModerationMenu />}
    />
  );
}

/** `/todo/[todoId]` 전체 화면의 네이티브 헤더. 조회수를 함께 보이려고 제목만 커스텀 뷰로 둔다. */
TodoCommentTitleBar.StackHeader = function StackHeader() {
  const screenOptions = useStackScreenOptions({ background: 'bg-background' });
  const { t } = useTranslation(['common', 'moderation']);
  const { todoId } = useTodoScreenParams();
  const moderation = useTodoModerationActions({ todoId });
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          hidden={!moderation.isAvailable}
          icon={MORE_ICON}
          accessibilityLabel={t('moderation:menu.more')}
        >
          <Stack.Toolbar.MenuAction onPress={moderation.report}>
            {t('moderation:menu.report')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive onPress={moderation.block}>
            {t('moderation:block.action')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
};

/** 펼친 피드 pane의 ⋯. 친구 할 일에서만 신고·차단을 보인다 */
function TodoModerationMenu() {
  const { t } = useTranslation('moderation');
  const { todoId } = useTodoScreenParams();
  const moderation = useTodoModerationActions({ todoId });
  const [isOpen, setIsOpen] = useState(false);

  if (!moderation.isAvailable) {
    return null;
  }

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('menu.more')}
          accessibilityState={{ expanded: isOpen }}
        >
          <MoreIcon width={20} height={20} colorClassName="text-gray-9" />
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={180}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <Menu.Item onPress={moderation.report}>
            <Menu.ItemTitle>{t('menu.report')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item variant="danger" onPress={moderation.block}>
            <Menu.ItemTitle>{t('block.action')}</Menu.ItemTitle>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

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
