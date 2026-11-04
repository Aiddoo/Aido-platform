import { QuotaChip } from '@src/features/subscription/components/quota-chip';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useRefillSentence } from '@src/features/subscription/hooks/use-refill-sentence';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { HStack, InfoIcon, MicIcon, Text, VStack } from '@src/shared/ui';
import { toDateFormatLocale } from '@src/shared/utils/date-format';
import { formatCount } from '@src/shared/utils/format';
import { useQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback } from 'heroui-native';
import { useState } from 'react';

/** 시트 툴바의 "AI로 할 일 만들기 ⓘ · N번 남음". ⓘ를 누르면 무엇이 AI인지와 한도를 알려 준다 */
export function QuickVoiceInfo() {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);

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
        <Popover.Portal disableFullWindowOverlay={false}>
          <Popover.Overlay />
          <Popover.Content
            presentation="popover"
            placement="top"
            align="end"
            avoidCollisions={false}
            className="rounded-2xl border border-border px-4 py-3"
          >
            <Popover.Arrow />
            <Popover.Close />
            <QuickVoiceInfo.Contents />
          </Popover.Content>
        </Popover.Portal>
      </Popover>
      <QuotaChip feature="AI_PARSE" />
    </HStack>
  );
}

QuickVoiceInfo.Contents = function Contents() {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const getRefillSentence = useRefillSentence();
  const remaining =
    snapshot == null ? null : EntitlementPolicy.getRemainingCount(snapshot, 'AI_PARSE');
  const refill = getRefillSentence(snapshot, 'AI_PARSE');

  return (
    <VStack gap={8}>
      <VStack gap={4}>
        <HStack gap={4} align="center">
          <MicIcon
            width={fontScaledSize(18)}
            height={fontScaledSize(18)}
            colorClassName="text-main"
          />
          <Text size="b3" weight="semibold" className="shrink">
            {t('info.title')}
          </Text>
        </HStack>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('info.description')}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {t('info.examples')}
        </Text>
      </VStack>
      <VStack gap={2} className="border-t border-border pt-2">
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
