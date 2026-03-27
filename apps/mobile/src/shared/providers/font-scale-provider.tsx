import type { SyncStorage } from '@src/core/ports/sync-storage';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  type FontScale,
  readFontScale,
  writeFontScale,
} from '@src/shared/preferences/font-scale.preference';
import type { TextSize } from '@src/shared/ui/Text/Text.types';
import { createContext, type PropsWithChildren, use, useCallback, useState } from 'react';

export type { FontScale };

// t2↔t1 간 6px 점프를 피하기 위해 해당 구간은 리매핑하지 않음
const SCALE_MAP: Record<Exclude<FontScale, 'medium'>, Record<TextSize, TextSize>> = {
  xsmall: {
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
  syncStorage?: SyncStorage;
}

export const FontScaleProvider = ({
  children,
  syncStorage = mmkvSyncStorage,
}: FontScaleProviderProps) => {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => readFontScale(syncStorage));

  const persistScale = useCallback(
    (newScale: FontScale) => {
      setFontScaleState(newScale);
      writeFontScale(syncStorage, newScale);
    },
    [syncStorage],
  );

  const resolveSize = useCallback(
    (size: TextSize): TextSize => {
      if (fontScale === 'medium') return size;
      return SCALE_MAP[fontScale][size];
    },
    [fontScale],
  );

  return (
    <FontScaleContext.Provider value={{ fontScale, setFontScale: persistScale, resolveSize }}>
      {children}
    </FontScaleContext.Provider>
  );
};

export const useFontScale = (): FontScaleContextValue => {
  const context = use(FontScaleContext);

  if (!context) {
    throw new Error('useFontScale must be used within FontScaleProvider');
  }

  return context;
};
