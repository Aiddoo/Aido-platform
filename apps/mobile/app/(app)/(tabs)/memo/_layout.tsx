import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { ANIMATION } from '@src/shared/constants/animation';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const indexScreenOptions = useStackScreenOptions({ hasContentBackground: true });
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor },
        animation: 'fade',
        animationDuration: ANIMATION.duration.normal,
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
