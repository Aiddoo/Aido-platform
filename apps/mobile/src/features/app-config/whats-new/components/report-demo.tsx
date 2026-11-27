import {
  selectTimeFormat,
  useGetPreferenceQueryOptions,
} from '@src/features/identity/preference/queries/preference.queries';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { CompletionHourChart } from '@src/features/insights/report/components/completion-hour-chart';
import { CompletionRateHeadline } from '@src/features/insights/report/components/completion-rate-headline';
import { ThisWeekRecordChart } from '@src/features/insights/report/components/this-week-record-chart';
import {
  type AiReport,
  type DailyCompletion,
  ReportPolicy,
} from '@src/features/insights/report/domains/report.model';
import { HOURS_PER_DAY } from '@src/shared/constants/time-units';
import { addDaysToDateKey, dateKeySchema } from '@src/shared/date/date-key';
import { formatHourLabel } from '@src/shared/date/format/date-format';
import { toInstant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, DashedDivider, ScallopedContainer, Text, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { useState } from 'react';

import { DEMO_SCRIPT_MS } from '../constants/release-1-16-0.constants';
import { useDemoScript } from '../hooks/use-demo-script';
import { WhatsNewStep } from './whats-new-step';

/** 지난주 주간 리포트다. 날짜를 고정해 연·주차가 기간과 맞는다 */
const DEMO_REPORT = {
  year: 2026,
  period: 46,
  startDate: dateKeySchema.parse('2026-11-09'),
  endDate: dateKeySchema.parse('2026-11-15'),
  generatedAt: toInstant('2026-11-15T15:00:00.000Z'),
  stats: {
    totalTodos: 32,
    completedTodos: 25,
    completionRate: 78,
    prevCompletionRate: 66,
    streakDays: 7,
    perfectDays: 2,
  },
  dailyCompletions: [
    { total: 5, completed: 4 },
    { total: 6, completed: 6 },
    { total: 4, completed: 3 },
    { total: 5, completed: 5 },
    { total: 6, completed: 4 },
    { total: 3, completed: 2 },
    { total: 3, completed: 1 },
  ],
  timePatterns: [
    { hour: 7, count: 6 },
    { hour: 8, count: 4 },
    { hour: 9, count: 2 },
    { hour: 12, count: 3 },
    { hour: 13, count: 1 },
    { hour: 18, count: 2 },
    { hour: 21, count: 5 },
    { hour: 22, count: 2 },
  ],
  peakHour: 7,
} as const;

/** 무료로 보는 이번 주 기록이다. 목요일을 오늘로 두어 금·토·일은 아직 오지 않은 날로 보인다 */
const DEMO_THIS_WEEK = {
  todayKey: dateKeySchema.parse('2026-11-19'),
  completionsByDate: {
    '2026-11-16': { totalTodos: 4, completedTodos: 3 },
    '2026-11-17': { totalTodos: 5, completedTodos: 5 },
    '2026-11-18': { totalTodos: 3, completedTodos: 2 },
    '2026-11-19': { totalTodos: 4, completedTodos: 1 },
  },
} as const;

const DEMO_REPORT_DAYS: DailyCompletion[] = DEMO_REPORT.dailyCompletions.map((day, offset) => ({
  ...day,
  date: addDaysToDateKey(DEMO_REPORT.startDate, offset),
}));

export function ReportSummaryDemo() {
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
            {/* 예시라 막대를 눌러도 지표를 남기지 않는다 */}
            <ActivityReport.DailyCompletions
              reportType="WEEKLY"
              dailyCompletions={DEMO_REPORT_DAYS}
            />
          </Box>
        </VStack>
      </ScallopedContainer>
    </WhatsNewStep.Stage>
  );
}

export function ReportHoursDemo() {
  const report = useDemoReport();

  const { peakHour } = report;

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

/** 무료 사용자도 보는 이번 주 기록이다. AI 분석은 프리미엄이라는 설명은 장면 문구가 한다 */
export function FreeRecordDemo() {
  const { t } = useTranslation('ai');

  return (
    <WhatsNewStep.Stage>
      <ScallopedContainer>
        <Box className="px-4 py-2">
          <VStack gap={16}>
            <Text size="b3" weight="semibold" shade={9}>
              {t('report.thisWeek.title')}
            </Text>
            {/* 예시라 막대를 눌러도 지표를 남기지 않는다 */}
            <ThisWeekRecordChart
              completionsByDate={DEMO_THIS_WEEK.completionsByDate}
              todayKey={DEMO_THIS_WEEK.todayKey}
              accessibilityLabel={t('report.thisWeek.title')}
            />
          </VStack>
        </Box>
      </ScallopedContainer>
    </WhatsNewStep.Stage>
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

  const timeFormat = selectTimeFormat(preference);
  const selectedHour = touchedHour ?? (peakShownCount === 0 ? null : peakHour);
  const hourlyCounts = ReportPolicy.getHourlyCompletionCounts(report);
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
    peakHour: DEMO_REPORT.peakHour,
    dailyCompletions: [...DEMO_REPORT_DAYS],
    aiSummary: t('v1_16_0.demo.coach.summary'),
    aiTips: [t('v1_16_0.demo.coach.tips.morning'), t('v1_16_0.demo.coach.tips.evening')],
    aiContentSource: 'AI',
    hasActivity: true,
    generatedAt: DEMO_REPORT.generatedAt,
  };
}
