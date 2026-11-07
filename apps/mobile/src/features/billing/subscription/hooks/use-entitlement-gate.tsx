import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { PremiumDialog, type PremiumDialogProps, useOverlay } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';

import { findLimitedFeature } from '../apis/entitlement.mapper';
import type { EntitlementGateSurface, LimitReachedTrigger } from '../constants/subscription.events';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { getCachedEntitlements, setFeatureQuota } from '../queries/entitlement-cache';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { type EntitlementFeature, type EntitlementSnapshot } from '../schemas/entitlement.schema';
import { getPremiumBenefitAmounts } from '../utils/plan-benefit.view-model';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';
import { useFormatRefillSentence } from './use-format-refill-sentence';

type BlockedDecision = 'limit-reached' | 'locked';

export type EntitlementGateDialogOptions = Partial<
  Pick<PremiumDialogProps, 'title' | 'description' | 'alternativeAction'>
> & {
  onSubscribe?: () => void;
};

interface EntitlementGateCopy {
  title: string;
  description: string;
}

export function useEntitlementGate(
  feature: EntitlementFeature,
  { surface }: { surface: EntitlementGateSurface },
) {
  const overlay = useOverlay();
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const getCopy = useEntitlementGateCopy();

  return useMemo(() => {
    const open = (
      target: EntitlementFeature,
      decision: BlockedDecision,
      trigger: LimitReachedTrigger,
      { onSubscribe, title, description, alternativeAction }: EntitlementGateDialogOptions = {},
    ) => {
      const latest = getCachedEntitlements(queryClient) ?? snapshot;
      const copy = getCopy(target, latest);
      const analyticsFeature = getPremiumGateAnalyticsFeature(target);
      const isLimitReached = decision === 'limit-reached';
      if (isLimitReached) {
        trackEvent('limit_reached_shown', { feature: analyticsFeature, surface, trigger });
      }

      // 프리미엄·관리자가 공정 사용 한도에 닿으면 구독을 권하지 않고 언제 다시 쓸 수 있는지만 알린다
      if (!EntitlementPolicy.shouldOfferPremium(latest)) {
        toast.warning(title ?? copy.title, { description: copy.refill ?? undefined });
        return;
      }

      trackEvent('premium_gate_shown', { feature: analyticsFeature, surface });
      overlay.open(({ isOpen, close, unmount }) => (
        <PremiumDialog
          title={title ?? copy.title}
          description={description ?? copy.description}
          alternativeAction={alternativeAction}
          isOpen={isOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              close();
              unmount();
            }
          }}
          onSubscribe={() => {
            trackEvent('premium_gate_cta_tapped', { feature: analyticsFeature, surface });
            if (isLimitReached) {
              trackEvent('limit_reached_cta_tapped', { feature: analyticsFeature, surface });
            }
            onSubscribe?.();
            router.navigate('/settings/subscription');
          }}
        />
      ));
    };

    return {
      /** 시작하기 전에 확인한다. 막혔으면 안내를 띄우고 true다(멈춘다). 스냅샷을 아직 모르면 서버에 맡긴다 */
      promptIfBlocked: (options?: EntitlementGateDialogOptions): boolean => {
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
      promptLimit: (options?: EntitlementGateDialogOptions) => {
        open(feature, 'limit-reached', 'precheck', options);
      },
      /** 서버가 한도·프리미엄 전용으로 막은 오류면 안내를 띄우고 true다(멈춘다). 그 밖의 오류는 부른 쪽이 처리한다 */
      promptIfBlockedError: (error: unknown, options?: EntitlementGateDialogOptions): boolean => {
        const limited = findLimitedFeature(error);
        if (limited == null) {
          return false;
        }
        if (limited.featureQuota != null) {
          setFeatureQuota(queryClient, limited.featureQuota);
        }
        open(
          limited.feature,
          EntitlementPolicy.getBlockedDecision(limited.feature, limited.featureQuota),
          'server',
          options,
        );
        return true;
      },
    };
  }, [feature, surface, snapshot, overlay, toast, trackEvent, queryClient, getCopy]);
}

function useEntitlementGateCopy() {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const getRefill = useFormatRefillSentence();

  return useCallback(
    (
      feature: EntitlementFeature,
      snapshot: EntitlementSnapshot | undefined,
    ): EntitlementGateCopy & { refill: string | null } => {
      const formatAmount = (value: number) => formatCount(value, dateFormatContext.locale);
      const premium = getPremiumBenefitAmounts();

      const withRefill = (premiumBenefit: string) => {
        const refill = getRefill(snapshot, feature);
        return {
          description: refill == null ? premiumBenefit : `${refill} ${premiumBenefit}`,
          refill,
        };
      };

      return match(feature)
        .with('AI_PARSE', () => ({
          title: t('gate.aiParseTitle'),
          ...withRefill(
            t('gate.aiParsePremium', {
              amount: formatAmount(premium.aiParse),
            }),
          ),
        }))
        .with('VOICE_NOTE', () => ({
          title: t('gate.voiceNoteTitle'),
          ...withRefill(
            t('gate.voiceNotePremium', {
              amount: formatAmount(premium.voiceNote),
              minutes: formatAmount(premium.voiceNoteMinutes),
            }),
          ),
        }))
        .with('NUDGE', () => ({
          title: t('gate.nudgeTitle'),
          ...withRefill(t('gate.nudgePremium')),
        }))
        .with('CHEER', () => ({
          title: t('gate.cheerTitle'),
          ...withRefill(t('gate.cheerPremium')),
        }))
        .with('FRIEND', () => ({
          title: t('gate.friendTitle'),
          ...withRefill(t('gate.friendPremium')),
        }))
        .with('TODO_CATEGORY', () => ({
          title: t('gate.categoryTitle'),
          ...withRefill(
            t('gate.categoryPremium', {
              amount: formatAmount(premium.category),
            }),
          ),
        }))
        .with('AI_REPORT', () => ({
          title: t('gate.aiReportTitle'),
          description: t('gate.aiReportDescription'),
          refill: null,
        }))
        .with('AI_SUGGESTION', () => ({
          title: t('gate.aiSuggestionTitle'),
          description: t('gate.aiSuggestionDescription'),
          refill: null,
        }))
        .with('CUSTOM_REMINDER_TIME', () => ({
          title: t('gate.reminderTimeTitle'),
          description: t('gate.reminderTimeDescription'),
          refill: null,
        }))
        .with('APP_ICON', () => ({
          title: t('gate.appIconTitle'),
          description: t('gate.appIconDescription'),
          refill: null,
        }))
        .exhaustive();
    },
    [t, dateFormatContext, getRefill],
  );
}
