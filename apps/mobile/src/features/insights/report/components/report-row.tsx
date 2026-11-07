import { formatDateKeyRange } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, TextSkeleton, VStack, DashedDivider, Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { Chip, PressableFeedback, Skeleton } from 'heroui-native';

import { SAMPLE_REPORT_IDS } from '../constants/sample-reports';
import type { AiReport } from '../schemas/report.schema';
import { ReportTypeChip } from './report-type-chip';

const LOADING_CARD_COUNT = 3;
const LOADING_STAT_COUNT = 3;

interface ReportRowProps {
  report: AiReport;
  isSample?: boolean;
  isLast?: boolean;
}

export function ReportRow({ report, isSample, isLast = false }: ReportRowProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const reportId = isSample ? SAMPLE_REPORT_IDS[report.type] : String(report.id);

  return (
    <PressableFeedback
      onPress={() => push({ pathname: '/reports/[reportId]', params: { reportId } })}
      className="rounded-xl"
    >
      <PressableFeedback.Highlight className="rounded-xl" />
      <Box className={cn('py-3', !report.hasActivity && 'opacity-50')}>
        <VStack gap={10}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              {isSample && (
                <Chip size="sm" variant="soft" color="warning">
                  <Text size="e1" weight="medium" className="text-warning">
                    {t('report.sampleBadge')}
                  </Text>
                </Chip>
              )}
              <ReportTypeChip type={report.type} />
            </HStack>

            <VStack align="end">
              <Text size="b4" shade={7}>
                {report.periodLabel}
              </Text>
              <Text size="e1" shade={7} className="tabular-nums">
                {formatDateKeyRange(
                  report.dateRange.startDate,
                  report.dateRange.endDate,
                  dateFormatContext,
                )}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={20}>
            <StatItem
              label={t('report.card.completionRate')}
              value={`${formatPercent(report.stats.completionRate)}%`}
            />
            <StatItem
              label={t('report.card.completed')}
              value={`${report.stats.completedTodos}/${report.stats.totalTodos}`}
            />
            <StatItem
              label={t('report.card.streak')}
              value={t('report.card.streakDays', { count: report.stats.streakDays })}
            />
          </HStack>

          {report.hasActivity && report.aiSummary && (
            <Text size="b4" shade={7} maxLines={2}>
              {report.aiSummary}
            </Text>
          )}

          <Box className="items-end">
            <TextButton size="small" variant="arrow">
              {t('report.card.viewDetail')}
            </TextButton>
          </Box>
        </VStack>
      </Box>

      {!isLast && <DashedDivider />}
    </PressableFeedback>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap={2} align="center">
      <Text size="e1" shade={6}>
        {label}
      </Text>
      <Text size="b2" weight="bold" shade={9}>
        {value}
      </Text>
    </VStack>
  );
}

ReportRow.Loading = function Loading() {
  return (
    <VStack>
      {range(LOADING_CARD_COUNT).map((i) => (
        <Box key={i} className="py-3">
          <VStack gap={10}>
            <HStack justify="between" align="center">
              <Skeleton className="h-6 w-12 rounded-full" />
              <VStack align="end">
                <TextSkeleton size="b4" className="w-24" />
                <TextSkeleton size="e1" className="w-20" />
              </VStack>
            </HStack>
            <HStack gap={20}>
              {range(LOADING_STAT_COUNT).map((statIndex) => (
                <VStack key={statIndex} gap={2} align="center">
                  <TextSkeleton size="e1" className="w-12" />
                  <TextSkeleton size="b2" className="w-16" />
                </VStack>
              ))}
            </HStack>
            <TextSkeleton size="b4" className="w-full" />
            <Box className="items-end">
              <TextSkeleton size="e1" className="w-16" />
            </Box>
          </VStack>
          {i < LOADING_CARD_COUNT - 1 && <DashedDivider className="mt-3" />}
        </Box>
      ))}
    </VStack>
  );
};
