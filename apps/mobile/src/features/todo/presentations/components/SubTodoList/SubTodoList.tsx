import { useTranslation } from '@src/shared/i18n';
import { HStack, MoreIcon, PlusIcon, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';

import { TodoCheckbox, TodoLabel, TodoRow } from '../TodoRow';

interface SubTodoListProps {
  children: ReactNode;
  onAddPress: () => void;
  isAddDisabled?: boolean;
}

export function SubTodoList({ children, onAddPress, isAddDisabled }: SubTodoListProps) {
  const { t } = useTranslation('todo');
  return (
    <VStack className="ml-8 pl-4 border-l border-gray-2" gap={0}>
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
    </VStack>
  );
}

interface SubTodoListItemProps {
  label: string;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onMorePress: () => void;
  drag?: () => void;
  isActive?: boolean;
  isDragDisabled?: boolean;
}

SubTodoList.Item = function Item({
  label,
  isChecked,
  onCheckedChange,
  onMorePress,
  drag: itemDrag,
  isActive: itemIsActive,
  isDragDisabled,
}: SubTodoListItemProps) {
  return (
    <TodoRow
      left={<TodoCheckbox isSelected={isChecked} onSelectedChange={onCheckedChange} />}
      top={<TodoLabel isChecked={isChecked}>{label}</TodoLabel>}
      right={
        <PressableFeedback onPress={onMorePress} hitSlop={8}>
          <MoreIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      }
      onLongPress={isDragDisabled ? undefined : itemDrag}
      isActive={itemIsActive}
    />
  );
};
