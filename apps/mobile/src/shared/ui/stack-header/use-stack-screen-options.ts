import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { getScaledFontSize } from '@src/shared/utils/scaled-font-style';
import type { NativeStackNavigationOptions } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

interface UseStackScreenOptionsParams {
  hasContentBackground?: boolean;
}

/** 네이티브 Stack 헤더의 공통 screenOptions. 버튼·제목 배치는 iOS(iPhone Duo 레일 포함)에 맡긴다. */
export function useStackScreenOptions({
  hasContentBackground = false,
}: UseStackScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { backgroundColor } = useResolveClassNames('bg-white');
  const { color, fontFamily } = useResolveClassNames('font-bold text-gray-9');
  const { fontScale } = useFontScale();
  const tintColor = typeof color === 'string' ? color : undefined;

  return {
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor },
    headerTintColor: tintColor,
    headerTitleAlign: 'center',
    headerTitleStyle: { fontFamily, fontSize: getScaledFontSize(fontScale), color: tintColor },
    headerBackButtonDisplayMode: 'minimal',
    ...(hasContentBackground && { contentStyle: { backgroundColor } }),
  };
}
