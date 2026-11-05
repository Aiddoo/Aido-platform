import { useTranslation } from '@src/shared/i18n';
import { AiIcon, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

import { useQuotaStatus } from '../hooks/use-quota-status';
import { QuotaChip } from './quota-chip';

type QuotaSummaryProps = Omit<ComponentProps<typeof VStack>, 'children'>;

/** 이번 달 남은 AI 횟수를 한곳에서 본다. 프리미엄·관리자는 셀 일이 없어 그리지 않는다 */
export function QuotaSummary({ className, ...stackProps }: QuotaSummaryProps) {
  const { t } = useTranslation('subscription');
  const aiParse = useQuotaStatus('AI_PARSE');
  const voiceNote = useQuotaStatus('VOICE_NOTE');

  if (aiParse.label == null && voiceNote.label == null) {
    return null;
  }

  return (
    <VStack
      gap={12}
      p={16}
      className={cn('rounded-2xl bg-gray-1', className)}
      testID="quota-summary"
      {...stackProps}
    >
      <HStack gap={6} align="center">
        <AiIcon width={16} height={16} colorClassName="text-main" />
        <Text size="b4" weight="semibold" shade={7}>
          {t('quota.summaryTitle')}
        </Text>
      </HStack>
      <HStack gap={12} align="center">
        <VStack flex={1} gap={2}>
          <Text size="b3" weight="medium">
            {t('quota.aiParse')}
          </Text>
          <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('quota.aiParseHint')}
          </Text>
        </VStack>
        <QuotaChip feature="AI_PARSE" />
      </HStack>
      <HStack gap={12} align="center">
        <Text size="b3" weight="medium" className="flex-1">
          {t('quota.voiceNote')}
        </Text>
        <QuotaChip feature="VOICE_NOTE" />
      </HStack>
    </VStack>
  );
}
