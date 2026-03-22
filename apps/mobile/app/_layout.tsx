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
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useResolveClassNames } from 'uniwind';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const AuthGateLayout = () => {
  const { status } = useAuth();

  useScreenTracking();
  useUserIdentity();

  const { backgroundColor } = useResolveClassNames('bg-white');
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  // Stack을 항상 렌더링하여 expo-router의 navigationRef가 즉시 ready 상태가 되도록 함.
  // 이를 통해 cold start 시 push notification 탭으로 인한
  // "Attempted to navigate before mounting the Root Layout" 크래시를 방지.
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
      <Stack.Protected guard={isLoading}>
        <Stack.Screen name="loading" options={{ animation: 'none' }} />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated && !isLoading}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated && !isLoading}>
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Screen name="invite/[userTag]" options={{ animation: 'none' }} />
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
