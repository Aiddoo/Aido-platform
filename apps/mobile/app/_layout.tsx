import { AuthProvider, useAuth } from '@src/bootstrap/providers/auth-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { RevenueCatProvider } from '@src/bootstrap/providers/revenuecat-provider';
import { useScreenTracking } from '@src/shared/hooks/use-screen-tracking';
import { useUserIdentity } from '@src/shared/hooks/use-user-identity';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import { OverlayProvider } from '@src/shared/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useResolveClassNames } from 'uniwind';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const FullScreenLoader = () => {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
    </View>
  );
};

const AuthGateLayout = () => {
  const { status } = useAuth();
  useScreenTracking();
  useUserIdentity();
  const { backgroundColor } = useResolveClassNames('bg-white');
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
        contentStyle: { backgroundColor: backgroundColor as string },
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
      <KeyboardProvider>
        <HeroUIProvider>
          <ThemeProvider>
            <QueryProvider>
              <DIProvider>
                <AuthProvider>
                  <RevenueCatProvider>
                    <NotificationProvider>
                      <OverlayProvider>
                        <AuthGateLayout />
                      </OverlayProvider>
                    </NotificationProvider>
                  </RevenueCatProvider>
                </AuthProvider>
              </DIProvider>
            </QueryProvider>
          </ThemeProvider>
        </HeroUIProvider>
      </KeyboardProvider>
    </GestureHandlerProvider>
  );
};

export default AppBootstrapLayout;
