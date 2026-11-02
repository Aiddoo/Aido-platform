import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import type { Todo } from '@src/features/todo/domains/todo.model';
import { useGetTodosByDateQueryOptions } from '@src/features/todo/queries/get-todos-by-date-query-options';
import { WeatherAttribution } from '@src/features/weather/components/weather-attribution';
import {
  type RainyTodo,
  type RescheduleOption,
  WeatherBriefingPolicy,
} from '@src/features/weather/domains/weather-briefing.model';
import {
  type HourlyForecast,
  WeatherReportPolicy,
} from '@src/features/weather/domains/weather-report.model';
import {
  toMovedScheduleInput,
  toOriginalScheduleInput,
  toScheduleChanges,
  weatherRescheduleFormSchema,
  type WeatherRescheduleFormValues,
} from '@src/features/weather/domains/weather-reschedule-form.schema';
import {
  rescheduleTodoIdsParamSchema,
  useRescheduleTodoIdsParam,
} from '@src/features/weather/hooks/use-reschedule-todo-ids-param';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '@src/features/weather/queries/get-weather-report-query-options';
import { useRescheduleTodoMutationOptions } from '@src/features/weather/queries/use-reschedule-todo-mutation-options';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useTheme } from '@src/shared/providers/theme-provider';
import {
  BottomSheet,
  Box,
  Button,
  HStack,
  IconRadioItem,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  SheetRouteScreen,
  Spacing,
  Text,
  TextButton,
  TextSkeleton,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { formatClockTime, formatDateKey, type TimeFormat } from '@src/shared/utils/date-format';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import { useMutation, useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { clamp, keyBy } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Chip, RadioGroup, Separator } from 'heroui-native';
import { type ComponentProps, Fragment, Suspense } from 'react';
import { FormProvider, useForm, useFormContext, useFormState } from 'react-hook-form';

const WEATHER_HREF = '/weather';
const CHART_HEIGHT = 40;
const MIN_BAR_HEIGHT = 2;
const LOADING_TODO_COUNT = 2;

export default function WeatherRescheduleSheetRoute() {
  const params = rescheduleTodoIdsParamSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href={WEATHER_HREF} />;
  }
  return (
    <SheetRouteScreen>
      <WeatherRescheduleSheet />
    </SheetRouteScreen>
  );
}

/**
 * 폼은 시트가 소유한다. 주 버튼을 시트 footer에 고정하려면 버튼과 목록이 같은 폼을 봐야 하기 때문이다.
 * 각 할 일의 기본 선택(추천 시간)은 FormField의 defaultValue로 처음 그릴 때 한 번 정한다.
 */
function WeatherRescheduleSheet() {
  const sheet = useSheetRoute(WEATHER_HREF);
  const form = useForm<WeatherRescheduleFormValues>({
    resolver: zodResolver(weatherRescheduleFormSchema),
    defaultValues: { selections: {} },
  });

  return (
    <FormProvider {...form}>
      <BottomSheet
        isOpen={sheet.isOpen}
        onOpenChange={sheet.onOpenChange}
        footer={<RescheduleFooter onDone={() => sheet.close()} />}
      >
        {sheet.isOpen && (
          <QueryErrorBoundary
            fallback={(fallbackProps) => (
              <RescheduleErrorFallback
                {...fallbackProps}
                onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
              />
            )}
          >
            <Suspense fallback={<RescheduleLoading />}>
              <RescheduleContent onEmpty={() => sheet.close()} />
            </Suspense>
          </QueryErrorBoundary>
        )}
      </BottomSheet>
    </FormProvider>
  );
}

function RescheduleContent({ onEmpty }: { onEmpty: () => void }) {
  const { t } = useTranslation('weather');
  const [todoIds, setTodoIds] = useRescheduleTodoIdsParam();
  const [{ data: report, dataUpdatedAt }, { data: todoList }, { data: preference }] =
    useSuspenseQueries({
      queries: [
        { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.briefing },
        useGetTodosByDateQueryOptions({ date: useTodayKey() }),
        useGetPreferenceQueryOptions(),
      ],
    });
  const now = new Date(dataUpdatedAt);
  const todosById = keyBy(todoList.todos, (todo) => todo.id);
  const rainyTodos = WeatherBriefingPolicy.rainyTodos(
    report.hourly,
    todoIds.flatMap((todoId) => {
      const todo = todosById[todoId];
      return todo == null ? [] : [WeatherBriefingPolicy.briefingTodo(todo)];
    }),
    now,
  );

  const handleExclude = (todoId: number) => {
    const remaining = todoIds.filter((id) => id !== todoId);
    if (remaining.length === 0) {
      onEmpty();
      return;
    }
    setTodoIds(remaining);
  };

  if (rainyTodos.length === 0) {
    return <Result title={t('reschedule.todoNotFound')} />;
  }
  return (
    <VStack px={20} pb={8}>
      <Text size="t3" weight="bold">
        {t('reschedule.title')}
      </Text>
      <Spacing size={4} />
      <Text size="b3" shade={6}>
        {t('reschedule.description')}
      </Text>
      <Spacing size={16} />
      <PrecipitationTimeline hours={WeatherReportPolicy.upcomingHours(report.hourly, now)} />
      <Spacing size={16} />
      {rainyTodos.map((todo, index) => (
        <Fragment key={todo.todoId}>
          {index > 0 && <Separator className="my-3" />}
          <RescheduleTodo
            todo={todo}
            options={WeatherBriefingPolicy.rescheduleOptions(report.hourly, todo, {
              now,
              timeZone: getDeviceTimezone(),
            })}
            timeFormat={preference.timeFormat}
            onExclude={() => handleExclude(todo.todoId)}
          />
        </Fragment>
      ))}
    </VStack>
  );
}

function RescheduleTodo({
  todo,
  options,
  timeFormat,
  onExclude,
}: {
  todo: RainyTodo;
  options: RescheduleOption[];
  timeFormat: TimeFormat;
  onExclude: () => void;
}) {
  const { t } = useTranslation('weather');
  const { control } = useFormContext<WeatherRescheduleFormValues>();
  const dateFormat = useDateFormatContext();
  const [recommended] = options;

  return (
    <VStack gap={8}>
      <HStack align="center" gap={8}>
        <Text size="b2" weight="semibold" className="shrink" maxLines={2}>
          {todo.title}
        </Text>
        <Text size="b4" shade={6}>
          {formatClockTime(todo.scheduledAt, timeFormat, dateFormat)}
        </Text>
      </HStack>
      {recommended == null ? (
        <Text size="b3" shade={6}>
          {t('reschedule.noDryTime')}
        </Text>
      ) : (
        <FormField
          control={control}
          name={`selections.${todo.todoId}`}
          defaultValue={recommended.startsAt.toISOString()}
        >
          {({ value, onChange }) => (
            <RescheduleTimeInput
              value={value}
              onChange={onChange}
              options={options}
              timeFormat={timeFormat}
            />
          )}
        </FormField>
      )}
      <Box className="items-start">
        <TextButton size="small" onPress={onExclude}>
          {t('reschedule.exclude')}
        </TextButton>
      </Box>
    </VStack>
  );
}

interface RescheduleTimeInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> {
  value: string;
  onChange: (startsAt: string) => void;
  options: RescheduleOption[];
  timeFormat: TimeFormat;
}

function RescheduleTimeInput({
  value,
  onChange,
  options,
  timeFormat,
  ...props
}: RescheduleTimeInputProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-0" {...props}>
      {options.map((option) => (
        <RescheduleTimeOption
          key={option.startsAt.toISOString()}
          option={option}
          timeFormat={timeFormat}
        />
      ))}
    </RadioGroup>
  );
}

interface RescheduleTimeOptionProps extends Omit<
  ComponentProps<typeof IconRadioItem>,
  'value' | 'label' | 'description'
> {
  option: RescheduleOption;
  timeFormat: TimeFormat;
}

function RescheduleTimeOption({ option, timeFormat, ...props }: RescheduleTimeOptionProps) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  const time = formatClockTime(option.startsAt, timeFormat, dateFormat);

  return (
    <Box>
      <IconRadioItem
        value={option.startsAt.toISOString()}
        label={time}
        description={t('reschedule.option', { chance: option.precipitationChance })}
        {...props}
      />
      {option.isRecommended && (
        <Box className="absolute right-14 top-0 h-full justify-center" pointerEvents="none">
          <Chip size="sm" color="accent" variant="soft">
            <Chip.Label>{t('reschedule.recommended')}</Chip.Label>
          </Chip>
        </Box>
      )}
    </Box>
  );
}

/** 오늘 남은 시간의 강수 확률 막대. 비 오는 시간은 진하게, 맑은 시간은 옅게 그린다. */
function PrecipitationTimeline({ hours }: { hours: HourlyForecast[] }) {
  const { t } = useTranslation('weather');
  const todayKey = useTodayKey();
  const todayHours = hours.filter(
    (hour) => formatDateKey(hour.startsAt, getDeviceTimezone()) === todayKey,
  );

  if (todayHours.length === 0) {
    return null;
  }
  return (
    <HStack
      align="end"
      gap={2}
      style={{ height: CHART_HEIGHT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('reschedule.chartLabel')}
    >
      {todayHours.map((hour) => (
        <Box
          key={hour.startsAt.getTime()}
          flex={1}
          className={cn(
            'rounded-sm',
            WeatherReportPolicy.isWetHour(hour) ? 'bg-info' : 'bg-gray-3',
          )}
          style={{
            height: Math.max(
              MIN_BAR_HEIGHT,
              clamp(hour.precipitationChance / 100, 0, 1) * CHART_HEIGHT,
            ),
          }}
        />
      ))}
    </HStack>
  );
}

/** 시트도 Apple 날씨 데이터를 보여 주므로 주 버튼 위에 출처 표기를 고정한다. 바탕은 앱 테마를 따른다. */
function RescheduleFooter({ onDone }: { onDone: () => void }) {
  const { resolvedTheme } = useTheme();

  return (
    <VStack gap={8}>
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={<WeatherAttribution.Loading />}>
          <WeatherAttribution background={resolvedTheme} />
        </Suspense>
      </QueryErrorBoundary>
      <RescheduleSubmitButton onDone={onDone} />
    </VStack>
  );
}

/** 할 일마다 뜨는 저장 토스트 대신 한 번에 옮긴 결과와 되돌리기를 보여 준다. 실패는 원래 오류 토스트가 알린다. */
function RescheduleSubmitButton({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('weather');
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const [todoIds] = useRescheduleTodoIdsParam();
  const { handleSubmit, control } = useFormContext<WeatherRescheduleFormValues>();
  const { isSubmitting } = useFormState({ control });
  const { data: todoList } = useQuery(useGetTodosByDateQueryOptions({ date: useTodayKey() }));
  const updateSchedule = useMutation(useRescheduleTodoMutationOptions());
  const todosById = keyBy(todoList?.todos ?? [], (todo) => todo.id);

  const handleUndo = async (todos: Todo[]) => {
    const results = await Promise.allSettled(
      todos.map((todo) =>
        updateSchedule.mutateAsync({ todoId: todo.id, input: toOriginalScheduleInput(todo) }),
      ),
    );
    const restoredCount = results.filter((result) => result.status === 'fulfilled').length;
    if (restoredCount > 0) {
      trackEvent('weather_reschedule_undone', { moved_count: restoredCount });
      toast.success(t('reschedule.undone'));
    }
  };

  const handleApply = handleSubmit(async (values) => {
    const targets = toScheduleChanges(values, todoIds).flatMap((change) => {
      const todo = todosById[change.todoId];
      return todo == null ? [] : [{ todo, startsAt: change.startsAt }];
    });
    const results = await Promise.allSettled(
      targets.map(({ todo, startsAt }) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: toMovedScheduleInput(todo, startsAt),
        }),
      ),
    );
    const moved = targets
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map(({ todo }) => todo);
    if (moved.length === 0) {
      return;
    }
    trackEvent('weather_reschedule_applied', { moved_count: moved.length });
    toast.success(t('reschedule.moved', { count: moved.length }), {
      action: {
        label: t('reschedule.undo'),
        onPress: () => {
          handleUndo(moved).catch(() => undefined);
        },
      },
    });
    onDone();
  });

  return (
    <Button
      display="full"
      size="xlarge"
      isLoading={isSubmitting}
      isDisabled={todoList == null}
      onPress={() => handleApply()}
    >
      {t('reschedule.submit', { count: todoIds.length })}
    </Button>
  );
}

function RescheduleLoading() {
  return (
    <VStack px={20} gap={12} pb={8}>
      <TextSkeleton size="t3" className="w-40" />
      <TextSkeleton size="b3" className="w-56" />
      {times(LOADING_TODO_COUNT, (index) => (
        <TextSkeleton key={index} size="b2" className="w-full" />
      ))}
    </VStack>
  );
}

function RescheduleErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<QueryErrorActions onRetry={reset} onInquiry={onInquiry} />}
    />
  );
}
