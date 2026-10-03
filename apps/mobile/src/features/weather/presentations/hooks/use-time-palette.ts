import { createContext, useContext } from 'react';

import { TIME_PALETTES, type TimePalette } from '../view-models/weather-palette.view-model';

export const TimePaletteContext = createContext<TimePalette>(TIME_PALETTES.night);
export function useTimePalette(): TimePalette {
  return useContext(TimePaletteContext);
}
