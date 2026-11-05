import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { toPremiumBenefitAmounts } from '@src/features/subscription/utils/view-models/plan-benefit.view-model';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import { useQuery } from '@tanstack/react-query';

/** 이번 녹음의 길이 한도와, 한도에 닿았을 때의 안내. 프리미엄은 바로 정리로 넘어가고 나머지는 한도 창에서 고른다 */
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
