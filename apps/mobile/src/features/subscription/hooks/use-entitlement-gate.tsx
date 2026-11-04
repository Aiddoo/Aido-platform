import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import type {
  EntitlementGateSurface,
  LimitReachedTrigger,
} from '@src/shared/observability/telemetry-keys';
import { PremiumDialog, type PremiumDialogProps, useOverlay } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';

import { findLimitedFeature, type LimitedFeature } from '../apis/entitlement.mapper';
import {
  type EntitlementFeature,
  EntitlementPolicy,
  type EntitlementSnapshot,
} from '../domains/entitlement.model';
import { getCachedEntitlements, setFeatureQuota } from '../queries/entitlement-cache';
import { useGetEntitlementsQueryOptions } from '../queries/get-entitlements-query-options';
import { getPremiumGateAnalyticsFeature } from '../utils/analytics/premium-gate-feature';
import { subscriptionHref } from '../utils/navigation/subscription-href';
import { toPremiumBenefitAmounts } from '../utils/view-models/plan-benefit.view-model';
import { useRefillSentence } from './use-refill-sentence';

type BlockedDecision = 'limit-reached' | 'locked';

export type EntitlementGateDialogOptions = Partial<
  Pick<PremiumDialogProps, 'title' | 'description' | 'alternativeAction'>
> & {
  /** 구독 화면으로 가기 직전에 부른다(예: 열려 있던 시트 닫기) */
  onSubscribe?: () => void;
};

interface EntitlementGateCopy {
  title: string;
  description: string;
}

/**
 * 한도·프리미엄 안내의 단일 진입점. 시작 전에는 스냅샷으로(`guard`), 서버가 막으면 오류 코드로(`handleError`)
 * 같은 `PremiumDialog`를 띄운다. 문구는 기능별로 한 줄씩 정하고 숫자는 서버 스냅샷과 PLAN_CATALOG에서 읽는다.
 */
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
      if (latest != null && EntitlementPolicy.hasFullAccess(latest)) {
        toast.warning(title ?? copy.title, { description: copy.refill ?? undefined });
        return;
      }

      trackEvent('premium_gate_shown', { feature: analyticsFeature, surface });
      overlay
        .open(({ isOpen, close, exit }) => (
          <PremiumDialog
            title={title ?? copy.title}
            description={description ?? copy.description}
            alternativeAction={alternativeAction}
            isOpen={isOpen}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                close();
                exit();
              }
            }}
            onSubscribe={() => {
              trackEvent('premium_gate_cta_tapped', { feature: analyticsFeature, surface });
              if (isLimitReached) {
                trackEvent('limit_reached_cta_tapped', { feature: analyticsFeature, surface });
              }
              onSubscribe?.();
              router.navigate(subscriptionHref());
            }}
          />
        ))
        .catch(() => undefined);
    };

    return {
      /** 시작하기 전에 확인한다. 막혔으면 안내를 띄우고 false다. 스냅샷을 아직 모르면 서버에 맡긴다 */
      guard: (options?: EntitlementGateDialogOptions): boolean => {
        if (snapshot == null) {
          return true;
        }
        return match(EntitlementPolicy.getAccessDecision(snapshot, feature))
          .with('allow', () => true)
          .with('limit-reached', 'locked', (decision) => {
            open(feature, decision, 'precheck', options);
            return false;
          })
          .exhaustive();
      },
      /** 서버가 한도·프리미엄 전용으로 막은 오류면 안내를 띄우고 true다. 그 밖의 오류는 부른 쪽이 처리한다 */
      handleError: (error: unknown, options?: EntitlementGateDialogOptions): boolean => {
        const limited = findLimitedFeature(error);
        if (limited == null) {
          return false;
        }
        if (limited.featureQuota != null) {
          setFeatureQuota(queryClient, limited.featureQuota);
        }
        open(limited.feature, getBlockedDecision(limited), 'server', options);
        return true;
      },
    };
  }, [feature, surface, snapshot, overlay, toast, trackEvent, queryClient, getCopy]);
}

function getBlockedDecision({ feature, featureQuota }: LimitedFeature): BlockedDecision {
  if (featureQuota != null) {
    return featureQuota.allowed ? 'limit-reached' : 'locked';
  }
  return PLAN_CATALOG[feature].kind === 'flag' ? 'locked' : 'limit-reached';
}

/** 기능별 한도·프리미엄 안내 문구. 경우마다 한 줄씩 두어 문구 하나만 고쳐도 되게 한다 */
function useEntitlementGateCopy() {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const getRefill = useRefillSentence();

  return useCallback(
    (
      feature: EntitlementFeature,
      snapshot: EntitlementSnapshot | undefined,
    ): EntitlementGateCopy & { refill: string | null } => {
      const formatAmount = (value: number) => formatCount(value, dateFormatContext.locale);
      const premium = toPremiumBenefitAmounts();

      const getRefillSentence = () => getRefill(snapshot, feature);

      const withRefill = (premiumBenefit: string) => {
        const refill = getRefillSentence();
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
