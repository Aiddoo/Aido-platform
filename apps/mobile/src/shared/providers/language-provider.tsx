import type { SyncStorage } from '@src/core/ports/sync-storage';
import { getDeviceLanguage, i18n } from '@src/shared/i18n';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import {
  type LanguageMode,
  type ResolvedLanguage,
  readLanguageMode,
  resolveLanguage,
  writeLanguageMode,
} from '@src/shared/preferences/language.preference';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface LanguageContextValue {
  languageMode: LanguageMode;
  resolvedLanguage: ResolvedLanguage;
  setLanguageMode: (mode: LanguageMode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps extends PropsWithChildren {
  syncStorage?: SyncStorage;
  deviceLanguage?: () => string | null;
}

export const LanguageProvider = ({
  children,
  syncStorage = mmkvSyncStorage,
  deviceLanguage = getDeviceLanguage,
}: LanguageProviderProps) => {
  const [languageMode, setLanguageModeState] = useState<LanguageMode>(() =>
    readLanguageMode(syncStorage),
  );

  const resolvedLanguage = useMemo(
    () => resolveLanguage(languageMode, deviceLanguage()),
    [languageMode, deviceLanguage],
  );

  // 단방향 동기화: resolvedLanguage(단일 소스)가 바뀔 때만 i18n에 반영한다.
  // languageChanged 이벤트가 react-i18next 리렌더와 dayjs locale 동기화를 처리한다.
  useEffect(() => {
    if (i18n.language !== resolvedLanguage) {
      void i18n.changeLanguage(resolvedLanguage);
    }
  }, [resolvedLanguage]);

  const persistMode = useCallback(
    (newMode: LanguageMode) => {
      setLanguageModeState(newMode);
      writeLanguageMode(syncStorage, newMode);
    },
    [syncStorage],
  );

  const value = useMemo(
    () => ({ languageMode, resolvedLanguage, setLanguageMode: persistMode }),
    [languageMode, resolvedLanguage, persistMode],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// Provider 없이도 안전하게 동작해야 함 (테스트, 부분 렌더 환경)
const DEFAULT_CONTEXT: LanguageContextValue = {
  languageMode: 'system',
  resolvedLanguage: 'ko',
  setLanguageMode: () => {},
};

export const useLanguage = (): LanguageContextValue => {
  const context = use(LanguageContext);
  return context ?? DEFAULT_CONTEXT;
};
