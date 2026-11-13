import { Box, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ReactNode } from 'react';
import { Easing } from 'react-native-reanimated';
import { match } from 'ts-pattern';

export const RECORD_BUTTON_GAP = 8;
// 아이콘만 있는 버튼이라 원(누름 칸)은 고정이고 안의 아이콘만 글꼴 단계를 따른다(ui.md). 큰 단계에서 원이 커져 옆 버튼과 어긋나지 않는다
const RECORD_BUTTON_SIDE_SIZE = 52;
const RECORD_BUTTON_PRIMARY_SIZE = 64;
export const RECORD_BUTTON_ICON_SIZE = 24;
/** 라벨에서 옆 버튼 위까지. 버튼 줄은 큰 원 높이이고 옆 원은 그 가운데에 있다 */
export const RECORD_BUTTON_LABEL_CLEARANCE =
  RECORD_BUTTON_GAP + (RECORD_BUTTON_PRIMARY_SIZE + RECORD_BUTTON_SIDE_SIZE) / 2;
/** 큰 글자에서 라벨이 줄어드는 한계. 옆 칸 라벨과 기준선이 함께 바뀐다 */
export const RECORD_BUTTON_LABEL_MIN_SCALE = 0.8;
/** 크기가 다른 녹음 버튼들이 같은 비율로 눌린다 */
const RECORD_BUTTON_PRESS = {
  scale: {
    value: 0.97,
    timingConfig: { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) },
    // 기본은 작은 버튼일수록 더 줄어든다(52pt면 0.83)
    ignoreScaleCoefficient: true,
  },
};

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
  return (
    <VStack flex={1} align="center" gap={RECORD_BUTTON_GAP}>
      <Box className="items-center justify-center" style={{ height: RECORD_BUTTON_PRIMARY_SIZE }}>
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
  const size = isPrimary ? RECORD_BUTTON_PRIMARY_SIZE : RECORD_BUTTON_SIDE_SIZE;

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
