import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Checkbox, PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

interface TodoRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  left?: ReactNode;
  top: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  right?: ReactNode;
  isActive?: boolean;
  children?: ReactNode;
}

export function TodoRow({
  left,
  top,
  middle,
  bottom,
  right,
  onPress,
  onLongPress,
  isActive,
  isDisabled,
  children,
  className,
  ...pressableProps
}: TodoRowProps) {
  return (
    <>
      <PressableFeedback
        {...pressableProps}
        onPress={onPress}
        onLongPress={onLongPress}
        isDisabled={isActive || isDisabled || (!onPress && !onLongPress)}
        className={cn(
          'rounded-xl py-2',
          isActive && 'bg-gray-1',
          isDisabled && 'opacity-50',
          className,
        )}
      >
        <HStack gap={12} align="center">
          {left}
          <VStack flex={1} gap={2}>
            {top}
            {middle}
            {bottom}
          </VStack>
          {right}
        </HStack>
      </PressableFeedback>
      {children}
    </>
  );
}

type TodoCheckboxProps = ComponentProps<typeof Checkbox>;

export function TodoCheckbox({
  isSelected,
  onSelectedChange,
  isDisabled,
  className,
  ...props
}: TodoCheckboxProps) {
  return (
    <Checkbox
      {...props}
      className={cn('size-5 rounded-md border border-main shadow-none', className)}
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
      isDisabled={isDisabled || onSelectedChange === undefined}
    />
  );
}

interface TodoLabelProps extends Omit<
  ComponentProps<typeof Text>,
  'size' | 'weight' | 'strikethrough' | 'shade' | 'children'
> {
  isChecked: boolean;
  children: string;
}

export function TodoLabel({ isChecked, children, ...props }: TodoLabelProps) {
  return (
    <Text
      size="b3"
      weight="medium"
      strikethrough={isChecked}
      shade={isChecked ? 5 : undefined}
      {...props}
    >
      {children}
    </Text>
  );
}

interface TodoProgressProps {
  value: number;
  total: number;
}

export function TodoProgress({ value, total }: TodoProgressProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <HStack gap={6} align="center">
      <Box className="h-1 w-10 rounded-full bg-gray-2 overflow-hidden">
        <Box className="h-full rounded-full bg-main" style={{ width: `${percentage}%` }} />
      </Box>
      <Text size="e1" shade={6}>
        {value}/{total}
      </Text>
    </HStack>
  );
}
