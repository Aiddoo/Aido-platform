import type { NativeStackHeaderProps, NativeStackNavigationOptions } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

import { ScreenTitleBar } from './screen-title-bar';

interface UseStackScreenOptionsParams {
  background?: 'bg-gray-1' | 'bg-white';
  fillContent?: boolean;
}

/** `ScreenTitleBar.StackHeader`를 쓰는 Stack 레이아웃의 공통 screenOptions. */
export function useStackScreenOptions({
  background = 'bg-gray-1',
  fillContent = false,
}: UseStackScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { backgroundColor } = useResolveClassNames(background);

  return {
    header: (props: NativeStackHeaderProps) => <ScreenTitleBar.StackHeader {...props} />,
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor },
    ...(fillContent && { contentStyle: { backgroundColor } }),
  };
}
