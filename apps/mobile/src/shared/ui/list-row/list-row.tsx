import { HStack } from '@src/shared/ui/h-stack';
import { cn } from '@src/shared/utils/cn';
import { tv } from '@src/shared/utils/tv';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';
import { ListRowTexts } from './list-row-texts';

const listRowVariants = tv({
  variants: {
    verticalPadding: {
      small: 'py-1',
      medium: 'py-2',
      large: 'py-4',
      xlarge: 'py-5',
    },
    horizontalPadding: {
      none: '',
      small: 'px-2',
      medium: 'px-4',
    },
    border: {
      none: '',
      indented: 'border-b border-gray-3',
    },
    isDisabled: {
      true: 'opacity-40',
    },
  },

  defaultVariants: {
    verticalPadding: 'medium',
    horizontalPadding: 'none',
    border: 'none',
  },
});

const listRowSlotVariants = tv({
  base: 'flex',
  variants: {
    alignment: {
      top: 'items-start',
      center: 'items-center',
    },
  },
  defaultVariants: {
    alignment: 'center',
  },
});

type ListRowVariantProps = VariantProps<typeof listRowVariants>;

/** @public */
export type ListRowVerticalPadding = NonNullable<ListRowVariantProps['verticalPadding']>;
/** @public */
export type ListRowHorizontalPadding = NonNullable<ListRowVariantProps['horizontalPadding']>;
/** @public */
export type ListRowBorder = NonNullable<ListRowVariantProps['border']>;
/** @public */
export type ListRowAlignment = NonNullable<VariantProps<typeof listRowSlotVariants>['alignment']>;

export interface ListRowProps extends Omit<ViewProps, 'children'>, ListRowVariantProps {
  left?: ReactNode;
  contents: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  leftAlignment?: ListRowAlignment;
  rightAlignment?: ListRowAlignment;
  className?: string;
}

export function ListRow({
  left,
  contents,
  right,
  verticalPadding,
  horizontalPadding,
  border,
  leftAlignment,
  rightAlignment,
  isDisabled,
  onPress,
  className,
  ...props
}: ListRowProps) {
  const row = (
    <HStack
      align="center"
      gap={12}
      className={cn(
        listRowVariants({ verticalPadding, horizontalPadding, border, isDisabled }),
        className,
      )}
      {...props}
    >
      {left && <Box className={listRowSlotVariants({ alignment: leftAlignment })}>{left}</Box>}
      <Box className="flex-1">{contents}</Box>
      {right && <Box className={listRowSlotVariants({ alignment: rightAlignment })}>{right}</Box>}
    </HStack>
  );

  if (onPress == null) {
    return row;
  }

  return (
    <PressableFeedback accessibilityRole="button" isDisabled={isDisabled} onPress={onPress}>
      {row}
    </PressableFeedback>
  );
}

// `.Loading`을 단 부속은 함수 선언이어야 TS가 그 속성을 안다
ListRow.Texts = ListRowTexts;
