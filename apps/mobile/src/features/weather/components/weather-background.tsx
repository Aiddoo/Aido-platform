import { usePaneColumns } from '@src/shared/ui';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWeatherScene } from '../hooks/use-weather-scene';
import { WeatherSceneCanvas } from './weather-scene-canvas/weather-scene-canvas';

/** 해·달은 지명·기온이 놓인 단에 맞춘다. 넓은 화면은 왼쪽 단, iPhone Duo처럼 옆 레일이 있으면 레일을 뺀 영역이다. */
export function WeatherBackground() {
  const scene = useWeatherScene();
  const headerHeight = useHeaderHeight();
  const { isSplit, primaryWidth } = usePaneColumns();
  const insets = useSafeAreaInsets();
  const heroWidth = isSplit ? primaryWidth : primaryWidth - insets.left - insets.right;

  return (
    <WeatherSceneCanvas
      scene={scene}
      contentTop={headerHeight}
      heroLeft={insets.left}
      heroWidth={heroWidth}
    />
  );
}
