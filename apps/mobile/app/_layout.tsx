import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // 폰트 파일명과 동일하게 등록
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: '홈' }} />
        </Stack>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
