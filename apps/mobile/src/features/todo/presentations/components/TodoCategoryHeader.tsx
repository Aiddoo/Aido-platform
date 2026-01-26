import type { TodoVisibility } from '@src/features/todo/models/todo.model';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { LockIcon, PersonIcon, PlusIcon } from '@src/shared/ui/Icon';
import { Text } from '@src/shared/ui/Text/Text';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';

interface TodoCategoryHeaderProps {
  visibility: TodoVisibility;
  onPressAdd: () => void;
}

const VISIBILITY_CONFIG: Record<TodoVisibility, { label: string; icon: ReactNode }> = {
  PUBLIC: {
    label: '공개',
    icon: <PersonIcon width={16} height={16} colorClassName="text-gray-6" />,
  },
  PRIVATE: {
    label: '비공개',
    icon: <LockIcon width={16} height={16} colorClassName="text-gray-6" />,
  },
};

export const TodoCategoryHeader = ({ visibility, onPressAdd }: TodoCategoryHeaderProps) => {
  const config = VISIBILITY_CONFIG[visibility];

  return (
    <HStack align="center" justify="between" className="px-4 py-2">
      <HStack gap={6} align="center" className="bg-gray-1 rounded-full px-3 py-1.5">
        {config.icon}
        <Text size="b4" weight="medium" shade={7}>
          {config.label}
        </Text>
      </HStack>

      <PressableFeedback onPress={onPressAdd} className="p-1">
        <PlusIcon width={20} height={20} colorClassName="text-gray-6" />
      </PressableFeedback>
    </HStack>
  );
};
