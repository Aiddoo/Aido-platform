import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/api/vocabulary';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, HStack, Text } from '@src/shared/ui';
import { Menu, type MenuKey, PressableFeedback, Spinner } from 'heroui-native';
import { type ComponentProps, useState } from 'react';
import { match } from 'ts-pattern';

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
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={208}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
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
