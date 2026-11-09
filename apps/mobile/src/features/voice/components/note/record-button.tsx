import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { Box, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ReactNode } from 'react';
import { Easing } from 'react-native-reanimated';
import { match } from 'ts-pattern';

export const RECORD_BUTTON_GAP = 8;
const RECORD_BUTTON_SIDE_SIZE = 52;
const RECORD_BUTTON_PRIMARY_SIZE = 64;
export const RECORD_BUTTON_ICON_SIZE = 24;
/** 큰 글자에서 라벨이 줄어드는 한계. 옆 칸 라벨과 기준선이 함께 바뀐다 */
export const RECORD_BUTTON_LABEL_MIN_SCALE = 0.8;
/** ui-components.md의 누름 기준 */
const RECORD_BUTTON_PRESS = {
  scale: {
    value: 0.97,
    timingConfig: { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) },
    // 기본은 작은 버튼일수록 더 줄어든다(52pt면 0.83)
    ignoreScaleCoefficient: true,
  },
};

export function useRecordButtonLabelClearance() {
  const fontScaledSize = useFontScaledSize();

  return (
    RECORD_BUTTON_GAP +
    (fontScaledSize(RECORD_BUTTON_PRIMARY_SIZE) + fontScaledSize(RECORD_BUTTON_SIDE_SIZE)) / 2
  );
}

interface RecordButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isPrimary?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export function RecordButton({ label, children, ...buttonProps }: RecordButtonProps) {
  return (
    <RecordButton.Column
      label={
        <Text
          size="e1"
          shade={7}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={RECORD_BUTTON_LABEL_MIN_SCALE}
        >
          {label}
        </Text>
      }
    >
      <RecordButton.Button label={label} {...buttonProps}>
        {children}
      </RecordButton.Button>
    </RecordButton.Column>
  );
}

RecordButton.Column = function Column({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack flex={1} align="center" gap={RECORD_BUTTON_GAP}>
      <Box
        className="items-center justify-center"
        style={{ height: fontScaledSize(RECORD_BUTTON_PRIMARY_SIZE) }}
      >
        {children}
      </Box>
      {label}
    </VStack>
  );
};

RecordButton.Button = function Button({
  label,
  isPrimary = false,
  isActive = false,
  className,
  children,
  ...pressableProps
}: RecordButtonProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(isPrimary ? RECORD_BUTTON_PRIMARY_SIZE : RECORD_BUTTON_SIDE_SIZE);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      animation={RECORD_BUTTON_PRESS}
      style={{ width: size, height: size }}
      {...pressableProps}
      className={cn(
        'items-center justify-center rounded-full',
        match({ isPrimary, isActive })
          .with({ isPrimary: true }, () => 'bg-main')
          .with({ isActive: true }, () => 'bg-main/10')
          .otherwise(() => 'bg-gray-2'),
        pressableProps.isDisabled === true && 'opacity-50',
        className,
      )}
    >
      {children}
    </PressableFeedback>
  );
};
