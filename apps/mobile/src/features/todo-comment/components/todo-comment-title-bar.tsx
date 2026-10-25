import { useTodoModerationActions } from '@src/features/moderation/hooks/use-todo-moderation-actions';
import { useFeedDateKey } from '@src/features/todo/hooks/use-feed-date';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { todoActionsSheetHref } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  HStack,
  MoreIcon,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  Text,
  useStackScreenOptions,
  VStack,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Menu, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';

const SUBTITLE_LAYOUT_PLACEHOLDER = ' ';

/**
 * 펼친 피드의 상세 pane 제목 바. pane은 Stack 화면이 아니라 네이티브 헤더가 없다.
 * 선택과 해제는 목록 pane이 맡으므로 댓글 개요에는 뒤로가기가 없고, 대화에서만 개요로 돌아간다.
 */
export function TodoCommentTitleBar() {
  const { t } = useTranslation('common');
  const [commentRoute] = useTodoCommentRoute();
  const { title, subtitle, isBackDisabled, backAccessibilityLabel, handleBack } =
    useTodoCommentTitle();
  const handleBackPress = useSingleTap(handleBack);
  const isConversation = commentRoute.view === 'conversation';

  return (
    <HStack align="center" gap={4} pl={isConversation ? 4 : 20} pr={4} className="min-h-16">
      {isConversation && (
        <PressableFeedback
          onPress={handleBackPress}
          isDisabled={isBackDisabled}
          className="size-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel ?? t('actions.goBack')}
          accessibilityState={{ disabled: isBackDisabled }}
        >
          <ArrowLeftIcon width={22} height={22} colorClassName="text-gray-9" />
        </PressableFeedback>
      )}

      <VStack flex={1} gap={1} className="min-w-0">
        <Text size="b2" weight="bold" numberOfLines={1}>
          {title}
        </Text>
        <Text size="e1" shade={7} numberOfLines={1}>
          {subtitle}
        </Text>
      </VStack>

      {!isConversation && <TodoActionsButton />}
      <TodoModerationMenu />
    </HStack>
  );
}

/** `/todo/[todoId]` 전체 화면의 네이티브 헤더. 조회수를 함께 보이려고 제목만 커스텀 뷰로 둔다. */
TodoCommentTitleBar.StackHeader = function StackHeader() {
  const screenOptions = useStackScreenOptions({ background: 'bg-background' });
  const { t } = useTranslation(['common', 'moderation']);
  const { todoId } = useTodoScreenParams();
  const moderation = useTodoModerationActions({ todoId });
  const { title, subtitle, isBackDisabled, backAccessibilityLabel, handleBack } =
    useTodoCommentTitle();

  const handleBackPress = useSingleTap(() => {
    if (handleBack()) {
      return;
    }
    router.back();
  });

  return (
    <>
      <Stack.Screen
        options={{
          ...screenOptions,
          headerTitle: () => <StackHeaderTitle title={title} subtitle={subtitle} />,
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
          icon={STACK_MORE_ICON}
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

interface StackHeaderTitleProps {
  title: string;
  subtitle: string;
}

function StackHeaderTitle({ title, subtitle }: StackHeaderTitleProps) {
  return (
    <VStack align="center" gap={1}>
      <Text size="b2" weight="bold">
        {title}
      </Text>
      <Text size="e1" shade={5}>
        {subtitle}
      </Text>
    </VStack>
  );
}

/** 내 할 일이면 기존 할 일 옵션 시트를 연다. 친구 할 일의 신고·차단은 TodoModerationMenu가 맡는다. */
function TodoActionsButton() {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoScreenParams();
  const date = useFeedDateKey();
  const push = useSingleTap(router.push);
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { data: me } = useQuery(useGetMeQueryOptions());

  if (detail == null || me == null || me.id !== detail.owner.id) {
    return null;
  }

  return (
    <PressableFeedback
      onPress={() => push(todoActionsSheetHref({ todoId, date }))}
      className="size-11 items-center justify-center rounded-full"
      accessibilityRole="button"
      accessibilityLabel={t('actions.more')}
    >
      <MoreIcon width={22} height={22} colorClassName="text-gray-9" />
    </PressableFeedback>
  );
}

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

/** 댓글 경로에 따라 제목·조회수와 댓글 안 뒤로가기(작성기 → 대화 → 개요)를 정한다. */
function useTodoCommentTitle() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const { result: backResult, handleBack } = useTodoCommentBack();
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const { t } = useTranslation(['todo', 'todoComment']);

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
    handleBack,
  };
}
