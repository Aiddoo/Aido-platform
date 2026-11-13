import { RELEASES } from '@src/features/app-config/whats-new/constants/releases.constants';
import { getNowInstant } from '@src/shared/date/clock';
import { useEffect } from 'react';

import type { DIContainer } from '../providers/di-context';
import { removePlaintextQueryCache } from '../query/query-cache-persistence';
import { cleanStartupKeys } from '../startup/startup-key-cleanup';

type StartupCleanupTargets = Pick<
  DIContainer,
  | 'draftService'
  | 'syncStorage'
  | 'whatsNewRepository'
  | 'coachmarkRepository'
  | 'activationProgressRepository'
  | 'logger'
>;

/** 렌더가 아니라 마운트 뒤에 돈다. 지운 것을 다시 지워도 같아 StrictMode와 루트 "다시 시도"가 다시 불러도 된다 */
export function useStartupCleanup({
  draftService,
  syncStorage,
  whatsNewRepository,
  coachmarkRepository,
  activationProgressRepository,
  logger,
}: StartupCleanupTargets): void {
  useEffect(() => {
    cleanStartupKeys(
      {
        draft: () => draftService.removeExpired(),
        'query-cache': () => removePlaintextQueryCache(syncStorage),
        'whats-new': () =>
          whatsNewRepository.removeRetiredKeys({
            campaignIds: RELEASES.flatMap((release) => release.campaignId ?? []),
            now: getNowInstant(),
          }),
        // 코치마크를 읽는 화면은 비동기 인증 판정 뒤에 붙어, 첫 마운트의 이 effect가 그보다 먼저 옮긴다
        'coachmark-migration': () => coachmarkRepository.migrateLegacyKeys(),
        coachmark: () => coachmarkRepository.removeRetiredKeys(),
        activation: () => activationProgressRepository.removeRetiredKeys(),
      },
      logger,
    );
  }, [
    draftService,
    syncStorage,
    whatsNewRepository,
    coachmarkRepository,
    activationProgressRepository,
    logger,
  ]);
}
