import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { PaneArea, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function FeedLayout() {
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });

  // 할 일 목록·상세 칸은 탭 사이드바를 뺀 폭으로 나눈다
  return (
    <PaneArea>
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
    </PaneArea>
  );
}
