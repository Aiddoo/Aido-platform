import { mmkvStorage } from '@src/shared/infra/storage/mmkv-storage';
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

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'aido_theme_mode';
const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system'];

function readSavedMode(): ThemeMode {
  const saved = mmkvStorage.getString(THEME_STORAGE_KEY);
  if (saved && VALID_MODES.includes(saved as ThemeMode)) {
    return saved as ThemeMode;
  }
  return 'system';
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(readSavedMode);

  const resolvedTheme: ResolvedTheme =
    mode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    mmkvStorage.set(THEME_STORAGE_KEY, newMode);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
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
