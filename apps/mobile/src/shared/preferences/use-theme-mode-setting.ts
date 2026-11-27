import { useTrack } from '@src/shared/analytics';
import { useAppTheme } from '@src/shared/providers/theme-provider';

import { themeModeSchema } from './schemas/theme-mode-storage.schema';
import type { ThemeMode } from './theme-mode.preference';

interface ThemeModeSetting {
  mode: ThemeMode;
  /** 고른 값이 화면 모드가 아니면 무시한다. 바꾸면 settings_changed를 남긴다 */
  changeMode: (value: string) => void;
}

export function useThemeModeSetting(): ThemeModeSetting {
  const { mode, setMode } = useAppTheme();
  const { trackEvent } = useTrack();

  const changeMode = (value: string) => {
    const parsed = themeModeSchema.safeParse(value);
    if (!parsed.success) {
      return;
    }
    setMode(parsed.data);
    trackEvent('settings_changed', { setting: 'theme', value: parsed.data });
  };

  return { mode, changeMode };
}
