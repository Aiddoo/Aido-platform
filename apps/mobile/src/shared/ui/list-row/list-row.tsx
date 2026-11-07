import { HStack } from '@src/shared/ui/h-stack';
import { cn } from '@src/shared/utils/cn';
import { tv } from '@src/shared/utils/tv';
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
    isDisabled: {
      true: 'opacity-40',
    },
  },

  defaultVariants: {
    verticalPadding: 'medium',
    horizontalPadding: 'none',
  },
});

export interface ListRowProps
  extends Omit<ViewProps, 'children'>, VariantProps<typeof listRowVariants> {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function ListRow({
  left,
  contents,
  right,
  verticalPadding,
  horizontalPadding,
  isDisabled,
  className,
  ...props
}: ListRowProps) {
  return (
    <HStack
      align="center"
      gap={12}
      className={cn(listRowVariants({ verticalPadding, horizontalPadding, isDisabled }), className)}
      {...props}
    >
      {left && <Box className="flex items-center">{left}</Box>}
      {contents && <Box className="flex-1">{contents}</Box>}
      {right && <Box className="flex items-center">{right}</Box>}
    </HStack>
  );
}

ListRow.Texts = ListRowTexts;
