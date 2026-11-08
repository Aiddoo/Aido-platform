import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { getPrimaryPaneWidth } from '@src/shared/ui';
import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useWindowDimensions } from 'react-native';
import { useReservedRegions } from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWeatherScene } from '../hooks/use-weather-scene';
import { WeatherSceneCanvas } from './weather-scene/weather-scene-canvas';

/** 해·달은 지명·기온이 놓인 단에 맞춘다. 넓은 화면은 왼쪽 단, iPhone Duo처럼 옆 레일이 있으면 레일을 뺀 영역이다. */
export function WeatherBackground() {
  const windowSizeClass = useWindowSizeClass();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fold = findVerticalFold(useReservedRegions());
  const heroWidth =
    windowSizeClass === 'compact'
      ? width - insets.left - insets.right
      : getPrimaryPaneWidth({ windowSizeClass, foldFrame: fold?.frame });
  return (
    <WeatherSceneCanvas
      scene={useWeatherScene()}
      contentTop={useHeaderHeight()}
      heroLeft={insets.left}
      heroWidth={heroWidth}
    />
  );
}
