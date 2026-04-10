import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
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
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind, useResolveClassNames } from 'uniwind';

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

  const { backgroundColor } = useResolveClassNames('bg-white');
  const navigationTheme = useMemo(() => {
    const baseTheme = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: backgroundColor as string,
      },
    };
  }, [resolvedTheme, backgroundColor]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode: persistMode }}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
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
