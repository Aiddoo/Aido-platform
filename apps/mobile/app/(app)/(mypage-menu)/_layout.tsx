import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { AdaptivePane } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MyPageMenuLayout() {
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <AdaptivePane
      primary={<MyPageMenuPane isSplit />}
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
