import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { getWeekStart, WEEKDAY_LABELS } from '@src/shared/utils/date';
import { Skeleton } from 'heroui-native';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { CalendarHeaderText } from './CalendarHeaderText';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarNavigation } from './CalendarNavigation';
import { CalendarViewModeToggle } from './CalendarViewModeToggle';
import { CalendarWeekView } from './CalendarWeekView';
import type { CalendarViewMode } from './calendar.types';

interface CalendarProps {
  value: Date;
  onChange: (date: Date) => void;
}

const CalendarComponent = ({ value, onChange }: CalendarProps) => {
  const initialWeekStart = getWeekStart(value);

  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [displayDate, setDisplayDate] = useState(initialWeekStart);

  const handleSelect = (date: Date) => {
    setDisplayDate(getWeekStart(date));
    onChange(date);
  };

  return (
    <VStack className="bg-background">
      <HStack className="px-4 py-2" justify="between" align="center">
        <HStack gap={8} align="center">
          <CalendarHeaderText viewMode={viewMode} displayDate={displayDate} />
          <CalendarViewModeToggle value={viewMode} onChange={setViewMode} />
        </HStack>
        <CalendarNavigation viewMode={viewMode} value={displayDate} onChange={setDisplayDate} />
      </HStack>

      {match(viewMode)
        .with('week', () => (
          <CalendarWeekView displayDate={displayDate} value={value} onChange={handleSelect} />
        ))
        .with('month', () => (
          <CalendarMonthView displayDate={displayDate} value={value} onChange={handleSelect} />
        ))
        .exhaustive()}
    </VStack>
  );
};

const CalendarLoading = () => {
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
            <Skeleton className="h-4 w-4" />
          </Box>
        ))}
      </HStack>

      <HStack px={8}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={`date-skeleton-${label}`} className="flex-1 items-center py-2">
            <Skeleton className="size-8 rounded-full" />
          </Box>
        ))}
      </HStack>
    </VStack>
  );
};

export const Calendar = Object.assign(CalendarComponent, {
  Loading: CalendarLoading,
});
