import { HStack } from '@src/shared/ui/h-stack';
import { cn } from '@src/shared/utils/cn';
import { tv } from '@src/shared/utils/tv';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import type { VariantProps } from 'tailwind-variants';

import { Box } from '../box';
import { ListRowImage } from './list-row-image';
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

/** 외부 재사용을 위해 열어 둔 공용 타입 @public */
export type ListRowVerticalPadding = NonNullable<ListRowVariantProps['verticalPadding']>;
/** 외부 재사용을 위해 열어 둔 공용 타입 @public */
export type ListRowHorizontalPadding = NonNullable<ListRowVariantProps['horizontalPadding']>;
/** 외부 재사용을 위해 열어 둔 공용 타입 @public */
export type ListRowBorder = NonNullable<ListRowVariantProps['border']>;
/** 외부 재사용을 위해 열어 둔 공용 타입 @public */
export type ListRowAlignment = NonNullable<VariantProps<typeof listRowSlotVariants>['alignment']>;

export interface ListRowProps extends Omit<ViewProps, 'children'>, ListRowVariantProps {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
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
  className,
  ...props
}: ListRowProps) {
  return (
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
      {contents && <Box className="flex-1">{contents}</Box>}
      {right && <Box className={listRowSlotVariants({ alignment: rightAlignment })}>{right}</Box>}
    </HStack>
  );
}

ListRow.Texts = ListRowTexts;
ListRow.Image = ListRowImage;
