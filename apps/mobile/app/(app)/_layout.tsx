import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'slide_from_bottom',
        animationTypeForReplace: 'push',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="friend-management" />
    </Stack>
  );
}
