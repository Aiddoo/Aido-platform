import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { CompletionHourChart } from '@src/features/insights/report/components/completion-hour-chart';
import { CompletionRateHeadline } from '@src/features/insights/report/components/completion-rate-headline';
import { DailyCompletionChart } from '@src/features/insights/report/components/daily-completion-chart';
import { type AiReport, ReportPolicy } from '@src/features/insights/report/domains/report.model';
import { getHourlyCompletionCounts } from '@src/features/insights/report/utils/report-chart.view-model';
import {
  getWeeklyRecordDays,
  type WeeklyRecordDay,
} from '@src/features/insights/report/utils/weekly-record.view-model';
import { HOURS_PER_DAY } from '@src/shared/constants/time-units';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { formatDateKeyLabel, formatHourLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  DashedDivider,
  HStack,
  LabelChip,
  LockIcon,
  ScallopedContainer,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { DEMO_REPORT, DEMO_SCRIPT_MS, DEMO_THIS_WEEK } from '../constants/release-1-16-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { WhatsNewStep } from './whats-new-step';

const LOCK_ICON_SIZE = 16;

const DEMO_REPORT_DAYS: readonly WeeklyRecordDay[] = DEMO_REPORT.dailyCompletions.map(
  (day, offset) => ({
    ...day,
    date: addDaysToDateKey(DEMO_REPORT.startDate, offset),
    isUpcoming: false,
  }),
);

export function ReportSummaryDemo() {
  const { t } = useTranslation('ai');

  const report = useDemoReport();

  return (
    <WhatsNewStep.Stage>
      <ScallopedContainer>
        <VStack className="px-5">
          <Box className="py-4">
            <CompletionRateHeadline report={report} />
          </Box>
          <DashedDivider />
          <Box className="py-4">
            <DemoDailyCompletions
              title={t('report.detail.dailyCompletions')}
              days={DEMO_REPORT_DAYS}
            />
          </Box>
        </VStack>
      </ScallopedContainer>
    </WhatsNewStep.Stage>
  );
}

export function ReportHoursDemo() {
  const report = useDemoReport();

  const peakHour = ReportPolicy.getPeakHour(report);

  return (
    <WhatsNewStep.Stage>
      <ScallopedContainer>
        <VStack className="px-5">
          {peakHour != null && (
            <Box className="py-4">
              <DemoCompletionHours report={report} peakHour={peakHour} />
            </Box>
          )}
          <Box className="py-4">
            <ActivityReport.Coach report={report} />
          </Box>
        </VStack>
      </ScallopedContainer>
    </WhatsNewStep.Stage>
  );
}

export function FreeRecordDemo() {
  const { t } = useTranslation(['ai', 'subscription']);
  const fontScaledSize = useFontScaledSize();

  return (
    <WhatsNewStep.Stage>
      <ScallopedContainer>
        <VStack gap={16} className="px-4 py-2">
          <DemoDailyCompletions
            title={t('ai:report.thisWeek.title')}
            days={getWeeklyRecordDays(DEMO_THIS_WEEK.completionsByDate, DEMO_THIS_WEEK.todayKey)}
          />

          <VStack gap={12} className="rounded-2xl bg-gray-1 p-4">
            <HStack align="center" gap={6}>
              <LabelChip
                color="accent"
                label={t('subscription:tier.premium')}
                labelProps={{ weight: 'semibold', numberOfLines: 1 }}
                pointerEvents="none"
              />
              <LockIcon
                width={fontScaledSize(LOCK_ICON_SIZE)}
                height={fontScaledSize(LOCK_ICON_SIZE)}
                colorClassName="text-gray-5"
              />
            </HStack>
            <VStack
              gap={8}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Box className="h-6 w-40 rounded-md bg-gray-3" />
              <Box className="h-4 w-full rounded-md bg-gray-2" />
              <Box className="h-4 w-4/5 rounded-md bg-gray-2" />
            </VStack>
            <Text size="b4" shade={7}>
              {t('ai:report.list.lockDescription')}
            </Text>
          </VStack>
        </VStack>
      </ScallopedContainer>
    </WhatsNewStep.Stage>
  );
}

interface DemoDailyCompletionsProps {
  title: string;
  days: readonly WeeklyRecordDay[];
}

/** 리포트의 날마다 끝낸 할 일·무료 이번 주 기록과 같은 모양이다. 예시라 막대를 눌러도 지표를 남기지 않는다 */
function DemoDailyCompletions({ title, days }: DemoDailyCompletionsProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedDay = selectedIndex == null ? null : days[selectedIndex];
  const valueLine = match(selectedDay)
    .with(undefined, null, () => t('report.detail.dailyHint'))
    .when(
      (day) => day.isUpcoming,
      (day) =>
        t('report.thisWeek.dayUpcoming', {
          date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        }),
    )
    .when(
      (day) => day.total === 0,
      (day) =>
        t('report.detail.dayEmpty', {
          date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        }),
    )
    .otherwise((day) =>
      t('report.detail.dayCompletions', {
        date: formatDateKeyLabel(day.date, 'monthDay', dateFormatContext),
        completed: day.completed,
        total: day.total,
      }),
    );

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {title}
      </Text>
      <VStack gap={8}>
        <DailyCompletionChart
          values={days}
          labels={days.map((day) => formatDateKeyLabel(day.date, 'weekday', dateFormatContext))}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          accessibilityLabel={title}
          accessibilityValue={{ text: valueLine }}
        />
        <Text size="b4" shade={7} className="tabular-nums">
          {valueLine}
        </Text>
      </VStack>
    </VStack>
  );
}

interface DemoCompletionHoursProps {
  report: AiReport;
  peakHour: number;
}

/** 리포트의 주로 끝낸 시간과 같은 모양이다. 장면이 나타나면 가장 많이 끝낸 칸을 고른다 */
function DemoCompletionHours({ report, peakHour }: DemoCompletionHoursProps) {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();

  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  const [touchedHour, setTouchedHour] = useState<number | null>(null);

  const peakShownCount = useDemoScript({
    frameCount: 1,
    frameMs: 0,
    startDelayMs: DEMO_SCRIPT_MS.peakHourSelectDelay,
  });

  const timeFormat = preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT;
  const selectedHour = touchedHour ?? (peakShownCount === 0 ? null : peakHour);
  const hourlyCounts = getHourlyCompletionCounts(report);
  const hourLabels = range(HOURS_PER_DAY).map((hour) =>
    formatHourLabel(hour, timeFormat, dateFormatContext),
  );
  const valueLine =
    selectedHour == null
      ? t('report.detail.peakHour', {
          hour: formatHourLabel(peakHour, timeFormat, dateFormatContext),
        })
      : t('report.detail.hourCompletions', {
          hour: formatHourLabel(selectedHour, timeFormat, dateFormatContext),
          count: hourlyCounts[selectedHour] ?? 0,
        });

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('report.detail.completionHours')}
      </Text>
      <VStack gap={8}>
        <CompletionHourChart
          values={hourlyCounts}
          labels={hourLabels}
          selectedIndex={selectedHour}
          onSelectedIndexChange={setTouchedHour}
          accessibilityLabel={t('report.detail.completionHours')}
          accessibilityValue={{ text: valueLine }}
        />
        <Text size="b4" shade={7} className="tabular-nums">
          {valueLine}
        </Text>
      </VStack>
    </VStack>
  );
}

/** 머리말·코치 카드는 통계와 AI 글만 읽어 id는 모델 모양만 맞춘다. 글은 앱 언어로 카탈로그에서 가져온다 */
function useDemoReport(): AiReport {
  const { t } = useTranslation('whatsNew');

  return {
    id: 0,
    type: 'WEEKLY',
    year: DEMO_REPORT.year,
    period: DEMO_REPORT.period,
    dateRange: { startDate: DEMO_REPORT.startDate, endDate: DEMO_REPORT.endDate },
    stats: DEMO_REPORT.stats,
    categoryBreakdown: [],
    timePatterns: [...DEMO_REPORT.timePatterns],
    dailyCompletions: [...DEMO_REPORT_DAYS],
    aiSummary: t('v1_16_0.demo.coach.summary'),
    aiTips: [t('v1_16_0.demo.coach.tips.morning'), t('v1_16_0.demo.coach.tips.evening')],
    aiContentSource: 'AI',
    hasActivity: true,
    generatedAt: DEMO_REPORT.generatedAt,
  };
}
