import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import { themeModeStoredValue } from '@src/shared/preferences/schemas/theme-mode-storage.schema';
import type { ThemeMode } from '@src/shared/preferences/theme-mode.preference';
import { useStoredValueIn } from '@src/shared/storage/use-stored-value';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { createContext, type PropsWithChildren, use, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { match } from 'ts-pattern';
import { Uniwind, useResolveClassNames } from 'uniwind';

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

  // `useUniwind().theme`은 아래 effect의 `setTheme` 뒤에야 바뀌어 모드를 바꾼 렌더·첫 실행 렌더에 앞 값이다.
  // 내비게이션 테마·상태 바는 저장된 모드에서 같은 렌더에 바로 정한다(design.md 테마 값의 원천)
  const resolvedTheme = match<ThemeMode, ResolvedTheme>(mode)
    .with('system', () => (systemColorScheme === 'dark' ? 'dark' : 'light'))
    .with('light', 'dark', (explicitMode) => explicitMode)
    .exhaustive();

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  const { backgroundColor } = useResolveClassNames('bg-white');
  const baseTheme = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background:
        typeof backgroundColor === 'string' ? backgroundColor : baseTheme.colors.background,
    },
  };

  const value = { mode, resolvedTheme, setMode };

  return (
    <ThemeContext value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }

  return context;
}
