import * as Sentry from '@sentry/react-native';
import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { AppProviders } from '@src/bootstrap/providers/app-providers';
import { initSentry } from '@src/shared/infra/observability/sentry';
import { useFonts } from 'expo-font';

import '../global.css';
import '@src/shared/i18n/init';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

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
    <AppProviders>
      <AuthGateLayout />
    </AppProviders>
  );
};

export default Sentry.wrap(AppBootstrapLayout);
