import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useWhatsNewStateService } from '@src/bootstrap/providers/di-context';
import { getNativeAppVersion } from '@src/features/app-config/whats-new/apis/native-app-version';
import { WhatsNewPolicy } from '@src/features/app-config/whats-new/domains/whats-new.model';
import {
  filterAvailableCampaign,
  getBundledWhatsNewCampaign,
} from '@src/features/app-config/whats-new/domains/whats-new.registry';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useInviteAvailability } from '@src/features/social/invite/hooks/use-invite-availability';
import { useStableFeedForeground } from '@src/shared/hooks/use-stable-feed-foreground';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { useGetWhatsNewQueryOptions } from '../queries/get-whats-new-query-options';
import { claimAndOpenWhatsNew } from '../utils/whats-new-auto-open';
import { useWhatsNewHub } from './use-whats-new-hub';

/** 날씨 위치 안내가 뜰 수 있는 동안에는 자동으로 열지 않아 두 안내가 겹치지 않게 한다. */
export function useWhatsNewFeed({
  isWeatherIntroductionPending,
}: {
  isWeatherIntroductionPending: boolean;
}) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const { data: config } = useQuery({
    ...useGetWhatsNewQueryOptions(),
    enabled: isAuthenticated,
  });
  const { data: user } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const appVersion = useMemo(getNativeAppVersion, []);
  const isStable = useStableFeedForeground();
  const { openHub } = useWhatsNewHub();
  const stateService = useWhatsNewStateService();
  const [_refreshCount, refreshState] = useReducer((value: number) => value + 1, 0);

  const isInviteAvailable = useInviteAvailability();
  const campaign = filterAvailableCampaign(
    config?.enabled === true ? getBundledWhatsNewCampaign(config.campaignId) : null,
    { isInviteAvailable },
  );
  const accountId = user?.id;
  const identity = useMemo(
    () =>
      accountId && campaign
        ? {
            userId: accountId,
            campaignId: campaign.id,
          }
        : null,
    [accountId, campaign],
  );
  const hasSeen = identity ? stateService.isSeen(identity) : true;
  const canAutoOpen = WhatsNewPolicy.canAutoOpen({
    authStatus: isWeatherIntroductionPending ? 'loading' : status,
    config,
    user,
    appVersion,
    hasBundledCampaign: campaign != null,
    hasSeen,
  });

  useEffect(() => {
    if (!identity || !campaign || !accountId) {
      return;
    }

    const task = requestIdleCallback(() => {
      const opened = claimAndOpenWhatsNew({
        canAutoOpen,
        isStable,
        claim: () => stateService.claimSeen(identity),
        open: () =>
          openHub({
            accountId,
            campaign,
            source: 'auto',
          }),
      });
      if (opened) {
        refreshState();
      }
    });

    return () => cancelIdleCallback(task);
  }, [accountId, campaign, canAutoOpen, identity, isStable, openHub, stateService]);

  const isReentryVisible =
    config?.enabled === true &&
    identity != null &&
    campaign != null &&
    stateService.isReentryVisible(identity);

  const openFromReentry = useCallback(() => {
    if (!accountId || !campaign) {
      return;
    }
    openHub({
      accountId,
      campaign,
      source: 'feed_reentry',
    });
  }, [accountId, campaign, openHub]);

  const dismissReentry = useCallback(() => {
    if (identity == null) {
      return;
    }
    stateService.dismissReentry(identity);
    refreshState();
  }, [identity, stateService]);

  return {
    isReentryVisible,
    openFromReentry,
    dismissReentry,
  };
}
