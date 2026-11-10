import { cleanStartupKeys } from '@src/bootstrap/startup/startup-key-cleanup';
import { RELEASES } from '@src/features/app-config/whats-new/constants/releases';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage, isKeychainLockedError, toError } from '@src/shared/errors';
import { setGlobalLogger } from '@src/shared/infra/logger';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/encrypted-draft-storage';
import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';

import { useEventListenerErrorReporting } from '../hooks/use-event-listener-error-reporting';
import { QUERY_CACHE_LOG_EVENT } from '../query/query-cache-log-events';
import type { QueryCacheStorage } from '../query/query-cache-persistence';
import { createAppContainer } from './create-app-container';
import { createDevicePorts } from './create-device-ports';
import { type DIContainer, StaticDIProvider } from './di-context';

interface DIProviderProps extends PropsWithChildren {
  /** 암호화 키 조회가 끝난 초안·조회 캐시 저장소. 비동기 준비는 앱 부트스트랩에서 마친다. */
  encryptedStorageBootstrap: EncryptedStorageBootstrap;
  /** `QueryProvider`와 같은 조회 캐시 저장소. 열지 못했으면 null */
  queryCacheStorage: QueryCacheStorage | null;
}

export function DIProvider({
  children,
  encryptedStorageBootstrap,
  queryCacheStorage,
}: DIProviderProps) {
  const queryClient = useQueryClient();
  const [di] = useState<DIContainer>(() => {
    const devicePorts = createDevicePorts();
    const { logger, errorReporter } = devicePorts;
    setGlobalLogger(logger);

    const container = createAppContainer({
      ...devicePorts,
      draftStorage: encryptedStorageBootstrap.draftStorage,
      queryCacheStorage,
      queryClient,
    });
    container.draftService.removeExpired();

    const storageFailure = encryptedStorageBootstrap.failure;
    if (storageFailure != null) {
      // 이번 실행은 초안·조회 캐시를 기기에 남기지 않는다. 앱은 서버 값만으로 동작한다
      logger.warn(QUERY_CACHE_LOG_EVENT.ENCRYPTED_STORAGE_UNAVAILABLE, {
        error: getErrorMessage(storageFailure),
      });
      // 잠금 해제 전 실행처럼 키체인을 잠시 못 읽는 것은 예상된 상태라 이벤트로 올리지 않는다
      if (!isKeychainLockedError(storageFailure)) {
        errorReporter.captureException(toError(storageFailure), { feature: 'draft' });
      }
    }

    cleanStartupKeys(
      {
        'whats-new': () =>
          container.whatsNewRepository.removeRetiredKeys({
            campaignIds: RELEASES.flatMap((release) => release.campaignId ?? []),
            now: getNowInstant(),
          }),
        coachmark: () => container.coachmarkService.removeRetiredKeys(),
        activation: () => container.activationProgressRepository.removeRetiredKeys(),
      },
      logger,
    );

    return container;
  });

  useEventListenerErrorReporting(di.logger);

  return <StaticDIProvider container={di}>{children}</StaticDIProvider>;
}
