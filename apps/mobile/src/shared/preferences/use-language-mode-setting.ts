import { useTrack } from '@src/shared/analytics';
import { useLanguage } from '@src/shared/providers/language-provider';

import type { LanguageMode } from './language.preference';
import { languageModeSchema } from './schemas/language-mode-storage.schema';

interface LanguageModeSetting {
  languageMode: LanguageMode;
  /** 고른 값이 언어 모드가 아니면 무시한다. 바꾸면 settings_changed를 남긴다 */
  changeLanguageMode: (value: string) => void;
}

export function useLanguageModeSetting(): LanguageModeSetting {
  const { languageMode, setLanguageMode } = useLanguage();
  const { trackEvent } = useTrack();

  const changeLanguageMode = (value: string) => {
    const parsed = languageModeSchema.safeParse(value);
    if (!parsed.success) {
      return;
    }
    setLanguageMode(parsed.data);
    trackEvent('settings_changed', { setting: 'language', value: parsed.data });
  };

  return { languageMode, changeLanguageMode };
}
