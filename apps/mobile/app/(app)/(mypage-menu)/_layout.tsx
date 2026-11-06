import { MyPagePane } from '@src/features/user/components/mypage-pane/mypage-pane';
import { MyPagePaneLayout } from '@src/features/user/components/mypage-pane/mypage-pane-layout';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { AdaptivePane } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MyPageMenuLayout() {
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <AdaptivePane
      primary={
        <MyPagePaneLayout isSplit>
          <MyPagePane />
        </MyPagePaneLayout>
      }
      secondary={
        <Stack
          screenOptions={{
            headerShown: false,
            animation: isCompact ? 'slide_from_right' : 'none',
          }}
        >
          <Stack.Screen name="settings" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="reports" />
        </Stack>
      }
      compactPane="secondary"
    />
  );
}
