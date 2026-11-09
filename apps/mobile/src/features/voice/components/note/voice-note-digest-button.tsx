import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useTranslation } from '@src/shared/i18n';
import { AiFilledIcon, Button, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

type VoiceNoteDigestButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  label: string;
};

/** 확인 창 없이 횟수를 쓰므로 보조 문구로 알린다. 프리미엄·관리자는 숨기고, 읽는 동안 자리를 잡아 밀리지 않게 한다 */
export function VoiceNoteDigestButton({ label, ...buttonProps }: VoiceNoteDigestButtonProps) {
  const { t } = useTranslation('voiceNote');
  const { status, isPending } = useQuotaStatus('VOICE_NOTE');
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
