import { Stack } from 'expo-router';
import { Platform } from 'react-native';

const AuthLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="email-login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
};

export default AuthLayout;
