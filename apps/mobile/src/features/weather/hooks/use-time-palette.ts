import { useTheme } from '@src/shared/providers/theme-provider';
import { createContext, useContext } from 'react';

import { useWeatherSession } from '../components/providers/weather-session-provider';
import {
  getWeatherPalette,
  TIME_PALETTES,
  type TimePalette,
} from '../utils/view-models/weather-palette.view-model';

export const TimePaletteContext = createContext<TimePalette>(TIME_PALETTES.night);
export function useTimePalette(): TimePalette {
  return useContext(TimePaletteContext);
}

/** 날씨 세션의 기기 시각과 현재 테마로 팔레트를 고른다. Provider 밖의 헤더도 같은 값을 쓴다. */
export function useWeatherSessionPalette(): TimePalette {
  const { resolvedTheme } = useTheme();
  const { clock } = useWeatherSession();
  return getWeatherPalette(clock.deviceHour, resolvedTheme);
}
