import { Box, HStack, MoreIcon, PlusIcon, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';
import { TodoList } from '../TodoList/TodoList';

interface SubTodoListProps {
  children: ReactNode;
  onAddPress: () => void;
  isAddDisabled?: boolean;
}

export function SubTodoList({ children, onAddPress, isAddDisabled }: SubTodoListProps) {
  return (
    <VStack className="ml-8 pl-4 border-l border-gray-2" gap={0}>
      {children}

      {!isAddDisabled && (
        <PressableFeedback onPress={onAddPress} className="py-1.5">
          <HStack gap={8} align="center">
            <PlusIcon width={14} height={14} colorClassName="text-gray-4" />
            <Text size="e1" shade={5}>
              항목 추가
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
    <TodoList.Item
      left={<TodoList.Checkbox isChecked={isChecked} onCheckedChange={onCheckedChange} />}
      top={<TodoList.Label isChecked={isChecked}>{label}</TodoList.Label>}
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

interface ProgressIndicatorProps {
  value: number;
  total: number;
}

export function SubTodoProgressIndicator({ value, total }: ProgressIndicatorProps) {
  return (
    <HStack gap={6} align="center">
      <Box className="h-1 w-10 rounded-full bg-gray-2 overflow-hidden">
        <Box
          className="h-full rounded-full bg-main"
          style={{ width: `${(value / total) * 100}%` }}
        />
      </Box>
      <Text size="e1" shade={6}>
        {value}/{total}
      </Text>
    </HStack>
  );
}
