import type { WeatherRescheduleReason } from '@aido/api/vocabulary';
import { formatHHmmTime, type TimeFormat } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { Controller, type UseFormReturn } from 'react-hook-form';

import type { WeatherForecastTodo } from '../../domains/weather-briefing.model';
import type { WeatherRescheduleOption } from '../../domains/weather-report-briefing.model';
import {
  toSelectionKey,
  type WeatherRescheduleFormValues,
} from '../../schemas/weather-reschedule-form.schema';
import { getRescheduleCopyKeys } from '../../utils/weather-labels.view-model';
import { WeatherRescheduleTimeInput } from './weather-reschedule-time-input';

interface WeatherRescheduleTodoProps {
  form: UseFormReturn<WeatherRescheduleFormValues>;
  todo: WeatherForecastTodo;
  options: WeatherRescheduleOption[];
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
  onExclude: () => void;
}

/** 할 일 하나의 옮길 시각 선택. 기본 선택(추천 시간)은 Controller의 defaultValue로 처음 그릴 때 한 번 정한다. */
export function WeatherRescheduleTodo({
  form,
  todo,
  options,
  reason,
  timeFormat,
  onExclude,
}: WeatherRescheduleTodoProps) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  const [recommended] = options;

  return (
    <VStack gap={8}>
      <HStack align="center" gap={8}>
        <Text size="b2" weight="semibold" className="shrink" numberOfLines={2}>
          {todo.title}
        </Text>
        <Text size="b4" shade={6}>
          {formatHHmmTime(todo.localTime, timeFormat, dateFormat)}
        </Text>
      </HStack>
      {recommended == null ? (
        <Text size="b3" shade={6}>
          {t(getRescheduleCopyKeys(reason).noTime)}
        </Text>
      ) : (
        <Controller
          control={form.control}
          name={`selections.${toSelectionKey(todo.todoId)}`}
          defaultValue={recommended.startsAt}
          render={({ field: { value, onChange } }) => (
            <WeatherRescheduleTimeInput
              value={value}
              onValueChange={onChange}
              options={options}
              reason={reason}
              timeFormat={timeFormat}
            />
          )}
        />
      )}
      <Box className="items-start">
        <TextButton size="small" onPress={onExclude}>
          {t('reschedule.exclude')}
        </TextButton>
      </Box>
    </VStack>
  );
}
