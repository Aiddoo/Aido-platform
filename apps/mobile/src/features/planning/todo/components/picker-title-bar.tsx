import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, HStack, Text } from '@src/shared/ui';
import { CloseButton, PressableFeedback } from 'heroui-native';

interface PickerTitleBarProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirmDisabled?: boolean;
}

export function PickerTitleBar({
  title,
  onCancel,
  onConfirm,
  isConfirmDisabled = false,
}: PickerTitleBarProps) {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('common');

  return (
    <HStack className="items-center px-4">
      <Box className="flex-1 items-start">
        <CloseButton
          variant="ghost"
          style={{ width: fontScaledSize(20), height: fontScaledSize(20) }}
          accessibilityLabel={t('actions.close')}
          onPress={onCancel}
        >
          <CloseIcon
            width={fontScaledSize(20)}
            height={fontScaledSize(20)}
            colorClassName="text-gray-8"
          />
        </CloseButton>
      </Box>
      <Text size="b2" weight="semibold" tone="neutral" shade={8}>
        {title}
      </Text>
      <Box className="flex-1 items-end">
        <PressableFeedback onPress={onConfirm} isDisabled={isConfirmDisabled} hitSlop={8}>
          <Text
            size="b2"
            weight="medium"
            tone={isConfirmDisabled ? 'neutral' : 'brand'}
            shade={isConfirmDisabled ? 4 : undefined}
          >
            {t('actions.confirm')}
          </Text>
        </PressableFeedback>
      </Box>
    </HStack>
  );
}
