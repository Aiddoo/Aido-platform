import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { HStack, MoreIcon, PlusIcon, Text, IconButton } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { match } from 'ts-pattern';

import { SubTodoIndent } from './sub-todo-indent';
import { TODO_ROW_ACCESSIBILITY_ACTION, TodoRow } from './todo-row';

interface SubTodoListProps {
  children: ReactNode;
  onAddPress: () => void;
  /** false면 추가 줄을 그리지 않는다 */
  canAdd: boolean;
}

export function SubTodoList({ children, onAddPress, canAdd }: SubTodoListProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();

  return (
    <SubTodoIndent>
      {children}

      {canAdd && (
        <PressableFeedback onPress={onAddPress} hitSlop={8} className="py-1.5">
          <HStack gap={8} align="center">
            <PlusIcon
              width={fontScaledSize(14)}
              height={fontScaledSize(14)}
              colorClassName="text-gray-4"
            />
            <Text size="e1" shade={5}>
              {t('subTodo.addItem')}
            </Text>
          </HStack>
        </PressableFeedback>
      )}
    </SubTodoIndent>
  );
}

interface SubTodoListItemProps extends Omit<ComponentProps<typeof TodoRow.Checkbox>, 'children'> {
  label: string;
  isSelected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onMorePress: () => void;
}

SubTodoList.Item = function Item({
  label,
  isSelected,
  onSelectedChange,
  onMorePress,
  isDisabled,
  ...checkboxProps
}: SubTodoListItemProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  const handleAccessibilityAction = (event: AccessibilityActionEvent) =>
    match(event.nativeEvent.actionName)
      .with(TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted, () => onSelectedChange(!isSelected))
      .with(TODO_ROW_ACCESSIBILITY_ACTION.more, onMorePress)
      .otherwise(noop);

  return (
    <TodoRow
      accessibilityActions={
        isDisabled
          ? undefined
          : [
              {
                name: TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted,
                label: t(isSelected ? 'actions.uncomplete' : 'actions.complete'),
              },
              { name: TODO_ROW_ACCESSIBILITY_ACTION.more, label: t('actions.more') },
            ]
      }
      onAccessibilityAction={handleAccessibilityAction}
      left={
        <TodoRow.Checkbox
          {...checkboxProps}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
          isDisabled={isDisabled}
        />
      }
      top={<TodoRow.Label isCompleted={isSelected}>{label}</TodoRow.Label>}
      right={
        <IconButton
          accessibilityLabel={t('actions.more')}
          icon={
            <MoreIcon
              width={fontScaledSize(20)}
              height={fontScaledSize(20)}
              colorClassName="text-gray-5"
            />
          }
          className="size-5 min-h-0 min-w-0"
          hitSlop={8}
          onPress={isDisabled ? undefined : onMorePress}
        />
      }
      onLongPress={drag}
      isActive={isActive}
      isDisabled={isDisabled}
    />
  );
};
