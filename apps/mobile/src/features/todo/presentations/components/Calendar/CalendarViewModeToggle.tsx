import { Chip } from 'heroui-native';

import type { CalendarViewMode } from './calendar.types';

interface CalendarViewModeToggleProps {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}

export const CalendarViewModeToggle = ({ value, onChange }: CalendarViewModeToggleProps) => {
  const handleToggle = () => {
    onChange(value === 'week' ? 'month' : 'week');
  };

  return (
    <Chip size="sm" variant="soft" color="default" onPress={handleToggle} className="my-1">
      <Chip.Label>{value === 'week' ? '주' : '월'}</Chip.Label>
    </Chip>
  );
};
