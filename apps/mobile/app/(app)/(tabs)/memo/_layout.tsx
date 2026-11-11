import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { ANIMATION } from '@src/shared/constants/animation';
import { PaneArea, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

export default function MemoLayout() {
  const indexScreenOptions = useStackScreenOptions({ hasContentBackground: true });
  const { backgroundColor } = useResolveClassNames('bg-white');

  // 메모 목록·상세 칸은 탭 사이드바를 뺀 폭으로 나눈다
  return (
    <PaneArea>
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
    </PaneArea>
  );
}
