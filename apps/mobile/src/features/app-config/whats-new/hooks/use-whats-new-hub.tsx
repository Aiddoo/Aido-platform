import { useAnalytics, useFeatureAttribution } from '@src/bootstrap/providers/di-context';
import type {
  WhatsNewCampaign,
  WhatsNewCardId,
} from '@src/features/app-config/whats-new/domains/whats-new.registry';
import type { FeatureHubSource } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useOverlay } from '@src/shared/ui';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';

import { WhatsNewBottomSheet } from '../components/whats-new-bottom-sheet';
import {
  recordWhatsNewCardCta,
  recordWhatsNewDismissed,
  recordWhatsNewImpression,
} from '../utils/whats-new-analytics';

interface OpenWhatsNewHubInput {
  accountId: string;
  campaign: WhatsNewCampaign;
  source: FeatureHubSource;
}

export function useWhatsNewHub() {
  const push = useSingleTap(router.push);

  const analytics = useAnalytics();
  const featureAttribution = useFeatureAttribution();
  const overlay = useOverlay();
  const { height: viewportHeight } = useWindowDimensions();

  const openHub = useCallback(
    ({ accountId, campaign, source }: OpenWhatsNewHubInput): void => {
      if (!accountId) {
        return;
      }

      recordWhatsNewImpression(analytics, {
        campaignId: campaign.id,
        source,
      });

      let isFinished = false;
      overlay.open(({ isOpen, close, unmount }) => {
        const handleDismiss = () => {
          if (isFinished) {
            return;
          }
          isFinished = true;
          recordWhatsNewDismissed(analytics, {
            campaignId: campaign.id,
            source,
          });
          close();
        };

        const handleCardCta = (cardId: WhatsNewCardId) => {
          if (isFinished) {
            return;
          }
          isFinished = true;
          recordWhatsNewCardCta(analytics, featureAttribution, {
            accountId,
            campaignId: campaign.id,
            cardId,
            source,
          });
          close();
          const route = campaign.cards.find((card) => card.id === cardId)?.route;
          if (route != null) {
            push(route);
          }
        };

        return (
          <WhatsNewBottomSheet
            isOpen={isOpen}
            campaign={campaign}
            viewportHeight={viewportHeight}
            onOpenChange={handleDismiss}
            onExit={unmount}
            onCardCta={handleCardCta}
          />
        );
      });
    },
    [analytics, featureAttribution, overlay, viewportHeight],
  );

  return { openHub };
}
