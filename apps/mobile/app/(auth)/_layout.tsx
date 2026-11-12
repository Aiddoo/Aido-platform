import { ANIMATION } from '@src/shared/constants/animation';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

function AuthLayout() {
  const screenOptions = useStackScreenOptions();
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        title: '',
        animation: process.env.EXPO_OS === 'ios' ? 'default' : 'fade_from_bottom',
        animationDuration: ANIMATION.durationMs.normal,
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="email-login" options={{ headerShown: true }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: true }} />
      <Stack.Screen name="sign-up" options={{ headerShown: true }} />
      <Stack.Screen name="verify-email" options={{ headerShown: true }} />
    </Stack>
  );
}

export default AuthLayout;
