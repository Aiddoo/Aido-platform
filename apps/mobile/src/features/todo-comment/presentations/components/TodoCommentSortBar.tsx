import { TODO_COMMENT_SORT } from '@aido/validators';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { Menu, type MenuKey, PressableFeedback, Spinner } from 'heroui-native';
import { useState } from 'react';

import { useTodoCommentSort } from '../hooks/use-todo-comment-sort';

export function TodoCommentSortBar() {
  const { t } = useTranslation('todoComment');
  const { sort, isChangingSort, changeSort } = useTodoCommentSort();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentSortLabel =
    sort === TODO_COMMENT_SORT.POPULAR ? t('sort.popular') : t('sort.latest');

  const selectSort = (selectedKeys: Set<MenuKey>) => {
    const [selected] = selectedKeys;

    if (selected === TODO_COMMENT_SORT.POPULAR || selected === TODO_COMMENT_SORT.LATEST) {
      changeSort(selected);
    }
  };

  return (
    <Menu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          className="min-h-11 flex-row items-center gap-1 py-1 pr-3"
          isDisabled={isChangingSort}
          accessibilityRole="button"
          accessibilityLabel={t('sort.label', { value: currentSortLabel })}
          accessibilityState={{
            expanded: isMenuOpen,
            busy: isChangingSort,
            disabled: isChangingSort,
          }}
        >
          <Text size="b2" weight="bold">
            {currentSortLabel}
          </Text>
          {isChangingSort ? (
            <Spinner size="sm" />
          ) : (
            <HStack className="rotate-90">
              <ArrowRightIcon width={15} height={15} colorClassName="text-gray-6" />
            </HStack>
          )}
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="start"
          width={208}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <Menu.Group
            selectionMode="single"
            selectedKeys={new Set([sort])}
            onSelectionChange={selectSort}
            shouldCloseOnSelect
          >
            <Menu.Item id={TODO_COMMENT_SORT.LATEST}>
              <Menu.ItemIndicator />
              <Menu.ItemTitle>{t('sort.latest')}</Menu.ItemTitle>
            </Menu.Item>
            <Menu.Item id={TODO_COMMENT_SORT.POPULAR}>
              <Menu.ItemIndicator />
              <Menu.ItemTitle>{t('sort.popular')}</Menu.ItemTitle>
            </Menu.Item>
          </Menu.Group>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
