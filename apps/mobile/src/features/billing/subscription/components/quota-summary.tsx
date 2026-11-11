import type { PlanQuotaFeatureKey } from '@aido/api/vocabulary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  AiFilledIcon,
  HStack,
  Meter,
  Text,
  VStack,
  WordWrapText,
  SurfaceCard,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { EntitlementPolicy } from '../domains/entitlement.model';
import { useFormatRefillSentence } from '../hooks/use-format-refill-sentence';
import { useQuotaStatus } from '../hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

interface QuotaSummaryProps {
  action?: ReactNode;
}

export function QuotaSummary({ action }: QuotaSummaryProps) {
  const { t } = useTranslation('subscription');
  const aiParse = useQuotaStatus('AI_PARSE');
  const voiceNote = useQuotaStatus('VOICE_NOTE');

  if (aiParse.label == null && voiceNote.label == null) {
    return null;
  }

  return (
    <SurfaceCard className="gap-4" testID="quota-summary">
      <HStack gap={6} align="center">
        <AiFilledIcon width={16} height={16} colorClassName="text-main" />
        <Text size="b4" weight="semibold" shade={7} className="flex-1">
          {t('quota.summaryTitle')}
        </Text>
        {action}
      </HStack>
      <QuotaRow feature="AI_PARSE" label={t('quota.aiParse')} hint={t('quota.aiParseHint')} />
      <QuotaRow feature="VOICE_NOTE" label={t('quota.voiceNote')} />
    </SurfaceCard>
  );
}

interface QuotaRowProps {
  feature: PlanQuotaFeatureKey;
  label: string;
  hint?: string;
}

/** 막대는 쓴 만큼 찬다. 다 쓴 항목만 주황으로 칠하고 다시 생기는 날을 붙인다 */
function QuotaRow({ feature, label, hint }: QuotaRowProps) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const { type } = useQuotaStatus(feature);
  const formatRefillSentence = useFormatRefillSentence();

  if (snapshot == null || type === 'untracked') {
    return null;
  }
  const used = EntitlementPolicy.getUsedCount(snapshot, feature);
  const limit = EntitlementPolicy.getLimit(snapshot, feature);
  if (used == null || limit == null) {
    return null;
  }

  const isUsedUp = type === 'used-up';
  const refill = isUsedUp ? formatRefillSentence(snapshot, feature) : null;

  return (
    <VStack gap={6}>
      <HStack gap={12} align="center">
        <Text size="b3" weight="medium" className="flex-1">
          {label}
        </Text>
        <Text
          size="b4"
          weight="semibold"
          tone={isUsedUp ? 'brand' : undefined}
          shade={isUsedUp ? undefined : 7}
          className="tabular-nums"
        >
          {t('upsell.usage', {
            used: formatCount(Math.min(used, limit), locale),
            limit: formatCount(limit, locale),
          })}
        </Text>
      </HStack>
      <Meter
        value={used}
        max={limit}
        size="medium"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {refill != null && (
        <Text size="e1" weight="semibold" shade={7}>
          {refill}
        </Text>
      )}
      {hint != null && (
        <WordWrapText size="e1" shade={6}>
          {hint}
        </WordWrapText>
      )}
    </VStack>
  );
}
