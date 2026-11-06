import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { toPremiumBenefitAmounts } from '@src/features/billing/subscription/utils/plan-benefit.view-model';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { useQuery } from '@tanstack/react-query';

export function useVoiceNoteRecordLimit() {
  const { t } = useTranslation('voiceNote');
  const toast = useAppToast();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });
  const maxSeconds =
    snapshot == null ? null : EntitlementPolicy.getMaxSeconds(snapshot, 'VOICE_NOTE');

  const notifyLimit = ({ hasText, finish }: { hasText: boolean; finish: () => void }) => {
    const minutes = Math.round((maxSeconds ?? 0) / 60);
    if (snapshot != null && EntitlementPolicy.hasFullAccess(snapshot)) {
      if (hasText) {
        toast.warning(t('limit.premium', { minutes }));
      }
      finish();
      return;
    }
    const { voiceNoteMinutes: premiumMinutes } = toPremiumBenefitAmounts();
    gate.showLimit({
      title: t('limit.title', { minutes }),
      description: hasText
        ? t('limit.description', { premiumMinutes })
        : t('limit.descriptionEmpty', { premiumMinutes }),
      alternativeAction: hasText ? { label: t('limit.summarize'), onPress: finish } : undefined,
    });
  };

  return {
    maxSeconds,
    limitMs: maxSeconds == null ? null : maxSeconds * 1_000,
    notifyLimit,
  };
}
