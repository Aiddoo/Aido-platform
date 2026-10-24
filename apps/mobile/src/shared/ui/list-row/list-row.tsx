import { HStack } from '@src/shared/ui/h-stack';
import { cn } from '@src/shared/utils/cn';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

import { ListRowImage } from './list-row-image';
import { ListRowTexts } from './list-row-texts';

export type ListRowVerticalPadding = 'small' | 'medium' | 'large' | 'xlarge';
export type ListRowHorizontalPadding = 'small' | 'medium' | 'none';
export type ListRowBorder = 'indented' | 'none';
export type ListRowAlignment = 'top' | 'center';

export interface ListRowProps extends Omit<ViewProps, 'children'> {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
  border?: ListRowBorder;
  leftAlignment?: ListRowAlignment;
  rightAlignment?: ListRowAlignment;
  isDisabled?: boolean;
  className?: string;
}

const listRowVariants = ({
  verticalPadding = 'medium',
  horizontalPadding = 'none',
  border = 'none',
  isDisabled = false,
}: {
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
  border?: ListRowBorder;
  isDisabled?: boolean;
}) => {
  const paddingY = {
    small: 'py-1',
    medium: 'py-2',
    large: 'py-4',
    xlarge: 'py-5',
  }[verticalPadding];

  const paddingX = {
    none: '',
    small: 'px-2',
    medium: 'px-4',
  }[horizontalPadding];

  const borderClass = border === 'indented' ? 'border-b border-gray-3' : '';
  const disabledClass = isDisabled ? 'opacity-40' : '';

  return cn(paddingY, paddingX, borderClass, disabledClass);
};

const listRowSlotVariants = ({ alignment = 'center' }: { alignment?: ListRowAlignment }) => {
  return cn('flex', alignment === 'top' ? 'items-start' : 'items-center');
};

export function ListRow({
  left,
  contents,
  right,
  verticalPadding = 'medium',
  horizontalPadding = 'none',
  border = 'none',
  leftAlignment = 'center',
  rightAlignment = 'center',
  isDisabled = false,
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
      {left && <View className={listRowSlotVariants({ alignment: leftAlignment })}>{left}</View>}
      {contents && <View className="flex-1">{contents}</View>}
      {right && <View className={listRowSlotVariants({ alignment: rightAlignment })}>{right}</View>}
    </HStack>
  );
}

ListRow.Texts = ListRowTexts;
ListRow.Image = ListRowImage;
