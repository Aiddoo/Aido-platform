import { Stack } from 'expo-router';
import QueryProvider from '@/core/providers/query-provider';

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: '홈' }} />
      </Stack>
    </QueryProvider>
  );
}
