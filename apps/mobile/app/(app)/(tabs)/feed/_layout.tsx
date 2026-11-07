import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function FeedLayout() {
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        title: '',
      }}
    >
      <Stack.Screen name="index">
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.View hidesSharedBackground>
            <WeatherForecastBadge />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
