import { MyPageMenuPane } from '@src/bootstrap/navigation/my-page-menu-pane';
import { NotificationBellToolbar } from '@src/features/notification/components/notification-bell-toolbar';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { AdaptivePane } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function MyPageMenuLayout() {
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <>
      {/* 넓은 화면은 내 정보 탭과 같은 헤더(종)를 두 칸 위에 둬 왼쪽 메뉴가 같은 자리에 머문다 */}
      {!isCompact && <NotificationBellToolbar />}
      <AdaptivePane
        primary={<MyPageMenuPane />}
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
    </>
  );
}
