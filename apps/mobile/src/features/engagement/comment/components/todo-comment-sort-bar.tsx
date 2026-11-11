import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, Text, MenuContent } from '@src/shared/ui';
import { Menu, type MenuKey, PressableFeedback, Spinner } from 'heroui-native';
import { type ComponentProps, useState } from 'react';
import { match } from 'ts-pattern';

const SORT_MENU_WIDTH = 208;

interface TodoCommentSortBarProps extends Omit<
  ComponentProps<typeof Menu>,
  'children' | 'isOpen' | 'onOpenChange'
> {
  value: TodoCommentSort;
  onChange: (value: TodoCommentSort) => void;
  isLoading?: boolean;
}

function toSort(key: MenuKey | undefined): TodoCommentSort | null {
  return match(key)
    .with(TODO_COMMENT_SORT.POPULAR, () => TODO_COMMENT_SORT.POPULAR)
    .with(TODO_COMMENT_SORT.LATEST, () => TODO_COMMENT_SORT.LATEST)
    .otherwise(() => null);
}

export function TodoCommentSortBar({
  value,
  onChange,
  isLoading = false,
  ...menuProps
}: TodoCommentSortBarProps) {
  const { t } = useTranslation('todoComment');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentLabel = match(value)
    .with(TODO_COMMENT_SORT.POPULAR, () => t('sort.popular'))
    .with(TODO_COMMENT_SORT.LATEST, () => t('sort.latest'))
    .exhaustive();

  return (
    <Menu {...menuProps} isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          className="min-h-11 flex-row items-center gap-1 ps-3"
          isDisabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('sort.label', { value: currentLabel })}
          accessibilityState={{ expanded: isMenuOpen, busy: isLoading, disabled: isLoading }}
        >
          <Text size="b4" shade={6}>
            {currentLabel}
          </Text>
          {isLoading ? (
            <Spinner size="sm" />
          ) : (
            <HStack className="rotate-90">
              <ArrowRightIcon width={13} height={13} colorClassName="text-gray-6" />
            </HStack>
          )}
        </PressableFeedback>
      </Menu.Trigger>
      <MenuContent width={SORT_MENU_WIDTH}>
        <Menu.Group
          selectionMode="single"
          selectedKeys={new Set([value])}
          onSelectionChange={(selectedKeys) => {
            const [selected] = selectedKeys;
            const next = toSort(selected);
            if (next != null && next !== value) {
              onChange(next);
            }
          }}
          shouldCloseOnSelect
        >
          <Menu.Item id={TODO_COMMENT_SORT.LATEST}>
            <Menu.ItemIndicator />
            <Menu.ItemTitle>
              <Text size="b2" weight="medium" className="text-foreground">
                {t('sort.latest')}
              </Text>
            </Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item id={TODO_COMMENT_SORT.POPULAR}>
            <Menu.ItemIndicator />
            <Menu.ItemTitle>
              <Text size="b2" weight="medium" className="text-foreground">
                {t('sort.popular')}
              </Text>
            </Menu.ItemTitle>
          </Menu.Item>
        </Menu.Group>
      </MenuContent>
    </Menu>
  );
}
