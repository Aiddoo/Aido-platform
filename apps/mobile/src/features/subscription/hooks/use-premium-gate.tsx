import type { PremiumFeature } from '@aido/api';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { PremiumDialog, useOverlay } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { type ComponentProps, useMemo } from 'react';

import { toPremiumGateAnalyticsFeature } from '../domains/premium-feature.model';
import { subscriptionHref } from '../utils/navigation/subscription-href';
import { useQuotaResetMessage } from './use-quota-reset-message';

type PremiumGateDialogOptions = Pick<
  ComponentProps<typeof PremiumDialog>,
  'title' | 'description' | 'alternativeAction'
> & {
  /** 구독 화면으로 가기 직전에 부른다(예: 열려 있던 시트 닫기) */
  onSubscribe?: () => void;
};

/**
 * 무료 사용자가 프리미엄 기능에 닿았을 때의 단일 진입점.
 * 안내 노출을 기능별로 기록하고, 구독하기는 항상 같은 구독 화면으로 보낸다.
 * 횟수 기능은 서버가 알려 준 초기화 시각으로 언제 다시 쓸 수 있는지 함께 알린다.
 */
export function usePremiumGate(feature: PremiumFeature) {
  const overlay = useOverlay();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toQuotaResetMessage = useQuotaResetMessage();

  return useMemo(() => {
    const analyticsFeature = toPremiumGateAnalyticsFeature(feature);
    const trackShown = () => trackEvent('premium_gate_shown', { feature: analyticsFeature });
    const subscribe = () => {
      trackEvent('premium_gate_cta_tapped', { feature: analyticsFeature });
      router.navigate(subscriptionHref());
    };

    return {
      /** 안내를 기록하고 프리미엄 다이얼로그를 띄운다 */
      open: ({ onSubscribe, description, ...options }: PremiumGateDialogOptions) => {
        trackShown();
        const resetMessage = toQuotaResetMessage(getCachedMe(queryClient)?.entitlements[feature]);
        overlay.open(({ isOpen, close, exit }) => (
          <PremiumDialog
            {...options}
            description={resetMessage == null ? description : `${description}\n${resetMessage}`}
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
            onSubscribe={() => {
              onSubscribe?.();
              subscribe();
            }}
          />
        ));
      },
      /** route가 바뀌면 overlay가 닫히는 시트 안처럼 PremiumDialog를 직접 그릴 때 안내 노출만 기록한다 */
      trackShown,
      subscribe,
    };
  }, [feature, overlay, trackEvent, queryClient, toQuotaResetMessage]);
}
