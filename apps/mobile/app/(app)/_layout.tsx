import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

const AppLayout = () => {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
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
