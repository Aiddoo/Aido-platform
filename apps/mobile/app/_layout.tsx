import { HttpClientProvider } from '@src/core/providers';
import QueryProvider from '@src/core/providers/query-provider';
import {
  AuthProvider,
  useAuthClient,
} from '@src/features/auth/presentations/contexts/auth.context';
import { useGetMeQueryOptions } from '@src/features/auth/presentations/hooks';
import { useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { type Href, Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  const authClient = useAuthClient();
  const { data: user, isPending } = useQuery(useGetMeQueryOptions(authClient));
  const isAuthenticated = !!user;
  const segments = useSegments();
  const router = useRouter();

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
    'WantedSans-Regular': require('../assets/fonts/WantedSans-Regular.ttf'),
    'WantedSans-Medium': require('../assets/fonts/WantedSans-Medium.ttf'),
    'WantedSans-SemiBold': require('../assets/fonts/WantedSans-SemiBold.ttf'),
    'WantedSans-Bold': require('../assets/fonts/WantedSans-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView className="flex-1">
      <QueryProvider>
        <HttpClientProvider>
          <AuthProvider>
            <HeroUINativeProvider>
              <RootLayoutNav />
            </HeroUINativeProvider>
          </AuthProvider>
        </HttpClientProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
