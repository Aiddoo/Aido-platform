import { useHaptics } from '@src/bootstrap/providers/di-context';
import {
  findErrorFeatureQuota,
  isNotChargedError,
} from '@src/features/billing/subscription/apis/entitlement.mapper';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { setFeatureQuota } from '@src/features/billing/subscription/queries/entitlement-cache';
import type { EntitlementFeature } from '@src/features/billing/subscription/schemas/entitlement.schema';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { markAiDataSharingConsentRequired } from '@src/features/identity/consent/queries/consent-cache';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import type { EntitlementGateSurface } from '@src/shared/observability/telemetry-keys';
import { useQueryClient } from '@tanstack/react-query';

import type { VoicePlanSource } from '../domains/voice-plan.model';
import { getVoicePlanFailureCause } from '../domains/voice.error';
import { toAnalyticsSource } from '../utils/analytics/voice-plan-analytics';

export function usePlanFailureHandler(
  feature: Extract<EntitlementFeature, 'AI_PARSE' | 'VOICE_NOTE'>,
  {
    surface,
    onSubscribe,
    showsFailureInline = false,
  }: {
    surface: EntitlementGateSurface;
    onSubscribe?: () => void;
    /** 화면이 실패를 직접 보여 주면 토스트를 띄우지 않는다. 한 오류는 한 곳에서만 보인다 */
    showsFailureInline?: boolean;
  },
) {
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const gate = useEntitlementGate(feature, { surface });

  return (error: unknown, source: VoicePlanSource) => {
    // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
    if (isAiDataSharingConsentRequiredError(error)) {
      markAiDataSharingConsentRequired(queryClient);
      return;
    }

    const cause = getVoicePlanFailureCause(error);
    trackEvent('voice_plan_failed', { source: toAnalyticsSource(source), cause });
    haptics.notify('error');

    if (gate.handleError(error, { onSubscribe })) {
      return;
    }

    const featureQuota = findErrorFeatureQuota(error);
    if (featureQuota != null) {
      setFeatureQuota(queryClient, featureQuota);
    }

    if (showsFailureInline) {
      return;
    }

    // 서버가 환불까지 끝냈다고 알린 오류에만 "차감되지 않아요"를 보여 준다
    toast.error(t(`voicePlan:failure.${cause}.title`), {
      description: isNotChargedError(error)
        ? `${t(`voicePlan:failure.${cause}.description`)} ${t('subscription:gate.notCharged')}`
        : t(`voicePlan:failure.${cause}.description`),
    });
  };
}
