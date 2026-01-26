import { AuthProvider, useAuth } from '@src/bootstrap/providers/auth-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const FullScreenLoader = () => {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
    </View>
  );
};

const AuthGateLayout = () => {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 250,
        animationTypeForReplace: 'pop',
      }}
    >
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
};

const AppBootstrapLayout = () => {
  const [fontsLoaded] = useFonts({
    'WantedSans-Regular': require('@assets/fonts/WantedSans-Regular.ttf'),
    'WantedSans-Medium': require('@assets/fonts/WantedSans-Medium.ttf'),
    'WantedSans-SemiBold': require('@assets/fonts/WantedSans-SemiBold.ttf'),
    'WantedSans-Bold': require('@assets/fonts/WantedSans-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerProvider>
      <HeroUIProvider>
        <QueryProvider>
          <DIProvider>
            <AuthProvider>
              <AuthGateLayout />
            </AuthProvider>
          </DIProvider>
        </QueryProvider>
      </HeroUIProvider>
    </GestureHandlerProvider>
  );
};

export default AppBootstrapLayout;
