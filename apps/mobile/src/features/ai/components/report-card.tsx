import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, VStack, DashedDivider, Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/format';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Chip, PressableFeedback, SkeletonGroup } from 'heroui-native';

import { REPORT_TYPE_CHIP_COLORS, REPORT_TYPE_LABEL_KEYS } from '../constants/report-type';
import { SAMPLE_REPORT_IDS } from '../constants/sample-reports';
import type { AiReport } from '../domains/ai.model';

const LOADING_CARD_COUNT = 3;

interface ReportCardProps {
  report: AiReport;
  isSample?: boolean;
  isLast?: boolean;
}

export function ReportCard({ report, isSample, isLast = false }: ReportCardProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');
  const reportId = isSample ? SAMPLE_REPORT_IDS[report.type] : String(report.id);

  return (
    <PressableFeedback
      onPress={() => push({ pathname: '/reports/[id]', params: { id: reportId } })}
      className="rounded-xl"
    >
      <PressableFeedback.Highlight className="rounded-xl" />
      <Box className={cn('py-3', !report.hasActivity && 'opacity-50')}>
        <VStack gap={10}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              {isSample && (
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>{t('report.sampleBadge')}</Chip.Label>
                </Chip>
              )}
              <Chip size="sm" variant="soft" color={REPORT_TYPE_CHIP_COLORS[report.type]}>
                <Chip.Label>{t(REPORT_TYPE_LABEL_KEYS[report.type])}</Chip.Label>
              </Chip>
            </HStack>

            <Text size="b4" shade={7}>
              {report.periodLabel}
            </Text>
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

ReportCard.Loading = function Loading() {
  return (
    <VStack>
      {times(LOADING_CARD_COUNT, (i) => (
        <Box key={i} className="py-3">
          <SkeletonGroup isLoading>
            <VStack gap={10}>
              <HStack justify="between" align="center">
                <SkeletonGroup.Item className="h-6 w-12 rounded-full" />
                <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
              </HStack>
              <HStack gap={20}>
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
                <SkeletonGroup.Item className="h-10 w-16 rounded-md" />
              </HStack>
              <SkeletonGroup.Item className="h-4 w-full rounded-md" />
              <Box className="items-end">
                <SkeletonGroup.Item className="h-3 w-16 rounded-md" />
              </Box>
            </VStack>
          </SkeletonGroup>
          {i < LOADING_CARD_COUNT - 1 && <DashedDivider className="mt-3" />}
        </Box>
      ))}
    </VStack>
  );
};
