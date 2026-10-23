import { useFonts } from 'expo-font';

// expo-font config plugin은 네이티브에만 폰트를 임베드하므로 웹은 런타임에 로드한다.
export function useAppFonts(): boolean {
  const [fontsLoaded] = useFonts({
    'WantedSans-Regular': require('@assets/fonts/WantedSans-Regular.ttf'),
    'WantedSans-Medium': require('@assets/fonts/WantedSans-Medium.ttf'),
    'WantedSans-SemiBold': require('@assets/fonts/WantedSans-SemiBold.ttf'),
    'WantedSans-Bold': require('@assets/fonts/WantedSans-Bold.ttf'),
  });

  return fontsLoaded;
}
