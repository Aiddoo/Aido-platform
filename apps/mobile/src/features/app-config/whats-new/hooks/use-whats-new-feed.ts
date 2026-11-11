import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { getNowInstant } from '@src/shared/date/clock';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { WhatsNewPolicy } from '../domains/whats-new.model';
import { useWhatsNewAutoOpen } from './use-whats-new-auto-open';

interface WhatsNewFeedInput {
  isStable: boolean;
  /** 가입 직후 안내(알림 화면)를 열 차례가 아니라고 정해졌다. 정해지기 전에 열면 그 화면과 겹치거나 순서가 바뀐다 */
  isOnboardingSettled: boolean;
}

/** 서버가 켠 캠페인을 첫 피드에서 계정마다 한 번 자동으로 열고(새 계정 포함), 피드 카드로 다시 열게 한다 */
export function useWhatsNewFeed({ isStable, isOnboardingSettled }: WhatsNewFeedInput) {
  const { identity, release, shouldAutoOpen } = useWhatsNewAutoOpen({ isOnboardingSettled });
  const repository = useWhatsNewRepository();
  const now = useMinuteNow();
  const push = useSingleTap(router.push);

  const reentryOpenedAt = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        identity == null ? noop : repository.subscribe(identity, onChange),
      [identity, repository],
    ),
    () => (identity == null ? null : repository.findReentryOpenedAt(identity)),
  );

  useEffect(() => {
    if (
      !shouldAutoOpen ||
      !isStable ||
      !isOnboardingSettled ||
      identity == null ||
      release == null
    ) {
      return;
    }

    const task = requestIdleCallback(() => {
      if (repository.claimSeen(identity, getNowInstant())) {
        push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'auto' } });
      }
    });

    return () => cancelIdleCallback(task);
  }, [shouldAutoOpen, identity, isStable, isOnboardingSettled, push, release, repository]);

  const isReentryVisible =
    identity != null && WhatsNewPolicy.shouldShowReentry(reentryOpenedAt, now);

  const openFromReentry = () => {
    if (release != null) {
      push({ pathname: '/whats-new', params: { releaseId: release.id, source: 'feed_reentry' } });
    }
  };

  const dismissReentry = () => {
    if (identity != null) {
      repository.dismissReentry(identity);
    }
  };

  return { isReentryVisible, openFromReentry, dismissReentry };
}
