import { useAnalytics, useFeatureAttribution } from '@src/bootstrap/providers/di-context';
import type {
  FeatureDiscoveryCampaign,
  FeatureDiscoveryCardId,
} from '@src/features/feature-discovery/domains/feature-discovery.registry';
import type { FeatureHubSource } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useOverlay } from '@src/shared/ui';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';

import { FeatureDiscoveryBottomSheet } from '../components/feature-discovery-bottom-sheet';
import {
  recordFeatureDiscoveryCardCta,
  recordFeatureDiscoveryDismissed,
  recordFeatureDiscoveryImpression,
} from '../utils/analytics/feature-discovery.analytics';
import { navigateToFeatureDiscoveryCard } from '../utils/navigation/feature-discovery.navigation';

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

      let isFinished = false;
      overlay.open<void>(({ isOpen, close, exit }) => {
        const handleDismiss = () => {
          if (isFinished) {
            return;
          }
          isFinished = true;
          recordFeatureDiscoveryDismissed(analytics, {
            campaignId: campaign.id,
            source,
          });
          close();
        };

        const handleCardCta = (cardId: FeatureDiscoveryCardId) => {
          if (isFinished) {
            return;
          }
          isFinished = true;
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
          <FeatureDiscoveryBottomSheet
            isOpen={isOpen}
            campaign={campaign}
            viewportHeight={viewportHeight}
            onDismiss={handleDismiss}
            onExit={exit}
            onCardCta={handleCardCta}
          />
        );
      });
    },
    [analytics, featureAttribution, overlay, viewportHeight],
  );

  return { openHub };
}
