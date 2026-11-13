import { useFeedDateKey } from '@src/features/planning/todo/hooks/use-feed-params';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTodoModerationActions } from '@src/features/social/moderation/hooks/use-todo-moderation-actions';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BlockIcon,
  FlagIcon,
  MenuActionItem,
  STACK_MENU_ICON,
  HStack,
  IconButton,
  MoreIcon,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  Text,
  useStackScreenOptions,
  MenuContent,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Menu } from 'heroui-native';
import { useState } from 'react';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';

const ACTION_MENU_WIDTH = 180;

/** 펼친 피드의 상세 pane 제목 바. pane은 Stack 화면이 아니라 네이티브 헤더가 없고, 선택 해제는 목록 pane이 맡는다 */
export function TodoCommentTitleBar() {
  const { t } = useTranslation('todo');

  return (
    <HStack align="center" gap={4} className="min-h-14 pr-1 pl-5">
      <Text size="b2" weight="bold" numberOfLines={1} className="min-w-0 flex-1">
        {t('detail.pageTitle')}
      </Text>

      <TodoActionsButton />
      <TodoModerationMenu />
    </HStack>
  );
}

/** `/todo/[todoId]` 전체 화면의 네이티브 헤더 */
TodoCommentTitleBar.StackHeader = function StackHeader() {
  const screenOptions = useStackScreenOptions();
  const { t } = useTranslation(['common', 'moderation', 'todo', 'todoComment']);
  const [todoId] = useTodoId();
  const moderation = useTodoModerationActions({ todoId });
  const { backAction, interceptBack } = useTodoCommentBack();

  const handleBackPress = useSingleTap(() => {
    if (interceptBack()) {
      return;
    }
    router.back();
  });

  return (
    <>
      <Stack.Screen
        options={{
          ...screenOptions,
          // 작성기가 열려 있으면 swipe가 화면을 닫지 않고 뒤로가기가 작성기부터 닫는다
          gestureEnabled: backAction === 'native',
          title: t('todo:detail.pageTitle'),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_BACK_ICON}
          accessibilityLabel={
            backAction === 'closeComposer'
              ? t('todoComment:actions.closeComposer')
              : t('actions.goBack')
          }
          disabled={backAction === 'blocked'}
          onPress={handleBackPress}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          hidden={!moderation.isAvailable}
          icon={STACK_MORE_ICON}
          accessibilityLabel={t('moderation:menu.more')}
        >
          <Stack.Toolbar.MenuAction icon={STACK_MENU_ICON.report} onPress={moderation.report}>
            {t('moderation:menu.report')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={STACK_MENU_ICON.block}
            destructive
            onPress={moderation.block}
          >
            {t('moderation:block.action')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
};

/** 내 할 일이면 기존 할 일 옵션 시트를 연다. 친구 할 일의 신고·차단은 TodoModerationMenu가 맡는다. */
function TodoActionsButton() {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const [todoId] = useTodoId();
  const [date] = useFeedDateKey();
  const push = useSingleTap(router.push);
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  if (detail == null || !detail.permissions.canEdit) {
    return null;
  }

  return (
    <IconButton
      icon={
        <MoreIcon
          width={fontScaledSize(22)}
          height={fontScaledSize(22)}
          colorClassName="text-gray-9"
        />
      }
      className="size-11 rounded-full"
      accessibilityLabel={t('actions.more')}
      onPress={() => push({ pathname: '/todo/[todoId]/actions', params: { todoId, date } })}
    />
  );
}

/** 펼친 피드 pane의 ⋯. 친구 할 일에서만 신고·차단을 보인다 */
function TodoModerationMenu() {
  const { t } = useTranslation('moderation');
  const fontScaledSize = useFontScaledSize();
  const [todoId] = useTodoId();
  const moderation = useTodoModerationActions({ todoId });
  const [isOpen, setIsOpen] = useState(false);

  if (!moderation.isAvailable) {
    return null;
  }

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <IconButton
          icon={
            <MoreIcon
              width={fontScaledSize(20)}
              height={fontScaledSize(20)}
              colorClassName="text-gray-9"
            />
          }
          className="size-11 rounded-full"
          accessibilityLabel={t('menu.more')}
          accessibilityState={{ expanded: isOpen }}
        />
      </Menu.Trigger>
      <MenuContent width={ACTION_MENU_WIDTH}>
        <MenuActionItem Icon={FlagIcon} title={t('menu.report')} onPress={moderation.report} />
        <MenuActionItem
          Icon={BlockIcon}
          title={t('block.action')}
          variant="danger"
          onPress={moderation.block}
        />
      </MenuContent>
    </Menu>
  );
}
