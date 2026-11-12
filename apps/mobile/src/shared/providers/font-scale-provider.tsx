import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import type { FontScale } from '@src/shared/preferences/font-scale.preference';
import { fontScaleStoredValue } from '@src/shared/preferences/schemas/font-scale-storage.schema';
import { useStoredValueIn } from '@src/shared/storage/use-stored-value';
import type { TextSize } from '@src/shared/ui';
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
  const [fontScale, setFontScale] = useStoredValueIn(syncStorage, fontScaleStoredValue);

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

  return <FontScaleContext value={value}>{children}</FontScaleContext>;
}

// Text 내부에서 호출되므로 Provider 없이도 안전해야 한다
const DEFAULT_CONTEXT: FontScaleContextValue = {
  fontScale: 'medium',
  setFontScale: noop,
  resolveSize: (size: TextSize) => size,
};

export function useFontScale(): FontScaleContextValue {
  const context = use(FontScaleContext);
  return context ?? DEFAULT_CONTEXT;
}
