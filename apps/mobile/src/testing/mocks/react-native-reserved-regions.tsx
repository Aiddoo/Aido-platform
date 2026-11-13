import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

/** react-native-reserved-regions는 jest mock을 주지 않는다. 접힘선·occlusion이 없는 일반 기기로 둔다. */
export function ReservedRegionsProvider({ children, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props}>{children}</View>;
}

export function ReservedRegionsGate({ children }: PropsWithChildren) {
  return children;
}

export function useReservedRegions() {
  return [];
}

export function useReservedRegionsReady() {
  return true;
}
