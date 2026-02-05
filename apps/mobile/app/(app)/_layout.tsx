import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useResolveClassNames } from 'uniwind';

const AppLayout = () => {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'slide_from_bottom',
        animationTypeForReplace: 'push',
        contentStyle: { backgroundColor: backgroundColor as string },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="todos" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="webview/[url]" />
    </Stack>
  );
};

export default AppLayout;
