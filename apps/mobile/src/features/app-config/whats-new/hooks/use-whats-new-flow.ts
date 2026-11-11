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
import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { WHATS_NEW_LOG_EVENT } from '../constants/whats-new-log-events';
import type { Release } from '../domains/whats-new.model';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';

interface WhatsNewFlowInput {
  release: Pick<Release, 'id' | 'campaignId'>;
  source: WhatsNewSource;
}

// 닫기·iOS 스와이프·Android 뒤로 가기 모두 화면이 사라질 때 닫은 것으로 남기고, 기능으로 떠나거나 끝까지 본 경우만 뺀다
export function useWhatsNewFlow({ release, source }: WhatsNewFlowInput) {
  const { id: releaseId, campaignId } = release;
  const { trackEvent } = useTrack();
  const featureAttribution = useFeatureAttribution();
  const logger = useLogger();
  const repository = useWhatsNewRepository();
  const accountId = useMyAccountId();
  const isFinishedRef = useRef(false);
  const viewedStepsRef = useRef(new Set<string>());

  // 캠페인이 없는 지난 출시는 자동으로 열리지 않아 본 기록·캠페인 지표를 남기지 않는다
  useEffect(() => {
    if (accountId != null && campaignId != null) {
      repository.claimSeen({ userId: accountId, campaignId }, getNowInstant());
    }
  }, [accountId, campaignId, repository]);

  useEffect(() => {
    if (campaignId == null) {
      return;
    }
    trackEvent('feature_hub_impression', { campaign_id: campaignId, source });

    return () => {
      if (!isFinishedRef.current) {
        trackEvent('feature_hub_dismissed', { campaign_id: campaignId, source });
      }
    };
  }, [campaignId, source, trackEvent]);

  // 탭 안 화면(메모·친구 초대)은 탭을 새로 쌓지 않고 아래 탭에서 연다. 기록에 없는 화면이면 이 화면 자리에 연다
  const leaveTo = useSingleTap((href: Href) => {
    isFinishedRef.current = true;
    router.dismissTo(href);
  });

  const trackStepViewed = ({ step, index }: { step: string; index: number }) => {
    if (viewedStepsRef.current.has(step)) {
      return;
    }
    viewedStepsRef.current.add(step);
    trackEvent('whats_new_step_viewed', { release_id: releaseId, step, index, source });
  };

  const trackCta = ({ step, feature }: { step: string; feature: FeatureKey }) => {
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

  const goBack = useGoBack({ fallbackHref: '/feed' });

  const complete = useSingleTap(() => {
    isFinishedRef.current = true;
    trackEvent('whats_new_completed', { release_id: releaseId, source });
    goBack();
  });

  return { close: goBack, complete, leaveTo, trackCta, trackStepViewed };
}
