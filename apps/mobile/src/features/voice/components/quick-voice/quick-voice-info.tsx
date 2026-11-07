import { QuotaChip } from '@src/features/billing/subscription/components/quota-chip';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useRefillSentence } from '@src/features/billing/subscription/hooks/use-refill-sentence';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { toDateFormatLocale } from '@src/shared/date/date-format';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { AiIcon, HintPopoverContent, HStack, InfoIcon, Text, VStack } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback, Separator } from 'heroui-native';
import { useState } from 'react';

export function QuickVoiceInfo() {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);
  // 말풍선 내용은 DI·Query provider 바깥의 PortalHost에 그려져 그 안에서 조회할 수 없다
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const getRefillSentence = useRefillSentence();

  return (
    <HStack gap={8} align="center">
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <PressableFeedback
            onPress={() => setIsOpen(true)}
            className="items-center justify-center"
            testID="todo-ai-feature-tooltip"
            accessibilityRole="button"
            accessibilityLabel={t('info.label')}
          >
            <HStack gap={4} align="center">
              <AiIcon
                width={fontScaledSize(14)}
                height={fontScaledSize(14)}
                colorClassName="text-main"
              />
              <Text size="e2" weight="medium" shade={6} maxLines={1} className="shrink">
                {t('info.label')}
              </Text>
              <InfoIcon
                width={fontScaledSize(16)}
                height={fontScaledSize(16)}
                colorClassName="text-gray-6"
              />
            </HStack>
          </PressableFeedback>
        </Popover.Trigger>
        <HintPopoverContent icon={AiIcon} title={t('info.title')}>
          <QuickVoiceInfo.Contents
            remaining={
              snapshot == null ? null : EntitlementPolicy.getRemainingCount(snapshot, 'AI_PARSE')
            }
            refill={getRefillSentence(snapshot, 'AI_PARSE')}
          />
        </HintPopoverContent>
      </Popover>
      <QuotaChip feature="AI_PARSE" />
    </HStack>
  );
}

QuickVoiceInfo.Contents = function Contents({
  remaining,
  refill,
}: {
  remaining: number | null;
  refill: string | null;
}) {
  const { t } = useTranslation('voice');
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);

  return (
    <VStack gap={8}>
      <VStack gap={4}>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('info.description')}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('info.examples')}
        </Text>
      </VStack>
      <Separator thickness={1} className="bg-border" />
      <VStack gap={4}>
        {remaining != null && (
          <Text size="b4" shade={7} className="tabular-nums" lineBreakStrategyIOS="hangul-word">
            {t('info.remaining', { amount: formatCount(remaining, locale) })}
          </Text>
        )}
        {refill != null && (
          <Text size="b4" shade={7} lineBreakStrategyIOS="hangul-word">
            {refill}
          </Text>
        )}
        <Text size="b4" shade={7} lineBreakStrategyIOS="hangul-word">
          {t('info.notCharged')}
        </Text>
      </VStack>
    </VStack>
  );
};
