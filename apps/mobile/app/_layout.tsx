import { AppProviders } from '@src/core/di/app-providers';
import { useGetMe } from '@src/features/auth/presentation/hooks/use-get-me';
import { useFonts } from 'expo-font';
import { type Href, Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import '../global.css';

SplashScreen.preventAutoHideAsync();

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
    </View>
  );
}

function RootLayoutNav() {
  const { data: user, isPending } = useGetMe();
  const isAuthenticated = !!user;
  const segments = useSegments();
  const router = useRouter();

  // TODO: 인증 관련 처리 재설계 필요.
  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login' as Href);
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)/home' as Href);
    }
  }, [isAuthenticated, isPending, segments, router]);

  if (isPending) {
    return <LoadingScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'WantedSans-Regular': require('@assets/fonts/WantedSans-Regular.ttf'),
    'WantedSans-Medium': require('@assets/fonts/WantedSans-Medium.ttf'),
    'WantedSans-SemiBold': require('@assets/fonts/WantedSans-SemiBold.ttf'),
    'WantedSans-Bold': require('@assets/fonts/WantedSans-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AppProviders>
      <RootLayoutNav />
    </AppProviders>
  );
}
