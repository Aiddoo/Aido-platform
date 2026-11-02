import {
  Box,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { tv } from '@src/shared/utils/tv';
import { Checkbox, PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

/** 행 안쪽 컨트롤을 스크린리더 동작으로 제공할 때 쓰는 이름. */
export const TODO_ROW_ACCESSIBILITY_ACTION = {
  toggleCompleted: 'toggleCompleted',
  comments: 'comments',
  more: 'more',
} as const;

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

TodoRow.Loading = function Loading() {
  return (
    <TodoRow
      left={<Skeleton className="size-5 rounded-md" />}
      top={<TextSkeleton size="b3" className="w-3/4" />}
      right={
        <Box className="px-2 py-1.5">
          <Skeleton
            className="rounded-full"
            style={{ width: ICON_COUNT_BUTTON_ICON_SIZE, height: ICON_COUNT_BUTTON_ICON_SIZE }}
          />
        </Box>
      }
    />
  );
};

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
      isDisabled={isDisabled || onSelectedChange == null}
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

type TodoProgressTone = 'surface' | 'onSky';

const todoProgress = tv({
  slots: { track: 'h-1 w-10 overflow-hidden rounded-full', label: '' },
  variants: {
    tone: {
      surface: { track: 'bg-gray-2' },
      onSky: { track: 'bg-on-sky/20', label: 'text-on-sky/60 tabular-nums' },
    },
  },
  defaultVariants: { tone: 'surface' },
});

interface TodoProgressProps {
  value: number;
  total: number;
  /** 날씨 하늘처럼 늘 어두운 면 위에서는 onSky로 흰 막대·글자를 쓴다. */
  tone?: TodoProgressTone;
}

export function TodoProgress({ value, total, tone = 'surface' }: TodoProgressProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const styles = todoProgress({ tone });

  return (
    <HStack gap={6} align="center">
      <Box className={styles.track()}>
        <Box className="h-full rounded-full bg-main" style={{ width: `${percentage}%` }} />
      </Box>
      <Text
        size="e1"
        tone={tone === 'onSky' ? 'onSky' : undefined}
        shade={tone === 'onSky' ? undefined : 6}
        className={styles.label()}
      >
        {value}/{total}
      </Text>
    </HStack>
  );
}
