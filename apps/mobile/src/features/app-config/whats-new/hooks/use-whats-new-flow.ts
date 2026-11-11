import { useWhatsNewRepository } from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { getNowInstant } from '@src/shared/date/clock';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';

import type { Release } from '../domains/whats-new.model';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';
import { useWhatsNewTracking } from './use-whats-new-tracking';

interface WhatsNewFlowInput {
  release: Pick<Release, 'id' | 'campaignId'>;
  source: WhatsNewSource;
}

/** 소개 화면의 본 기록과 이동(닫기·완료·기능으로 떠나기). 추적은 `useWhatsNewTracking`이 한다 */
export function useWhatsNewFlow({ release, source }: WhatsNewFlowInput) {
  const { campaignId } = release;
  const repository = useWhatsNewRepository();
  const accountId = useMyAccountId();
  const { markFinished, trackStepViewed, trackCta, trackCompleted } = useWhatsNewTracking({
    release,
    source,
    accountId,
  });

  // 캠페인이 없는 지난 출시는 자동으로 열리지 않아 본 기록을 남기지 않는다
  useEffect(() => {
    if (accountId != null && campaignId != null) {
      repository.claimSeen({ userId: accountId, campaignId }, getNowInstant());
    }
  }, [accountId, campaignId, repository]);

  // 탭 안 화면(메모·친구 초대)은 탭을 새로 쌓지 않고 아래 탭에서 연다. 기록에 없는 화면이면 이 화면 자리에 연다
  const leaveTo = useSingleTap((href: Href) => {
    markFinished();
    router.dismissTo(href);
  });

  const goBack = useGoBack({ fallbackHref: '/feed' });

  const complete = useSingleTap(() => {
    markFinished();
    trackCompleted();
    goBack();
  });

  return { close: goBack, complete, leaveTo, trackCta, trackStepViewed };
}
