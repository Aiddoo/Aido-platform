import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import { themeModeStoredValue } from '@src/shared/preferences/schemas/theme-mode-storage.schema';
import type { ThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useStoredValueIn } from '@src/shared/storage/use-stored-value';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { createContext, type PropsWithChildren, use, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { match } from 'ts-pattern';
import { Uniwind, useResolveClassNames } from 'uniwind';

export type { ThemeMode };
type ResolvedTheme = 'light' | 'dark';

interface ThemeProviderProps extends PropsWithChildren {
  syncStorage?: ObservableSyncStorage;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, syncStorage = deviceSyncStorage }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useStoredValueIn(syncStorage, themeModeStoredValue);

  const resolvedTheme = match<ThemeMode, ResolvedTheme>(mode)
    .with('system', () => (systemColorScheme === 'dark' ? 'dark' : 'light'))
    .with('light', 'dark', (explicitMode) => explicitMode)
    .exhaustive();

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  const { backgroundColor } = useResolveClassNames('bg-white');
  const navigationTheme = useMemo(() => {
    const baseTheme = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background:
          typeof backgroundColor === 'string' ? backgroundColor : baseTheme.colors.background,
      },
    };
  }, [resolvedTheme, backgroundColor]);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme, setMode]);

  return (
    <ThemeContext value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
