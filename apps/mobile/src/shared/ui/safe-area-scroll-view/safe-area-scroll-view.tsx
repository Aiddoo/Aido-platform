import type { ComponentPropsWithRef } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSafeAreaPadding } from './get-safe-area-padding';

const CONTENT_EDGES = ['left', 'right', 'bottom'] as const;

/**
 * 스크롤바와 배경은 칸 끝까지 두고 내용만 가로·아래 inset을 피하는 ScrollView.
 * 가장 가까운 `SafeAreaInsetsContext` 값을 읽어 마이 탭 칸처럼 context로만 inset을 넘기는 곳에서도 맞다
 */
export function SafeAreaScrollView({
  contentContainerStyle,
  ...props
}: ComponentPropsWithRef<typeof ScrollView>) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      contentContainerStyle={[getSafeAreaPadding(insets, CONTENT_EDGES), contentContainerStyle]}
      {...props}
    />
  );
}
