import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useOpenSheet } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router } from 'expo-router';
import { type ComponentProps, useMemo } from 'react';
import { match } from 'ts-pattern';

import { parseLimitedFeature } from '../apis/entitlement.mapper';
import { PremiumUpsell } from '../components/premium-upsell';
import type { EntitlementGateSurface, LimitReachedTrigger } from '../constants/subscription.events';
import { type EntitlementFeature } from '../domains/entitlement.model';
import { EntitlementPolicy, LimitedFeaturePolicy } from '../domains/entitlement.model';
import { getCachedEntitlements, reflectFeatureQuota } from '../queries/entitlement-cache';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { upsellDismissalStoredValue } from '../schemas/upsell-dismissal-storage.schema';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';
import { getUpsellPresentation, type UpsellPresentation } from '../utils/upsell.view-model';
import { useFormatRefillSentence } from './use-format-refill-sentence';

type BlockedDecision = 'limit-reached' | 'locked';

type UpsellChoice = 'subscribe' | 'alternative' | 'dismiss';

export type EntitlementGatePromptOptions = Partial<
  Pick<ComponentProps<typeof PremiumUpsell>, 'title' | 'description'> &
    Pick<ComponentProps<typeof PremiumUpsell.Actions>, 'alternativeAction'>
> & {
  /** 프리미엄 보기를 고르면 페이월로 가기 전에 불린다(아래 시트를 닫는 등) */
  onSubscribe?: () => void;
};

const GATE_TITLE_KEYS = {
  AI_PARSE: 'gate.aiParseTitle',
  VOICE_NOTE: 'gate.voiceNoteTitle',
  NUDGE: 'gate.nudgeTitle',
  CHEER: 'gate.cheerTitle',
  FRIEND: 'gate.friendTitle',
  TODO_CATEGORY: 'gate.categoryTitle',
  AI_REPORT: 'gate.aiReportTitle',
  AI_SUGGESTION: 'gate.aiSuggestionTitle',
  CUSTOM_REMINDER_TIME: 'gate.reminderTimeTitle',
  APP_ICON: 'gate.appIconTitle',
} as const satisfies Record<EntitlementFeature, string>;

export function useEntitlementGate(
  feature: EntitlementFeature,
  { surface }: { surface: EntitlementGateSurface },
) {
  const openSheet = useOpenSheet();
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const upsellDismissalStorage = useStoredValueStorage(upsellDismissalStoredValue);
  const todayKey = useTodayKey();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const { t } = useTranslation('subscription');
  const formatRefillSentence = useFormatRefillSentence();

  return useMemo(() => {
    const open = (
      target: EntitlementFeature,
      decision: BlockedDecision,
      trigger: LimitReachedTrigger,
      { onSubscribe, title, description, alternativeAction }: EntitlementGatePromptOptions = {},
    ) => {
      const latest = getCachedEntitlements(queryClient) ?? snapshot;
      const promptTitle = title ?? t(GATE_TITLE_KEYS[target]);
      const refill = formatRefillSentence(latest, target);
      const analyticsFeature = getPremiumGateAnalyticsFeature(target);
      const isLimitReached = decision === 'limit-reached';
      if (isLimitReached) {
        trackEvent('limit_reached_shown', { feature: analyticsFeature, surface, trigger });
      }

      // 프리미엄·관리자가 공정 사용 한도에 닿으면 구독을 권하지 않고 언제 다시 쓸 수 있는지만 알린다
      if (!EntitlementPolicy.shouldOfferPremium(latest)) {
        toast.warning(promptTitle, { description: refill ?? undefined });
        return;
      }

      const userId = getCachedMe(queryClient)?.id;
      const dismissedOn =
        readStoredValue(upsellDismissalStorage, upsellDismissalStoredValue, userId)[target] ?? null;
      const presentation = getUpsellPresentation(dismissedOn, todayKey, {
        hasAlternativeAction: alternativeAction != null,
      });

      const goToPaywall = (shownAs: UpsellPresentation) => {
        trackEvent('premium_gate_cta_tapped', {
          feature: analyticsFeature,
          surface,
          presentation: shownAs,
        });
        if (isLimitReached) {
          trackEvent('limit_reached_cta_tapped', { feature: analyticsFeature, surface });
        }
        onSubscribe?.();
        router.navigate({ pathname: '/paywall', params: { feature: target } });
      };

      trackEvent('premium_gate_shown', { feature: analyticsFeature, surface, presentation });

      if (presentation === 'toast') {
        toast.warning(promptTitle, {
          description: refill ?? undefined,
          action: { label: t('upsell.viewPremium'), onPress: () => goToPaywall('toast') },
        });
        return;
      }

      // 버튼을 여러 번 눌러도 답은 처음 고른 하나로 끝나 이동·기록이 한 번만 일어난다. undefined는 답 없이
      // 사라졌을 때(부른 화면이 떠남)라 닫은 것으로 남기지 않는다
      openSheet<UpsellChoice>(
        () => <PremiumUpsell feature={target} title={promptTitle} description={description} />,
        {
          footer: (close) => (
            <PremiumUpsell.Actions
              alternativeAction={
                alternativeAction == null
                  ? undefined
                  : { label: alternativeAction.label, onPress: () => close('alternative') }
              }
              onSubscribe={() => close('subscribe')}
              onLater={() => close('dismiss')}
            />
          ),
          dismissValue: 'dismiss',
        },
      ).then((choice) =>
        match(choice)
          .with('subscribe', () => goToPaywall('sheet'))
          .with('alternative', () => alternativeAction?.onPress())
          .with('dismiss', () => {
            trackEvent('premium_upsell_dismissed', { feature: analyticsFeature, surface });
            const dismissals = readStoredValue(
              upsellDismissalStorage,
              upsellDismissalStoredValue,
              userId,
            );
            writeStoredValue(
              upsellDismissalStorage,
              upsellDismissalStoredValue,
              { ...dismissals, [target]: todayKey },
              userId,
            );
          })
          .with(undefined, noop)
          .exhaustive(),
      );
    };

    return {
      /** 시작하기 전에 확인한다. 막혔으면 안내를 띄우고 true다(멈춘다). 스냅샷을 아직 모르면 서버에 맡긴다 */
      promptIfBlocked: (options?: EntitlementGatePromptOptions): boolean => {
        if (snapshot == null) {
          return false;
        }
        return match(EntitlementPolicy.getAccessDecision(snapshot, feature, getNowInstant()))
          .with('allow', () => false)
          .with('limit-reached', 'locked', (decision) => {
            open(feature, decision, 'precheck', options);
            return true;
          })
          .exhaustive();
      },
      promptLimit: (options?: EntitlementGatePromptOptions) => {
        open(feature, 'limit-reached', 'precheck', options);
      },
      /** 서버가 한도·프리미엄 전용으로 막은 오류면 안내를 띄우고 true다(멈춘다). 그 밖의 오류는 부른 쪽이 처리한다 */
      promptIfBlockedError: (error: unknown, options?: EntitlementGatePromptOptions): boolean => {
        const limited = parseLimitedFeature(error);
        if (limited == null) {
          return false;
        }
        // 한도를 싣지 않은 거절에 스냅샷을 다시 받으면 열리는 시트의 사용량이 잠깐 비어 보여 그대로 둔다
        if (limited.featureQuota != null) {
          reflectFeatureQuota(queryClient, limited.featureQuota);
        }
        open(limited.feature, LimitedFeaturePolicy.getBlockedDecision(limited), 'server', options);
        return true;
      },
    };
  }, [
    feature,
    surface,
    snapshot,
    openSheet,
    toast,
    trackEvent,
    queryClient,
    upsellDismissalStorage,
    todayKey,
    t,
    formatRefillSentence,
  ]);
}
