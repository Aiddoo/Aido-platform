import { formatDateKeyRange } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, VStack, DashedDivider, Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/number-format';
import { router } from 'expo-router';
import { Chip, PressableFeedback } from 'heroui-native';

import { SAMPLE_REPORT_IDS } from '../constants/sample-reports.constants';
import type { AiReport } from '../domains/report.model';
import { formatReportPeriodLabel } from '../utils/report-period.view-model';
import { ReportTypeChip } from './report-type-chip';

interface ReportRowProps {
  report: AiReport;
  isSample?: boolean;
  isLast?: boolean;
}

export function ReportRow({ report, isSample, isLast = false }: ReportRowProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const reportId = isSample ? SAMPLE_REPORT_IDS[report.type] : String(report.id);
  const openReport = () => push({ pathname: '/reports/[reportId]', params: { reportId } });

  return (
    <PressableFeedback onPress={openReport} className="rounded-xl">
      <PressableFeedback.Highlight className="rounded-xl" />
      <Box className={cn('py-3', !report.hasActivity && 'opacity-50')}>
        <VStack gap={10}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              {/* Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 줄이 눌리지 않는다 */}
              {isSample && (
                <Chip size="sm" variant="soft" color="warning" pointerEvents="none">
                  <Text size="e1" weight="medium" tone="warning">
                    {t('report.sampleBadge')}
                  </Text>
                </Chip>
              )}
              <ReportTypeChip type={report.type} pointerEvents="none" />
            </HStack>

            <VStack align="end">
              <Text size="b4" shade={7}>
                {formatReportPeriodLabel(report, dateFormatContext)}
              </Text>
              <Text size="e1" shade={7} className="tabular-nums">
                {formatDateKeyRange(
                  report.dateRange.startDate,
                  report.dateRange.endDate,
                  todayKey,
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

          {report.hasActivity && report.aiSummary.length > 0 && (
            <Text size="b4" shade={7} numberOfLines={2}>
              {report.aiSummary}
            </Text>
          )}

          <Box className="items-end">
            <TextButton size="small" variant="arrow" onPress={openReport}>
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
