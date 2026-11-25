import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { HStack, LabelChip, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { formatCount, formatPercent } from '@src/shared/utils/number-format';
import type { ReactNode } from 'react';
import { match } from 'ts-pattern';

import { type AiReport, ReportPolicy } from '../domains/report.model';

interface CompletionRateHeadlineProps {
  report: AiReport;
}

export function CompletionRateHeadline({ report }: CompletionRateHeadlineProps) {
  const { t } = useTranslation('ai');
  const { locale } = useDateFormatContext();

  return (
    <VStack gap={2}>
      <Text size="b4" shade={6}>
        {t('report.card.completionRate')}
      </Text>
      {match(ReportPolicy.getHeadline(report))
        .with({ kind: 'noActivity' }, () => (
          <Text size="b2" weight="semibold" shade={7}>
            {t('report.headline.noActivity')}
          </Text>
        ))
        .with({ kind: 'firstReport' }, ({ completionRate }) => (
          <RateRow rate={formatPercent(completionRate, locale)} />
        ))
        .with({ kind: 'improved' }, ({ completionRate, changePoints }) => (
          <RateRow
            rate={formatPercent(completionRate, locale)}
            changeChip={
              <LabelChip
                color="success"
                pointerEvents="none"
                label={t('report.headline.improved', {
                  points: formatCount(changePoints, locale),
                })}
              />
            }
          />
        ))
        .with({ kind: 'declined' }, ({ completionRate, changePoints }) => (
          <RateRow
            rate={formatPercent(completionRate, locale)}
            changeChip={
              <LabelChip
                color="default"
                pointerEvents="none"
                label={t('report.headline.declined', {
                  points: formatCount(changePoints, locale),
                })}
              />
            }
          />
        ))
        .with({ kind: 'unchanged' }, ({ completionRate }) => (
          <RateRow
            rate={formatPercent(completionRate, locale)}
            changeChip={
              <LabelChip
                color="default"
                pointerEvents="none"
                label={t('report.headline.unchanged')}
              />
            }
          />
        ))
        .exhaustive()}
    </VStack>
  );
}

CompletionRateHeadline.Loading = function Loading() {
  return (
    <VStack gap={2}>
      <TextSkeleton size="b4" className="w-12" />
      <TextSkeleton size="h1" className="w-28" />
    </VStack>
  );
};

function RateRow({ rate, changeChip }: { rate: string; changeChip?: ReactNode }) {
  return (
    <HStack align="center" gap={8}>
      <Text size="h1" weight="bold" shade={10} className="tabular-nums">
        {rate}
      </Text>
      {changeChip}
    </HStack>
  );
}
