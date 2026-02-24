import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { getCalendarRange, getWeekRange, WEEKDAY_LABELS } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { useMemo, useState } from 'react';
import { match } from 'ts-pattern';
import type { CompletionsByDate } from '../../queries/get-daily-completions-query-options';
import { getDailyCompletionsQueryOptions } from '../../queries/get-daily-completions-query-options';
import { CalendarHeaderText } from './CalendarHeaderText';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekView } from './CalendarWeekView';
import type { CalendarViewMode } from './calendar.types';

interface CalendarProps {
  value: Date;
  onChange: (date: Date) => void;
  showCompletions?: boolean;
}

const EMPTY_COMPLETIONS: CompletionsByDate = {};

export function Calendar({ value, onChange, showCompletions = true }: CalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  const { rangeStart, rangeEnd } = useMemo(
    () =>
      match(viewMode)
        .with('week', () => getWeekRange(value))
        .with('month', () => getCalendarRange(value))
        .exhaustive(),
    [viewMode, value],
  );

  const { data } = useQuery({
    ...getDailyCompletionsQueryOptions(rangeStart, rangeEnd),
    enabled: showCompletions,
  });

  const completions = (showCompletions && data) || EMPTY_COMPLETIONS;

  return (
    <VStack className="bg-background">
      <HStack className="px-4 py-2" justify="between" align="center">
        <CalendarHeaderText viewMode={viewMode} displayDate={value} />
        <HStack gap={8} align="center">
          <CalendarViewModeToggle value={viewMode} onChange={setViewMode} />
          <CalendarNavigation viewMode={viewMode} value={value} onChange={onChange} />
        </HStack>
      </HStack>

      {match(viewMode)
        .with('week', () => (
          <CalendarWeekView value={value} onChange={onChange} completions={completions} />
        ))
        .with('month', () => (
          <CalendarMonthView value={value} onChange={onChange} completions={completions} />
        ))
        .exhaustive()}
    </VStack>
  );
}

Calendar.Loading = function Loading() {
  return (
    <VStack className="bg-background" gap={8}>
      <HStack className="px-4 py-2" justify="between" align="center">
        <Skeleton className="h-6 w-24" />
        <HStack gap={8}>
          <Skeleton className="h-8 w-12 rounded-full" />
          <Skeleton className="h-8 w-12 rounded-full" />
        </HStack>
      </HStack>

      <HStack px={8}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={`weekday-skeleton-${label}`} className="flex-1 items-center py-2">
            <Skeleton className="size-4" />
          </Box>
        ))}
      </HStack>

      <HStack px={8}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={`date-skeleton-${label}`} className="flex-1 items-center py-2">
            <Skeleton className="size-8 overflow-hidden rounded-2xl" />
          </Box>
        ))}
      </HStack>
    </VStack>
  );
};
