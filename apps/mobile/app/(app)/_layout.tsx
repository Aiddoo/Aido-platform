import { useTheme } from '@src/shared/providers/theme-provider';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

const THEME_COLORS = {
  light: '#ffffff',
  dark: '#262626',
} as const;

const AppLayout = () => {
  const { resolvedTheme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'slide_from_bottom',
        animationTypeForReplace: 'push',
        contentStyle: { backgroundColor: THEME_COLORS[resolvedTheme] },
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
