import { View } from 'react-native';
import type { ListRowIconProps } from './ListRow.types';
import { listRowIconVariants } from './ListRow.variants';

export function ListRowIcon({ children, size, className }: ListRowIconProps) {
  return <View className={listRowIconVariants({ size, className })}>{children}</View>;
}
