import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider, useAuth } from '@src/bootstrap/providers/auth-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { RevenueCatProvider } from '@src/bootstrap/providers/revenuecat-provider';
import { useScreenTracking } from '@src/shared/hooks/use-screen-tracking';
import { useUserIdentity } from '@src/shared/hooks/use-user-identity';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import { OverlayProvider } from '@src/shared/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useResolveClassNames } from 'uniwind';
import '../global.css';
import '@src/shared/i18n/init';
import * as Sentry from '@sentry/react-native';
import { initSentry } from '@src/shared/infra/observability/sentry';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';

initSentry();

SplashScreen.preventAutoHideAsync();

const AuthGateLayout = () => {
  const { status } = useAuth();
  useScreenTracking();
  useUserIdentity();
  const { backgroundColor } = useResolveClassNames('bg-white');
  const isAuthenticated = status === 'authenticated';
  // `locked`(키체인 잠김)는 미인증이 아니라 "아직 모름"이다 — 로그인 화면으로 내려보내지 않는다.
  const isLoading = status === 'loading' || status === 'locked';

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
        <FontScaleProvider>
          <LanguageProvider>
            <ThemeProvider>
              <HeroUIProvider>
                <QueryProvider>
                  <DIProvider>
                    <LocalDateProvider>
                      <AuthProvider>
                        <RevenueCatProvider>
                          <NotificationProvider>
                            <BottomSheetModalProvider>
                              <OverlayProvider>
                                <AuthGateLayout />
                              </OverlayProvider>
                            </BottomSheetModalProvider>
                          </NotificationProvider>
                        </RevenueCatProvider>
                      </AuthProvider>
                    </LocalDateProvider>
                  </DIProvider>
                </QueryProvider>
              </HeroUIProvider>
            </ThemeProvider>
          </LanguageProvider>
        </FontScaleProvider>
      </KeyboardProvider>
    </GestureHandlerProvider>
  );
};

export default Sentry.wrap(AppBootstrapLayout);
