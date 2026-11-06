import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { Box, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ReactNode } from 'react';
import { Easing } from 'react-native-reanimated';
import { match } from 'ts-pattern';

export const RECORD_CONTROL_GAP = 8;
const RECORD_CONTROL_SIDE_SIZE = 52;
const RECORD_CONTROL_PRIMARY_SIZE = 64;
export const RECORD_CONTROL_ICON_SIZE = 24;
/** ui-components.md의 누름 기준 */
const RECORD_CONTROL_PRESS = {
  scale: {
    value: 0.97,
    timingConfig: { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) },
    // 기본은 작은 버튼일수록 더 줄어든다(52pt면 0.83)
    ignoreScaleCoefficient: true,
  },
};

export function useRecordControlLabelClearance() {
  const fontScaledSize = useFontScaledSize();

  return (
    RECORD_CONTROL_GAP +
    (fontScaledSize(RECORD_CONTROL_PRIMARY_SIZE) + fontScaledSize(RECORD_CONTROL_SIDE_SIZE)) / 2
  );
}

interface RecordControlProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isPrimary?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export function RecordControl({ label, children, ...buttonProps }: RecordControlProps) {
  return (
    <RecordControl.Column
      label={
        <Text size="e1" shade={7} maxLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
      }
    >
      <RecordControl.Button label={label} {...buttonProps}>
        {children}
      </RecordControl.Button>
    </RecordControl.Column>
  );
}

RecordControl.Column = function Column({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const fontScaledSize = useFontScaledSize();

  return (
    <VStack flex={1} align="center" gap={RECORD_CONTROL_GAP}>
      <Box
        className="items-center justify-center"
        style={{ height: fontScaledSize(RECORD_CONTROL_PRIMARY_SIZE) }}
      >
        {children}
      </Box>
      {label}
    </VStack>
  );
};

RecordControl.Button = function Button({
  label,
  isPrimary = false,
  isActive = false,
  children,
  ...pressableProps
}: RecordControlProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(isPrimary ? RECORD_CONTROL_PRIMARY_SIZE : RECORD_CONTROL_SIDE_SIZE);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      animation={RECORD_CONTROL_PRESS}
      style={{ width: size, height: size }}
      className={cn(
        'items-center justify-center rounded-full',
        match({ isPrimary, isActive })
          .with({ isPrimary: true }, () => 'bg-main')
          .with({ isActive: true }, () => 'bg-main/10')
          .otherwise(() => 'bg-gray-2'),
        pressableProps.isDisabled === true && 'opacity-50',
      )}
      {...pressableProps}
    >
      {children}
    </PressableFeedback>
  );
};
