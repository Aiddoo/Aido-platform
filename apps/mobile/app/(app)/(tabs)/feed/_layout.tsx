import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function FeedLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white' });
  const indexBg = useResolveClassNames('bg-white');
  const stackBg = useResolveClassNames('bg-gray-1');

  return (
    <Stack
      screenOptions={{
        ...screenOptions,
        title: '',
        contentStyle: { backgroundColor: stackBg.backgroundColor },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ contentStyle: { backgroundColor: indexBg.backgroundColor } }}
      >
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.View hidesSharedBackground>
            <WeatherForecastBadge />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
