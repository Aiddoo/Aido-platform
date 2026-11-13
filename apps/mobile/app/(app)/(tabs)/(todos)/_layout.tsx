import { WeatherForecastBadge } from '@src/features/weather/components/weather-forecast-badge';
import { PaneArea, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

// 이 탭 Stack에 함께 쓰는 화면을 바로 열어도 아래에 할 일 목록이 깔려 뒤로 가면 할 일 목록이다
export const unstable_settings = {
  anchor: 'feed/index',
};

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
        <Stack.Screen name="feed/index">
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
