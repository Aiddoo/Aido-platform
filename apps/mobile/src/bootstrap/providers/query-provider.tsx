import type { AppLifecycleGateway } from '@src/core/ports/app-lifecycle-gateway';
import { i18n } from '@src/shared/i18n';
import { getAppBundleId } from '@src/shared/infra/application/app-bundle';
import { useLanguage } from '@src/shared/providers/language-provider';
import { focusManager, type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type PropsWithChildren, useEffect, useState } from 'react';

import { PERSISTED_QUERY_SCHEMAS } from '../query/persisted-query-schemas';
import {
  createQueryCacheBuster,
  createQueryPersistOptions,
  type QueryCacheStorage,
} from '../query/query-cache-persistence';

// OTA 업데이트도 모델 모양을 바꿀 수 있어 번들 id까지 버전에 넣는다
const appVersion = getAppBundleId();

// 복원한 데이터는 앱이 꺼지기 전 낙관적 반영(서버에 닿지 못한 변경)일 수 있어 stale로만 표시한다.
// 화면이 붙을 때 서버 값으로 다시 맞추고, 여기서 요청을 기다리지 않아 복원 대기가 네트워크에 묶이지 않는다
function markRestoredQueriesStale(client: QueryClient) {
  return client.invalidateQueries({ refetchType: 'none' });
}

interface QueryProviderProps extends PropsWithChildren {
  /** 프로세스에 하나인 조회 캐시(`composition-root`) */
  client: QueryClient;
  /** 암호화 저장소를 열지 못하면 `null`. 이때는 캐시를 기기에 남기지 않는다 */
  cacheStorage: QueryCacheStorage | null;
  appLifecycle: AppLifecycleGateway;
}

export function QueryProvider({
  children,
  client,
  cacheStorage,
  appLifecycle,
}: QueryProviderProps) {
  const { resolvedLanguage } = useLanguage();
  const [persistOptions] = useState(() =>
    cacheStorage == null
      ? null
      : createQueryPersistOptions({
          storage: cacheStorage,
          buster: createQueryCacheBuster({ appVersion, language: resolvedLanguage }),
          schemas: PERSISTED_QUERY_SCHEMAS,
        }),
  );

  // RN에는 `visibilitychange`가 없어 앱 상태를 `focusManager`에 잇는다
  useEffect(() => {
    focusManager.setEventListener((handleFocus) =>
      appLifecycle.subscribe((state) => handleFocus(state === 'active')),
    );
    return () => focusManager.setEventListener(() => undefined);
  }, [appLifecycle]);

  // 서버가 Accept-Language로 만든 값(날씨·알림·AI 결과)은 키에 언어가 없어, 언어가 바뀌면 한 번 모두 다시 받는다
  useEffect(() => {
    let currentLanguage = i18n.language;
    const handleLanguageChanged = (language: string) => {
      if (language === currentLanguage) {
        return;
      }
      currentLanguage = language;
      client.invalidateQueries();
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, [client]);

  if (persistOptions == null) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions}
      onSuccess={() => markRestoredQueriesStale(client)}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
