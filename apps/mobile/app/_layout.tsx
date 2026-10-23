import * as Sentry from '@sentry/react-native';
import { useAppFonts } from '@src/bootstrap/hooks/use-app-fonts';
import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { AppProviders } from '@src/bootstrap/providers/app-providers';
import { initSentry } from '@src/shared/infra/observability/sentry';

import '../global.css';
import '@src/shared/i18n/init';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

initSentry();

SplashScreen.preventAutoHideAsync();

const AppBootstrapLayout = () => {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <AuthGateLayout />
    </AppProviders>
  );
};

export default Sentry.wrap(AppBootstrapLayout);
