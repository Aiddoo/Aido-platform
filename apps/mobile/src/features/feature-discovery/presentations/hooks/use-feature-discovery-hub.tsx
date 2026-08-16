import { useAnalytics, useFeatureAttribution } from '@src/bootstrap/providers/di-context';
import type {
  FeatureDiscoveryCampaign,
  FeatureDiscoveryCardId,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import type { FeatureHubSource } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useOverlay } from '@src/shared/ui';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  recordFeatureDiscoveryCardCta,
  recordFeatureDiscoveryDismissed,
  recordFeatureDiscoveryImpression,
} from '../analytics/feature-discovery.analytics';
import { FeatureDiscoverySheet } from '../components/FeatureDiscoverySheet';
import { navigateToFeatureDiscoveryCard } from '../navigation/feature-discovery.navigation';

interface OpenFeatureDiscoveryHubInput {
  accountId: string;
  campaign: FeatureDiscoveryCampaign;
  source: FeatureHubSource;
}

export function useFeatureDiscoveryHub() {
  const push = useSingleTap(router.push);

  const analytics = useAnalytics();
  const featureAttribution = useFeatureAttribution();
  const overlay = useOverlay();
  const { height: viewportHeight } = useWindowDimensions();

  const openHub = useCallback(
    ({ accountId, campaign, source }: OpenFeatureDiscoveryHubInput): void => {
      if (!accountId) {
        return;
      }

      recordFeatureDiscoveryImpression(analytics, {
        campaignId: campaign.id,
        source,
      });

      let finished = false;
      void overlay.open<void>(({ isOpen, close, exit }) => {
        const dismiss = () => {
          if (finished) {
            return;
          }
          finished = true;
          recordFeatureDiscoveryDismissed(analytics, {
            campaignId: campaign.id,
            source,
          });
          close();
        };

        const openCard = (cardId: FeatureDiscoveryCardId) => {
          if (finished) {
            return;
          }
          finished = true;
          recordFeatureDiscoveryCardCta(analytics, featureAttribution, {
            accountId,
            campaignId: campaign.id,
            cardId,
            source,
          });
          close();
          navigateToFeatureDiscoveryCard(
            {
              push: (route) => push(route),
            },
            cardId,
          );
        };

        return (
          <FeatureDiscoverySheet
            isOpen={isOpen}
            campaign={campaign}
            viewportHeight={viewportHeight}
            onDismiss={dismiss}
            onExit={exit}
            onCardCta={openCard}
          />
        );
      });
    },
    [analytics, featureAttribution, overlay, viewportHeight],
  );

  return { openHub };
}
