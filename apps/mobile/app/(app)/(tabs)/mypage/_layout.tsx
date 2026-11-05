import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MyPageLayout() {
  const screenOptions = useStackScreenOptions();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <Stack screenOptions={{ ...screenOptions, title: '' }}>
      {/* 넓은 화면은 왼쪽 메뉴가 메뉴 화면과 같은 자리에 머물도록 pane이 종을 그린다 */}
      <Stack.Screen name="index" options={{ headerShown: isCompact }} />
    </Stack>
  );
}
