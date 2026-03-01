import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { CloseIcon } from '@src/shared/ui/Icon';
import { Text } from '@src/shared/ui/Text/Text';
import { PressableFeedback } from 'heroui-native';

interface PickerHeaderProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const PickerHeader = ({ title, onCancel, onConfirm }: PickerHeaderProps) => {
  return (
    <HStack className="items-center" px={16}>
      <Box className="flex-1 items-start">
        <PressableFeedback onPress={onCancel}>
          <CloseIcon width={20} height={20} colorClassName="text-gray-8" />
        </PressableFeedback>
      </Box>
      <Text size="b2" weight="semibold" tone="neutral" shade={8}>
        {title}
      </Text>
      <Box className="flex-1 items-end">
        <PressableFeedback onPress={onConfirm}>
          <Text size="b2" weight="medium" tone="brand">
            확인
          </Text>
        </PressableFeedback>
      </Box>
    </HStack>
  );
};
