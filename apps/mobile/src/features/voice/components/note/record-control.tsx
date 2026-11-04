import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

export const RECORD_CONTROL_GAP = 8;
export const RECORD_CONTROL_SIDE_SIZE = 52;
const RECORD_CONTROL_PRIMARY_SIZE = 64;

interface RecordControlProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isPrimary?: boolean;
  children: ReactNode;
}

/** 녹음 화면의 조작 하나(둥근 버튼 + 라벨) */
export function RecordControl({
  label,
  isPrimary = false,
  children,
  ...pressableProps
}: RecordControlProps) {
  return (
    <RecordControl.Column isPrimary={isPrimary}>
      <RecordControl.Button label={label} isPrimary={isPrimary} {...pressableProps}>
        {children}
      </RecordControl.Button>
      <Text size="e1" shade={7} maxLines={1}>
        {label}
      </Text>
    </RecordControl.Column>
  );
}

/** 양옆 칸은 폭을 고정한다. 라벨 길이가 바뀌어도 버튼들이 움직이지 않는다 */
RecordControl.Column = function Column({
  isPrimary = false,
  children,
}: {
  isPrimary?: boolean;
  children: ReactNode;
}) {
  return (
    <VStack align="center" gap={RECORD_CONTROL_GAP} className={cn(!isPrimary && 'w-28 shrink')}>
      {children}
    </VStack>
  );
};

RecordControl.Button = function Button({
  label,
  isPrimary = false,
  children,
  ...pressableProps
}: RecordControlProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(isPrimary ? RECORD_CONTROL_PRIMARY_SIZE : RECORD_CONTROL_SIDE_SIZE);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
      className={cn(
        'items-center justify-center rounded-full',
        isPrimary ? 'bg-main' : 'bg-gray-2',
        pressableProps.isDisabled === true && 'opacity-50',
      )}
      {...pressableProps}
    >
      {children}
    </PressableFeedback>
  );
};
