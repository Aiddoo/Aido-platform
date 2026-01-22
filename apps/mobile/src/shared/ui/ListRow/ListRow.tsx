import { HStack } from '@src/shared/ui/HStack/HStack';
import { cn } from '@src/shared/utils';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';
import { ListRowImage } from './ListRowImage';
import { ListRowTexts } from './ListRowTexts';

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
  disabled?: boolean;
  className?: string;
}

const listRowVariants = ({
  verticalPadding = 'medium',
  horizontalPadding = 'none',
  border = 'none',
  disabled = false,
}: {
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
  border?: ListRowBorder;
  disabled?: boolean;
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
  const disabledClass = disabled ? 'opacity-40' : '';

  return cn('bg-white', paddingY, paddingX, borderClass, disabledClass);
};

const listRowSlotVariants = ({ alignment = 'center' }: { alignment?: ListRowAlignment }) => {
  return cn('flex', alignment === 'top' ? 'items-start' : 'items-center');
};

const ListRowComponent = ({
  left,
  contents,
  right,
  verticalPadding = 'medium',
  horizontalPadding = 'none',
  border = 'none',
  leftAlignment = 'center',
  rightAlignment = 'center',
  disabled = false,
  className,
  ...props
}: ListRowProps) => {
  return (
    <HStack
      align="center"
      gap={12}
      className={cn(
        listRowVariants({ verticalPadding, horizontalPadding, border, disabled }),
        className,
      )}
      {...props}
    >
      {left && <View className={listRowSlotVariants({ alignment: leftAlignment })}>{left}</View>}
      {contents && <View className="flex-1">{contents}</View>}
      {right && <View className={listRowSlotVariants({ alignment: rightAlignment })}>{right}</View>}
    </HStack>
  );
};

export const ListRow = Object.assign(ListRowComponent, {
  Texts: ListRowTexts,
  Image: ListRowImage,
});
