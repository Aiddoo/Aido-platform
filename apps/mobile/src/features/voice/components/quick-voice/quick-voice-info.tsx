import { QuotaChip } from '@src/features/billing/subscription/components/quota-chip';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useFormatRefillSentence } from '@src/features/billing/subscription/hooks/use-format-refill-sentence';
import { useQuotaStatus } from '@src/features/billing/subscription/hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useTranslation } from '@src/shared/i18n';
import { AiFilledIcon, HintPopoverContent, HStack, InfoIcon, Text, VStack } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import { Popover, PressableFeedback, Separator } from 'heroui-native';
import { useState } from 'react';

// oxlint-disable-next-line aido/component-name -- 1.15.2 전환 #1400
export function QuickVoiceInfo() {
  const { t } = useTranslation('voice');
  const fontScaledSize = useFontScaledSize();
  const [isOpen, setIsOpen] = useState(false);
  // 말풍선 내용은 DI·Query provider 바깥의 PortalHost에 그려져 그 안에서 조회할 수 없다
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const formatRefillSentence = useFormatRefillSentence();
  const remaining =
    snapshot == null ? null : EntitlementPolicy.getRemainingCount(snapshot, 'AI_PARSE');
  const refill = formatRefillSentence(snapshot, 'AI_PARSE');
  const { type: quotaType } = useQuotaStatus('AI_PARSE');
  // 팝오버 안은 LocalDateProvider 바깥이라 useDateFormatContext를 쓸 수 없다
  const { intlLocale } = useLocaleContext();

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
              <AiFilledIcon
                width={fontScaledSize(14)}
                height={fontScaledSize(14)}
                colorClassName="text-main"
              />
              <Text size="e2" weight="medium" shade={6} numberOfLines={1} className="shrink">
                {quotaType === 'used-up' ? t('info.typeStillFree') : t('info.label')}
              </Text>
              <InfoIcon
                width={fontScaledSize(16)}
                height={fontScaledSize(16)}
                colorClassName="text-gray-6"
              />
            </HStack>
          </PressableFeedback>
        </Popover.Trigger>
        <HintPopoverContent Icon={AiFilledIcon} title={t('info.title')}>
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
                <Text
                  size="b4"
                  shade={7}
                  className="tabular-nums"
                  lineBreakStrategyIOS="hangul-word"
                >
                  {t('info.remaining', { amount: formatCount(remaining, intlLocale) })}
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
        </HintPopoverContent>
      </Popover>
      {quotaType === 'used-up' ? <UsedUpQuotaChip /> : <QuotaChip feature="AI_PARSE" />}
    </HStack>
  );
}

/** 다 쓴 칩을 누르면 무엇이 막혔고 언제 초기화되는지 막힌 순간과 같은 안내로 답한다 */
function UsedUpQuotaChip() {
  const { t } = useTranslation('voice');
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });

  // Chip이 Pressable이라 바깥에서 감싸면 터치를 받지 못한다. Chip의 onPress를 쓴다
  return (
    <QuotaChip
      feature="AI_PARSE"
      onPress={() => gate.promptLimit()}
      accessibilityRole="button"
      accessibilityHint={t('info.usedUpChipHint')}
    />
  );
}
