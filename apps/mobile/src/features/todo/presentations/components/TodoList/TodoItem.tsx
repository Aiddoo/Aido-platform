import { HStack } from '@src/shared/ui/HStack/HStack';
import { LockIcon, MenuIcon } from '@src/shared/ui/Icon';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { Checkbox, PressableFeedback } from 'heroui-native';

import type { TodoItemViewModel } from '../../queries/get-todos-infinite-query-options';
import { toggleTodoMutationOptions } from '../../queries/toggle-todo-mutation-options';

interface TodoItemProps {
  todo: TodoItemViewModel;
  onPress?: (todoId: number) => void;
}

export const TodoItem = ({ todo, onPress }: TodoItemProps) => {
  const toggleMutation = useMutation(toggleTodoMutationOptions());
  const showDateTime = todo.formattedTime && !todo.isAllDay;

  return (
    <PressableFeedback onPress={() => onPress?.(todo.id)} className="py-3">
      <HStack gap={12} align="center">
        <Checkbox
          isSelected={todo.completed}
          onSelectedChange={() =>
            toggleMutation.mutate({ todoId: todo.id, completed: !todo.completed })
          }
          isDisabled={toggleMutation.isPending}
        >
          <Checkbox.Indicator
            style={{
              backgroundColor: todo.completed ? todo.color : 'transparent',
              borderColor: todo.color,
            }}
            className="border-2 rounded"
            iconProps={{ color: 'white' }}
          />
        </Checkbox>

        <VStack flex={1} gap={2}>
          <HStack gap={4} align="center">
            <Text
              size="b3"
              weight="medium"
              strikethrough={todo.completed}
              shade={todo.completed ? 5 : undefined}
            >
              {todo.title}
            </Text>
            {todo.visibility === 'PRIVATE' && (
              <LockIcon width={14} height={14} colorClassName="text-gray-5" />
            )}
          </HStack>
          {showDateTime && (
            <Text size="e1" shade={6}>
              {todo.formattedTime}
            </Text>
          )}
        </VStack>

        <PressableFeedback className="p-1">
          <MenuIcon width={20} height={20} colorClassName="text-gray-5" />
        </PressableFeedback>
      </HStack>
    </PressableFeedback>
  );
};
