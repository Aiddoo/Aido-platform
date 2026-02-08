import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function FeedLayout() {
  const headerBg = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: '',
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerRight: () => <NotificationBell.Header />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
