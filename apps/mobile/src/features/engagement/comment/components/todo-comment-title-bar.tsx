import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTodoModerationActions } from '@src/features/social/moderation/hooks/use-todo-moderation-actions';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BlockIcon,
  FlagIcon,
  MenuActionItem,
  STACK_MENU_ICON,
  HStack,
  MoreIcon,
  STACK_BACK_ICON,
  STACK_MORE_ICON,
  Text,
  useStackScreenOptions,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Button, Menu } from 'heroui-native';
import { useState } from 'react';

import { useTodoCommentBack } from '../hooks/use-todo-comment-back';

/** 펼친 피드의 상세 pane 제목 바. pane은 Stack 화면이 아니라 네이티브 헤더가 없고, 선택 해제는 목록 pane이 맡는다 */
export function TodoCommentTitleBar({ date }: { date: string }) {
  const { t } = useTranslation('todo');

  return (
    <HStack align="center" gap={4} pl={20} pr={4} className="min-h-14">
      <Text size="b2" weight="bold" numberOfLines={1} className="min-w-0 flex-1">
        {t('detail.pageTitle')}
      </Text>

      <TodoActionsButton date={date} />
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
  const { result: backResult, handleBack } = useTodoCommentBack();

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
          // 작성기가 열려 있으면 swipe가 화면을 닫지 않고 뒤로가기가 작성기부터 닫는다
          gestureEnabled: backResult === 'native',
          title: t('todo:detail.pageTitle'),
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_BACK_ICON}
          accessibilityLabel={
            backResult === 'closeComposer'
              ? t('todoComment:actions.closeComposer')
              : t('actions.goBack')
          }
          disabled={backResult === 'blocked'}
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
function TodoActionsButton({ date }: { date: string }) {
  const { t } = useTranslation('todo');
  const [todoId] = useTodoId();
  const push = useSingleTap(router.push);
  const { data: detail } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  if (detail == null || !detail.permissions.canEdit) {
    return null;
  }

  return (
    <Button
      isIconOnly
      variant="ghost"
      className="size-11 rounded-full"
      accessibilityLabel={t('actions.more')}
      onPress={() => push({ pathname: '/todo/[todoId]/actions', params: { todoId, date } })}
    >
      <MoreIcon width={22} height={22} colorClassName="text-gray-9" />
    </Button>
  );
}

/** 펼친 피드 pane의 ⋯. 친구 할 일에서만 신고·차단을 보인다 */
function TodoModerationMenu() {
  const { t } = useTranslation('moderation');
  const [todoId] = useTodoId();
  const moderation = useTodoModerationActions({ todoId });
  const [isOpen, setIsOpen] = useState(false);

  if (!moderation.isAvailable) {
    return null;
  }

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <Button
          isIconOnly
          variant="ghost"
          className="size-11 rounded-full"
          accessibilityLabel={t('menu.more')}
          accessibilityState={{ expanded: isOpen }}
        >
          <MoreIcon width={20} height={20} colorClassName="text-gray-9" />
        </Button>
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
          <MenuActionItem icon={FlagIcon} title={t('menu.report')} onPress={moderation.report} />
          <MenuActionItem
            icon={BlockIcon}
            title={t('block.action')}
            variant="danger"
            onPress={moderation.block}
          />
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
