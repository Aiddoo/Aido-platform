import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Checkbox, PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

/**
 * 할 일 목록의 행 프리미티브.
 *
 * 데이터를 모르는 순수 레이아웃이다. `TodoList`(컨테이너)가 아니라 여기 사는 이유:
 * 자식(`TodoItem`, `SubTodoList`, `FriendTodoList`)이 컨테이너를 import하면
 * 순환 참조가 생기고, Metro가 초기화되지 않은 값을 넘길 수 있다.
 */
interface TodoRowProps {
  left?: ReactNode;
  top: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
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
}: TodoRowProps) {
  return (
    <>
      <PressableFeedback
        onPress={onPress}
        onLongPress={onLongPress}
        isDisabled={isActive || isDisabled || (!onPress && !onLongPress)}
        className={cn('py-2 rounded-xl', isActive && 'bg-gray-1', isDisabled && 'opacity-50')}
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

interface TodoCheckboxProps
  extends Omit<ComponentProps<typeof Checkbox>, 'isSelected' | 'onSelectedChange' | 'className'> {
  isChecked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function TodoCheckbox({
  isChecked,
  onCheckedChange,
  isDisabled,
  ...props
}: TodoCheckboxProps) {
  return (
    <Checkbox
      className="shadow-none border border-main size-5 rounded-md"
      isSelected={isChecked}
      onSelectedChange={onCheckedChange ? () => onCheckedChange(!isChecked) : undefined}
      isDisabled={isDisabled || !onCheckedChange}
      {...props}
    />
  );
}

interface TodoLabelProps
  extends Omit<
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
  return (
    <HStack gap={6} align="center">
      <Box className="h-1 w-10 rounded-full bg-gray-2 overflow-hidden">
        <Box
          className="h-full rounded-full bg-main"
          style={{ width: `${(value / total) * 100}%` }}
        />
      </Box>
      <Text size="e1" shade={6}>
        {value}/{total}
      </Text>
    </HStack>
  );
}
