import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Button, Text, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

type VoiceNoteDigestButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  label: string;
};

/**
 * 정리 버튼. 누르기 전에 횟수를 쓴다는 걸 알 수 있게 보조 문구를 함께 보인다(확인 창은 없다).
 * 프리미엄·관리자는 횟수를 세어 보여 줄 일이 없어 숨긴다. 값은 모두 서버 한도다.
 */
export function VoiceNoteDigestButton({ label, ...buttonProps }: VoiceNoteDigestButtonProps) {
  const { t } = useTranslation('voiceNote');
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const status =
    snapshot == null
      ? { type: 'hidden' as const }
      : EntitlementPolicy.getQuotaStatus(snapshot, 'VOICE_NOTE');
  const cost = match(status)
    .with({ type: 'hidden' }, () => null)
    .with({ type: 'remaining' }, ({ count }) => t('digest.cost', { amount: count }))
    .with({ type: 'used-up' }, () => t('digest.usedUp'))
    .exhaustive();

  return (
    <VStack gap={8}>
      <Button {...buttonProps} testID="voice-note-digest">
        {label}
      </Button>
      {cost != null && (
        <Text size="e1" shade={6} align="center" maxLines={1} testID="voice-note-digest-cost">
          {cost}
        </Text>
      )}
    </VStack>
  );
}
