import { Box, CloseIcon, HStack, Text } from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { PressableFeedback } from 'heroui-native';

interface PickerHeaderProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirmDisabled?: boolean;
}

export const PickerHeader = ({
  title,
  onCancel,
  onConfirm,
  isConfirmDisabled = false,
}: PickerHeaderProps) => {
  return (
    <HStack className="items-center" px={16}>
      <Box className="flex-1 items-start">
        <PressableFeedback onPress={onCancel}>
          <CloseIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-8"
          />
        </PressableFeedback>
      </Box>
      <Text size="b2" weight="semibold" tone="neutral" shade={8}>
        {title}
      </Text>
      <Box className="flex-1 items-end">
        <PressableFeedback onPress={onConfirm} isDisabled={isConfirmDisabled}>
          <Text
            size="b2"
            weight="medium"
            tone={isConfirmDisabled ? 'neutral' : 'brand'}
            shade={isConfirmDisabled ? 4 : undefined}
          >
            확인
          </Text>
        </PressableFeedback>
      </Box>
    </HStack>
  );
};
