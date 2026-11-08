import type { ComponentProps } from 'react';
import { RefreshControl } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export function TintedRefreshControl(props: ComponentProps<typeof RefreshControl>) {
  const { color } = useResolveClassNames('text-main');

  return (
    <RefreshControl tintColor={color} colors={color == null ? undefined : [color]} {...props} />
  );
}
