import type { ComponentProps } from 'react';
import { RefreshControl } from 'react-native';

export function TintedRefreshControl(props: ComponentProps<typeof RefreshControl>) {
  return (
    <RefreshControl tintColorClassName="accent-main" colorsClassName="accent-main" {...props} />
  );
}
