import { useTranslation } from '@src/shared/i18n';
import { HStack, MoreIcon, PlusIcon, Text } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { match } from 'ts-pattern';

import { SubTodoIndent } from '../sub-todo-indent';
import { TODO_ROW_ACCESSIBILITY_ACTION, TodoCheckbox, TodoLabel, TodoRow } from '../todo-row';

interface SubTodoListProps {
  children: ReactNode;
  onAddPress: () => void;
  isAddDisabled?: boolean;
}

export function SubTodoList({ children, onAddPress, isAddDisabled }: SubTodoListProps) {
  const { t } = useTranslation('todo');
  return (
    <SubTodoIndent>
      {children}

      {!isAddDisabled && (
        <PressableFeedback onPress={onAddPress} className="py-1.5">
          <HStack gap={8} align="center">
            <PlusIcon width={14} height={14} colorClassName="text-gray-4" />
            <Text size="e1" shade={5}>
              {t('subTodo.addItem')}
            </Text>
          </HStack>
        </PressableFeedback>
      )}
    </SubTodoIndent>
  );
}

interface SubTodoListItemProps extends Omit<ComponentProps<typeof TodoCheckbox>, 'children'> {
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
  ...checkboxProps
}: SubTodoListItemProps) {
  const { t } = useTranslation('todo');
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  const handleAccessibilityAction = (event: AccessibilityActionEvent) =>
    match(event.nativeEvent.actionName)
      .with(TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted, () => onSelectedChange(!isSelected))
      .with(TODO_ROW_ACCESSIBILITY_ACTION.more, onMorePress)
      .otherwise(noop);

  return (
    <TodoRow
      accessibilityActions={[
        {
          name: TODO_ROW_ACCESSIBILITY_ACTION.toggleCompleted,
          label: t(isSelected ? 'actions.uncomplete' : 'actions.complete'),
        },
        { name: TODO_ROW_ACCESSIBILITY_ACTION.more, label: t('actions.more') },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      left={
        <TodoCheckbox
          {...checkboxProps}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
        />
      }
      top={<TodoLabel isChecked={isSelected}>{label}</TodoLabel>}
      right={
        <PressableFeedback
          onPress={onMorePress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('actions.more')}
        >
          <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      }
      onLongPress={drag}
      isActive={isActive}
    />
  );
};
