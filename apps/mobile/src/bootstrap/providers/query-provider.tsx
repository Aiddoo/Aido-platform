import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { i18n } from '@src/shared/i18n';
import { getAppBundleId } from '@src/shared/infra/application/app-bundle';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import { useLanguage } from '@src/shared/providers/language-provider';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type PropsWithChildren, useEffect, useState } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

import { PERSISTED_QUERY_SCHEMAS } from '../query/persisted-query-schemas';
import {
  createQueryCacheBuster,
  createQueryPersistOptions,
  type QueryCacheStorage,
  removePlaintextQueryCache,
} from '../query/query-cache-persistence';
import { shouldRetryQuery } from '../query/query-retry';

/** RN에는 `visibilitychange`가 없어 `AppState`를 `focusManager`에 수동 연동한다 */
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    handleFocus(status === 'active');
  });
  return () => subscription.remove();
});

const MIN_STALE_TIME = 5 * MINUTE_MS;
const MIN_GC_TIME = 6 * MINUTE_MS;
/** 재시도 백오프 상한. 죽은 서버를 과하게 두드리지 않는다 */
const MAX_RETRY_DELAY = 5 * SECOND_MS;

/** 상한 지수 백오프(1s → 2s → 4s → 5s…). `shouldRetryQuery`의 일시 장애 6회와 합치면 재시도 창이 약 22초라 서버 재시작(5-10초)을 덮어 재시도 화면 대신 로딩을 유지한다 */
function retryDelay(attempt: number): number {
  return Math.min(SECOND_MS * 2 ** attempt, MAX_RETRY_DELAY);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MIN_STALE_TIME,
      gcTime: MIN_GC_TIME,
      retry: shouldRetryQuery,
      retryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});

// OTA 업데이트도 모델 모양을 바꿀 수 있어 번들 id까지 버전에 넣는다
const appVersion = getAppBundleId();

// 복원한 데이터는 앱이 꺼지기 전 낙관적 반영(서버에 닿지 못한 변경)일 수 있어 stale로만 표시한다.
// 화면이 붙을 때 서버 값으로 다시 맞추고, 여기서 요청을 기다리지 않아 복원 대기가 네트워크에 묶이지 않는다
function markRestoredQueriesStale() {
  return queryClient.invalidateQueries({ refetchType: 'none' });
}

interface QueryProviderProps extends PropsWithChildren {
  /** 암호화 저장소를 열지 못하면 `null`. 이때는 캐시를 기기에 남기지 않는다 */
  cacheStorage: QueryCacheStorage | null;
}

export function QueryProvider({ children, cacheStorage }: QueryProviderProps) {
  const { resolvedLanguage } = useLanguage();
  const [persistOptions] = useState(() => {
    removePlaintextQueryCache(deviceSyncStorage);
    return cacheStorage == null
      ? null
      : createQueryPersistOptions({
          storage: cacheStorage,
          buster: createQueryCacheBuster({ appVersion, language: resolvedLanguage }),
          schemas: PERSISTED_QUERY_SCHEMAS,
        });
  });

  // 서버가 Accept-Language로 만든 값(날씨·알림·AI 결과)은 키에 언어가 없어, 언어가 바뀌면 한 번 모두 다시 받는다
  useEffect(() => {
    let currentLanguage = i18n.language;
    const handleLanguageChanged = (language: string) => {
      if (language === currentLanguage) {
        return;
      }
      currentLanguage = language;
      queryClient.invalidateQueries();
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, []);

  if (persistOptions == null) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={markRestoredQueriesStale}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
