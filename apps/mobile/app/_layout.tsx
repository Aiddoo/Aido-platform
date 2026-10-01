import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { AuthProvider } from '@src/bootstrap/providers/auth-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { RevenueCatProvider } from '@src/bootstrap/providers/revenuecat-provider';
import { initSentry } from '@src/shared/infra/observability/sentry';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import { OverlayProvider, QueryErrorBoundary } from '@src/shared/ui';
import { useFonts } from 'expo-font';

import '../global.css';
import '@src/shared/i18n/init';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

initSentry();

SplashScreen.preventAutoHideAsync();

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
                              <QueryErrorBoundary>
                                <OverlayProvider>
                                  <AuthGateLayout />
                                </OverlayProvider>
                              </QueryErrorBoundary>
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
