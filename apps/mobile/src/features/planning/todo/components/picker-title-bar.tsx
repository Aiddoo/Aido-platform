import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, CloseIcon, getTouchTargetInset, HStack, Text } from '@src/shared/ui';
import { CloseButton, PressableFeedback } from 'heroui-native';

/** 확인 글자 줄(가장 작은 글꼴 단계에서 b2가 바뀌는 b4의 줄 19). 아래 내용과는 20 이상 떨어져 있다 */
const CONFIRM_LINE_HEIGHT = 19;
const CONFIRM_HIT_SLOP = {
  top: getTouchTargetInset(CONFIRM_LINE_HEIGHT),
  bottom: getTouchTargetInset(CONFIRM_LINE_HEIGHT),
  left: 8,
  right: 8,
};

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
          className="size-5"
          hitSlop={12}
          aria-label={t('actions.close')}
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
        <PressableFeedback
          onPress={onConfirm}
          isDisabled={isConfirmDisabled}
          hitSlop={CONFIRM_HIT_SLOP}
        >
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
