import type { SyncStorage } from '@src/core/ports/sync-storage';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  readThemeMode,
  type ThemeMode,
  writeThemeMode,
} from '@src/shared/preferences/theme-mode.preference';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';

export type { ThemeMode };
export type ResolvedTheme = 'light' | 'dark';

interface ThemeProviderProps extends PropsWithChildren {
  syncStorage?: SyncStorage;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children, syncStorage = mmkvSyncStorage }: ThemeProviderProps) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode(syncStorage));

  const resolvedTheme: ResolvedTheme =
    mode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  const persistMode = useCallback(
    (newMode: ThemeMode) => {
      setMode(newMode);
      writeThemeMode(syncStorage, newMode);
    },
    [syncStorage],
  );

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode: persistMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
};
