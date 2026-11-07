import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { useSyncStorageString } from '@src/shared/hooks/use-sync-storage-string';
import { i18n } from '@src/shared/i18n';
import { useSystemLocale } from '@src/shared/infra/localization/device-locale';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import {
  LANGUAGE_MODE_STORAGE_KEY,
  type LanguageMode,
  toLanguageMode,
  type ResolvedLanguage,
  resolveLanguage,
} from '@src/shared/preferences/language.preference';
import { noop } from 'es-toolkit';
import { createContext, type PropsWithChildren, use, useEffect, useMemo } from 'react';

interface LanguageContextValue {
  languageMode: LanguageMode;
  resolvedLanguage: ResolvedLanguage;
  setLanguageMode: (mode: LanguageMode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function useSystemLanguage(): string | null {
  return useSystemLocale().languageCode;
}

interface LanguageProviderProps extends PropsWithChildren {
  syncStorage?: ObservableSyncStorage;
  /** 기기 언어 코드. 기기 언어 설정이 실행 중에 바뀌면 다시 렌더링해 새 값을 돌려준다. */
  useDeviceLanguage?: () => string | null;
}

export function LanguageProvider({
  children,
  syncStorage = deviceSyncStorage,
  useDeviceLanguage = useSystemLanguage,
}: LanguageProviderProps) {
  const [savedMode, setLanguageMode] = useSyncStorageString(syncStorage, LANGUAGE_MODE_STORAGE_KEY);
  const languageMode = toLanguageMode(savedMode);
  const deviceLanguage = useDeviceLanguage();

  const resolvedLanguage = useMemo(
    () => resolveLanguage(languageMode, deviceLanguage),
    [languageMode, deviceLanguage],
  );

  // 단방향 동기화: resolvedLanguage(단일 소스)가 바뀔 때만 i18n에 반영한다.
  // languageChanged 이벤트가 react-i18next 리렌더를 처리한다.
  useEffect(() => {
    if (i18n.language !== resolvedLanguage) {
      i18n.changeLanguage(resolvedLanguage);
    }
  }, [resolvedLanguage]);

  const value = useMemo(
    () => ({ languageMode, resolvedLanguage, setLanguageMode }),
    [languageMode, resolvedLanguage, setLanguageMode],
  );

  return <LanguageContext value={value}>{children}</LanguageContext>;
}

// Provider 없이도 안전하게 동작해야 함 (테스트, 부분 렌더 환경)
const DEFAULT_CONTEXT: LanguageContextValue = {
  languageMode: 'system',
  resolvedLanguage: 'ko',
  setLanguageMode: noop,
};

export function useLanguage(): LanguageContextValue {
  const context = use(LanguageContext);
  return context ?? DEFAULT_CONTEXT;
}
