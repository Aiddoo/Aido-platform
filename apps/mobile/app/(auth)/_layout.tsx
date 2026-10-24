import { ANIMATION } from '@src/shared/constants/animation.constants';
import { ScreenTitleBar } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useResolveClassNames } from 'uniwind';

function AuthLayout() {
  const { backgroundColor } = useResolveClassNames('bg-white');
  const headerBg = useResolveClassNames('bg-background');

  return (
    <Stack
      screenOptions={{
        header: (props) => <ScreenTitleBar.StackHeader {...props} />,
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
        animationDuration: ANIMATION.duration.normal,
        contentStyle: { backgroundColor },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: headerBg.backgroundColor },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="email-login" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="sign-up" options={{ headerShown: true }} />
      <Stack.Screen name="verify-email" options={{ headerShown: true }} />
    </Stack>
  );
}

export default AuthLayout;
