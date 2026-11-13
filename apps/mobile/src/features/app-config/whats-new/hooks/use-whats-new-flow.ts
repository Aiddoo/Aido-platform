import {
  useFeatureAttribution,
  useLogger,
  useWhatsNewRepository,
} from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import type { FeatureKey } from '@src/shared/analytics/feature-key';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import type { Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { WHATS_NEW_LOG_EVENT } from '../constants/whats-new-log-events';
import type { WhatsNewStep } from '../constants/whats-new.events';
import type { Release } from '../domains/whats-new.model';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';

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

  // 탭 안 화면(메모·친구 초대)은 탭을 새로 쌓지 않고 아래 보던 탭에서 연다. 기록에 없는 화면이면 이 화면 자리에 연다
  const leaveTo = useSingleTap((href: Href) => {
    markFinished();
    dismissToTab(href);
  });

  const goBack = useGoBack({ fallbackHref: '/feed' });

  const complete = useSingleTap(() => {
    markFinished();
    trackCompleted();
    goBack();
  });

  return { close: goBack, complete, leaveTo, trackCta, trackStepViewed };
}

interface WhatsNewTrackingInput extends WhatsNewFlowInput {
  accountId: string | null;
}

/** 열림·닫힘·단계·CTA·완료 추적. 닫기·iOS 스와이프·Android 뒤로 가기는 화면이 사라질 때 닫은 것으로 남기고, `markFinished` 한 경우만 뺀다 */
function useWhatsNewTracking({ release, source, accountId }: WhatsNewTrackingInput) {
  const { id: releaseId, campaignId } = release;
  const { trackEvent } = useTrack();
  const featureAttribution = useFeatureAttribution();
  const logger = useLogger();
  const isFinishedRef = useRef(false);
  const viewedStepsRef = useRef(new Set<WhatsNewStep>());

  // 캠페인이 없는 지난 출시는 자동으로 열리지 않아 캠페인 지표를 남기지 않는다
  useEffect(() => {
    if (campaignId == null) {
      return;
    }
    // oxlint-disable-next-line aido/no-tracking-in-effect -- 노출과 닫힘(cleanup)이 한 수명의 짝이다
    trackEvent('feature_hub_impression', { campaign_id: campaignId, source });

    return () => {
      if (!isFinishedRef.current) {
        trackEvent('feature_hub_dismissed', { campaign_id: campaignId, source });
      }
    };
  }, [campaignId, source, trackEvent]);

  const markFinished = () => {
    isFinishedRef.current = true;
  };

  const trackStepViewed = ({ step, index }: { step: WhatsNewStep; index: number }) => {
    if (viewedStepsRef.current.has(step)) {
      return;
    }
    viewedStepsRef.current.add(step);
    trackEvent('whats_new_step_viewed', { release_id: releaseId, step, index, source });
  };

  const trackCta = ({ step, feature }: { step: WhatsNewStep; feature: FeatureKey }) => {
    trackEvent('whats_new_cta_pressed', { release_id: releaseId, step });
    if (campaignId == null) {
      return;
    }
    trackEvent('feature_card_cta', { campaign_id: campaignId, feature, source });
    if (accountId == null) {
      return;
    }
    try {
      featureAttribution.record({ accountId, campaignId, feature });
    } catch (error) {
      logger.warn(WHATS_NEW_LOG_EVENT.ANALYTICS_RECORD_FAILED, { error: getErrorMessage(error) });
    }
  };

  const trackCompleted = () => {
    trackEvent('whats_new_completed', { release_id: releaseId, source });
  };

  return { markFinished, trackStepViewed, trackCta, trackCompleted };
}
