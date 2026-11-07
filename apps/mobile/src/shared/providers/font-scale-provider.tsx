import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import {
  FONT_SCALE_STORAGE_KEY,
  type FontScale,
  toFontScale,
} from '@src/shared/preferences/font-scale.preference';
import type { TextSize } from '@src/shared/ui/text/text.types';
import { noop } from 'es-toolkit';
import { createContext, type PropsWithChildren, use, useCallback, useMemo } from 'react';

// t2↔t1 간 6px 점프를 피하기 위해 해당 구간은 리매핑하지 않음
// display(날씨 큰 온도)는 이미 충분히 커서 앱 글자 크기 설정과 무관하게 유지함
const SCALE_MAP: Record<Exclude<FontScale, 'medium'>, Record<TextSize, TextSize>> = {
  xsmall: {
    display: 'display',
    h1: 't1',
    t1: 't1',
    t2: 't3',
    t3: 'b1',
    b1: 'b3',
    b2: 'b4',
    b3: 'b4',
    b4: 'e1',
    e1: 'e2',
    e2: 'e2',
  },
  small: {
    display: 'display',
    h1: 't1',
    t1: 't1',
    t2: 't3',
    t3: 'b1',
    b1: 'b2',
    b2: 'b3',
    b3: 'b3',
    b4: 'b4',
    e1: 'e1',
    e2: 'e2',
  },
  large: {
    display: 'display',
    h1: 'h1',
    t1: 'h1',
    t2: 't2',
    t3: 't2',
    b1: 't3',
    b2: 'b1',
    b3: 'b2',
    b4: 'b3',
    e1: 'b4',
    e2: 'e1',
  },
  xlarge: {
    display: 'display',
    h1: 'h1',
    t1: 'h1',
    t2: 't2',
    t3: 't2',
    b1: 't3',
    b2: 't3',
    b3: 'b1',
    b4: 'b2',
    e1: 'b3',
    e2: 'b4',
  },
};

interface FontScaleContextValue {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  resolveSize: (size: TextSize) => TextSize;
}

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

interface FontScaleProviderProps extends PropsWithChildren {
  syncStorage?: ObservableSyncStorage;
}

export function FontScaleProvider({
  children,
  syncStorage = deviceSyncStorage,
}: FontScaleProviderProps) {
  const [savedScale, setFontScale] = useSyncStorageString(syncStorage, FONT_SCALE_STORAGE_KEY);
  const fontScale = toFontScale(savedScale);

  const resolveSize = useCallback(
    (size: TextSize): TextSize => {
      if (fontScale === 'medium') {
        return size;
      }
      return SCALE_MAP[fontScale][size];
    },
    [fontScale],
  );

  const value = useMemo(
    () => ({ fontScale, setFontScale, resolveSize }),
    [fontScale, setFontScale, resolveSize],
  );

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

// Text 컴포넌트 내부에서 호출되므로, Provider 없이도 안전하게 동작해야 함
// (useTheme과 다르게 — useTheme은 Text 내부에서 호출되지 않음)
const DEFAULT_CONTEXT: FontScaleContextValue = {
  fontScale: 'medium',
  setFontScale: noop,
  resolveSize: (size: TextSize) => size,
};

export function useFontScale(): FontScaleContextValue {
  const context = use(FontScaleContext);
  return context ?? DEFAULT_CONTEXT;
}
