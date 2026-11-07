import {
  useFeatureAttribution,
  useLogger,
  useWhatsNewRepository,
} from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import type { FeatureKey } from '@src/shared/analytics/feature-key';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { WHATS_NEW_LOG_EVENT } from '../constants/whats-new-log-events';
import type { Release } from '../schemas/release.schema';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';

interface WhatsNewFlowInput {
  release: Pick<Release, 'id' | 'campaignId'>;
  source: WhatsNewSource;
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/feed');
}

/**
 * 출시 안내 흐름 하나의 시작과 끝. 닫기 버튼, iOS 스와이프 뒤로 가기, Android 뒤로 가기 모두
 * 화면이 사라질 때 닫은 것으로 남기고, 실제 기능으로 떠나거나 끝까지 본 경우만 뺀다.
 */
export function useWhatsNewFlow({ release, source }: WhatsNewFlowInput) {
  const { id: releaseId, campaignId } = release;
  const { trackEvent } = useTrack();
  const featureAttribution = useFeatureAttribution();
  const logger = useLogger();
  const repository = useWhatsNewRepository();
  const { data: user } = useQuery(useGetMeQueryOptions());
  const accountId = user?.id;
  const isFinishedRef = useRef(false);
  const viewedStepsRef = useRef(new Set<string>());

  useEffect(() => {
    if (accountId != null) {
      repository.claimSeen({ userId: accountId, campaignId }, getNowInstant());
    }
  }, [accountId, campaignId, repository]);

  useEffect(() => {
    trackEvent('feature_hub_impression', { campaign_id: campaignId, source });

    return () => {
      if (!isFinishedRef.current) {
        trackEvent('feature_hub_dismissed', { campaign_id: campaignId, source });
      }
    };
  }, [campaignId, source, trackEvent]);

  const leaveTo = useSingleTap((href: Href) => {
    isFinishedRef.current = true;
    router.replace(href);
  });

  const trackStepViewed = ({ step, index }: { step: string; index: number }) => {
    if (viewedStepsRef.current.has(step)) {
      return;
    }
    viewedStepsRef.current.add(step);
    trackEvent('whats_new_step_viewed', { release_id: releaseId, step, index, source });
  };

  const trackCta = ({ step, feature }: { step: string; feature: FeatureKey }) => {
    trackEvent('feature_card_cta', { campaign_id: campaignId, feature, source });
    trackEvent('whats_new_cta_pressed', { release_id: releaseId, step });
    if (accountId == null) {
      return;
    }
    try {
      featureAttribution.record({ accountId, campaignId, feature });
    } catch (error) {
      logger.warn(WHATS_NEW_LOG_EVENT.ANALYTICS_RECORD_FAILED, { error: getErrorMessage(error) });
    }
  };

  const close = useSingleTap(goBack);

  const complete = useSingleTap(() => {
    isFinishedRef.current = true;
    trackEvent('whats_new_completed', { release_id: releaseId, source });
    goBack();
  });

  return { close, complete, leaveTo, trackCta, trackStepViewed };
}
