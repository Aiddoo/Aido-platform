import { useTrack } from '@src/shared/analytics';
import { useFontScale } from '@src/shared/providers/font-scale-provider';

import type { FontScale } from './font-scale.preference';
import { fontScaleSchema } from './schemas/font-scale-storage.schema';

interface FontScaleSetting {
  fontScale: FontScale;
  /** 고른 값이 글꼴 크기가 아니면 무시한다. 바꾸면 settings_changed를 남긴다 */
  changeFontScale: (value: string) => void;
}

export function useFontScaleSetting(): FontScaleSetting {
  const { fontScale, setFontScale } = useFontScale();
  const { trackEvent } = useTrack();

  const changeFontScale = (value: string) => {
    const parsed = fontScaleSchema.safeParse(value);
    if (!parsed.success) {
      return;
    }
    setFontScale(parsed.data);
    trackEvent('settings_changed', { setting: 'font_scale', value: parsed.data });
  };

  return { fontScale, changeFontScale };
}
