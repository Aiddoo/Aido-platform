import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { getNowInstant } from '@src/shared/date/instant';
import { useTranslation } from '@src/shared/i18n';
import { AiFilledIcon, Button, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

type VoiceNoteDigestButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  label: string;
};

/**
 * 정리 버튼. 누르기 전에 횟수를 쓴다는 걸 알 수 있게 보조 문구를 함께 보인다(확인 창은 없다).
 * 프리미엄·관리자는 횟수를 세어 보여 줄 일이 없어 숨긴다. 값은 모두 서버 한도다.
 * 한도를 읽는 동안에는 보조 문구 자리를 잡아 늦게 나타나며 아래가 밀리지 않게 한다.
 */
export function VoiceNoteDigestButton({ label, ...buttonProps }: VoiceNoteDigestButtonProps) {
  const { t } = useTranslation('voiceNote');
  const { data: snapshot, isPending } = useQuery(useGetEntitlementsQueryOptions());
  const status =
    snapshot == null
      ? { type: 'untracked' as const }
      : EntitlementPolicy.getQuotaStatus(snapshot, 'VOICE_NOTE', getNowInstant());
  const cost = match(status)
    .with({ type: 'untracked' }, () => null)
    .with({ type: 'remaining' }, ({ count }) => t('digest.cost', { amount: count }))
    .with({ type: 'used-up' }, () => t('digest.usedUp'))
    .exhaustive();

  return (
    <VStack gap={8}>
      <Button {...buttonProps} testID="voice-note-digest">
        {label}
      </Button>
      {cost == null && isPending && <TextSkeleton size="e1" className="mx-auto w-32" />}
      {cost != null && (
        <HStack gap={4} align="center" justify="center">
          <AiFilledIcon width={14} height={14} colorClassName="text-main" />
          <Text size="e1" shade={6} numberOfLines={1} testID="voice-note-digest-cost">
            {cost}
          </Text>
        </HStack>
      )}
    </VStack>
  );
}
