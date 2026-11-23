import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatClockTime, formatDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { ReportStatusPolicy } from '../domains/report-status.model';
import { useReportType } from '../hooks/use-report-type';
import { useGetReportStatusQueryOptions } from '../queries/report.queries';

export function ReportStatusBanner() {
  const { t } = useTranslation('ai');
  const dateFormatContext = useDateFormatContext();
  const now = useMinuteNow();

  const [reportType] = useReportType();
  const [{ data: status }, { data: preference }] = useSuspenseQueries({
    queries: [useGetReportStatusQueryOptions(), useGetPreferenceQueryOptions()],
  });

  const nextReportAt = ReportStatusPolicy.getNextReportAt(status, reportType);
  const time = formatClockTime(nextReportAt, preference.timeFormat, dateFormatContext);
  // 주간은 늘 월요일이라 요일만, 월간은 1일이라 날짜로 쓴다
  const date = formatDateLabel(
    nextReportAt,
    match(reportType)
      .with('WEEKLY', () => 'weekday' as const)
      .with('MONTHLY', () => 'monthDay' as const)
      .exhaustive(),
    dateFormatContext,
  );

  return (
    <Text size="e1" shade={6} numberOfLines={1} className="tabular-nums">
      {match(
        ReportStatusPolicy.getDaysUntilReport(status, reportType, {
          now,
          timezone: dateFormatContext.timezone,
        }),
      )
        .with(0, () => t('report.statusBanner.nextToday', { time }))
        .otherwise((count) => t('report.statusBanner.nextInDays', { count, date, time }))}
    </Text>
  );
}

ReportStatusBanner.Loading = function Loading() {
  return <TextSkeleton size="e1" className="w-48" />;
};

ReportStatusBanner.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return <QueryErrorFallback.Inline message={t('errorBoundary.title')} reset={reset} />;
};
