import { cn } from '@src/shared/utils';
import { View } from 'react-native';
import { HStack } from '../HStack/HStack';
import { ListRowIcon } from './ListRow.Icon';
import { ListRowTexts } from './ListRow.Texts';
import type { ListRowProps } from './ListRow.types';
import { listRowSlotVariants, listRowVariants } from './ListRow.variants';

function ListRowRoot({
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
}: ListRowProps) {
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
}

export const ListRow = Object.assign(ListRowRoot, {
  Icon: ListRowIcon,
  Texts: ListRowTexts,
});
