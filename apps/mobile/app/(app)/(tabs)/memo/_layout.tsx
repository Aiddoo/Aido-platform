import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const indexScreenOptions = useStackScreenOptions({ background: 'bg-white', fillContent: true });
  const bg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg.backgroundColor },
        animation: 'fade',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="index" options={{ ...indexScreenOptions, title: '' }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.View hidesSharedBackground>
            <WeatherForecastBadge />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
