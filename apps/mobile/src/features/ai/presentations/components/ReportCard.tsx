import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatPercent } from '@src/shared/utils/format';
import { times } from 'es-toolkit/compat';
import { type Href, useRouter } from 'expo-router';
import { Chip, PressableFeedback, SkeletonGroup } from 'heroui-native';
import { View } from 'react-native';

import type { AiReport } from '../../models/ai.model';

interface ReportCardProps {
  report: AiReport;
  isSample?: boolean;
  isLast?: boolean;
}

export function ReportCard({ report, isSample, isLast = false }: ReportCardProps) {
  const router = useRouter();
  const { t } = useTranslation('ai');
  const href = (
    isSample ? `/reports/sample-${report.type.toLowerCase()}` : `/reports/${report.id}`
  ) as Href;

  return (
    <PressableFeedback onPress={() => router.push(href)} className="rounded-xl">
      <PressableFeedback.Highlight className="rounded-xl" />
      <View className={cn('py-3', !report.hasActivity && 'opacity-50')}>
        <VStack gap={10}>
          <HStack justify="between" align="center">
            <HStack align="center" gap={6}>
              {isSample && (
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>{t('report.sampleBadge')}</Chip.Label>
                </Chip>
              )}
              <Chip
                size="sm"
                variant="soft"
                color={report.type === 'WEEKLY' ? 'accent' : 'success'}
              >
                <Chip.Label>
                  {report.type === 'WEEKLY' ? t('report.typeWeekly') : t('report.typeMonthly')}
                </Chip.Label>
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

          <View className="items-end">
            <TextButton size="small" variant="arrow">
              {t('report.card.viewDetail')}
            </TextButton>
          </View>
        </VStack>
      </View>

      {!isLast && <View className="border-b border-dashed border-gray-3" />}
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
      {times(3, (i) => (
        <View key={i} className="py-3">
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
              <View className="items-end">
                <SkeletonGroup.Item className="h-3 w-16 rounded-md" />
              </View>
            </VStack>
          </SkeletonGroup>
          {i < 2 && <View className="mt-3 border-b border-dashed border-gray-3" />}
        </View>
      ))}
    </VStack>
  );
};
