import { useTranslation } from '@src/shared/i18n';
import { AiIcon, HStack, Text, VStack, WordWrapText } from '@src/shared/ui';

import { useQuotaStatus } from '../hooks/use-quota-status';
import { QuotaChip } from './quota-chip';

export function QuotaSummary() {
  const { t } = useTranslation('subscription');
  const aiParse = useQuotaStatus('AI_PARSE');
  const voiceNote = useQuotaStatus('VOICE_NOTE');

  if (aiParse.label == null && voiceNote.label == null) {
    return null;
  }

  return (
    <VStack gap={12} p={16} className="rounded-2xl bg-gray-1" testID="quota-summary">
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
          <WordWrapText size="e1" shade={6}>
            {t('quota.aiParseHint')}
          </WordWrapText>
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
