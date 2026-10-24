import * as Sentry from '@sentry/react-native';
import { useAppFonts } from '@src/bootstrap/hooks/use-app-fonts';
import { useDraftStorageBootstrap } from '@src/bootstrap/hooks/use-draft-storage-bootstrap';
import { AuthGateLayout } from '@src/bootstrap/navigation/auth-gate-layout';
import { AppProviders } from '@src/bootstrap/providers/app-providers';
import { initSentry } from '@src/shared/infra/observability/sentry';

import '../global.css';
import '@src/shared/i18n/init';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

initSentry();

SplashScreen.preventAutoHideAsync();

function AppBootstrapLayout() {
  const fontsLoaded = useAppFonts();
  const draftStorageBootstrap = useDraftStorageBootstrap();
  const isReady = fontsLoaded && draftStorageBootstrap !== undefined;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <AppProviders draftStorageBootstrap={draftStorageBootstrap}>
      <AuthGateLayout />
    </AppProviders>
  );
}

export default Sentry.wrap(AppBootstrapLayout);
