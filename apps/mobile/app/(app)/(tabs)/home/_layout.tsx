import { NotificationBell } from '@src/features/notification/presentations/components/notification-bell';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function HomeLayout() {
  const headerBg = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor as string },
        headerTitle: '',
        headerRight: () => <NotificationBell.Header />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
