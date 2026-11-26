import type { WeatherRescheduleReason } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogger } from '@src/bootstrap/providers/di-context';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { settleTodoBatchWrite } from '@src/features/planning/todo/queries/todo-cache';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import {
  formatClockTime,
  formatHHmmTime,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { toEpochMs } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import { useMutationErrorFeedback } from '@src/shared/query/use-mutation-error-feedback';
import {
  Box,
  Button,
  HStack,
  LabelChip,
  QueryErrorBoundary,
  QueryErrorFallback,
  Result,
  RouteBottomSheet,
  SettingsListGroup,
  Spacing,
  Text,
  TextButton,
  TextSkeleton,
  useAppToast,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  useMutation,
  usePrefetchQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { RadioGroup, Separator } from 'heroui-native';
import { type ComponentProps, Fragment, type ReactNode, Suspense } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';

import { toWeatherBriefingTodo } from '../apis/weather-briefing.mapper';
import {
  toMovedScheduleRequest,
  toOriginalScheduleRequest,
  toRescheduleOutcome,
  toScheduleChanges,
} from '../apis/weather-reschedule.mapper';
import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import {
  filterByLocalDate,
  type ForecastHour,
  ForecastHourPolicy,
} from '../domains/forecast-hour.model';
import type { WeatherForecastTodo } from '../domains/weather-briefing.model';
import {
  filterByUpcomingOption,
  WeatherReportBriefingPolicy,
  type WeatherRescheduleOption,
} from '../domains/weather-report-briefing.model';
import {
  getExpiredTargets,
  getRescheduleTargets,
  WeatherReschedulePolicy,
} from '../domains/weather-reschedule.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import {
  useWeatherRescheduleReason,
  useWeatherRescheduleTodoIds,
} from '../hooks/use-weather-reschedule-params';
import { invalidateWeatherReports } from '../queries/weather-cache';
import { useRescheduleTodoMutationOptions } from '../queries/weather.mutations';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import {
  toSelectionKey,
  type WeatherRescheduleFormValues,
  weatherRescheduleFormSchema,
} from '../schemas/weather-reschedule-form.schema';
import { toUnitPosition } from '../utils/weather-bar.geometry';
import { getRescheduleCopyKeys } from '../utils/weather-labels.view-model';
import { formatTemperature } from '../utils/weather-temperature.view-model';
import { WeatherAttribution } from './weather-attribution';

const WEATHER_HREF = '/weather';
const LOADING_TODO_COUNT = 2;
const CHART_HEIGHT = 40;
const MIN_BAR_HEIGHT = 2;

/** 하나도 옮기지 않고 끝난 제출(지난 후보를 다음 후보로 바꿨거나 모두 실패). 안내는 이미 했다 */
const NOT_MOVED = new Error('weather reschedule: nothing moved');

type RescheduleForm = UseFormReturn<WeatherRescheduleFormValues>;

/** 시트가 폼을 갖는다. 목록에서 빠진 할 일의 선택은 함께 지운다(shouldUnregister) */
export function WeatherRescheduleBottomSheet() {
  const { resolvedTheme } = useAppTheme();
  const form = useForm({
    resolver: zodResolver(weatherRescheduleFormSchema),
    defaultValues: { selections: {} },
    shouldUnregister: true,
  });

  return (
    <RouteBottomSheet
      fallbackHref={WEATHER_HREF}
      loading={<WeatherRescheduleBottomSheet.Loading />}
      footer={(sheet) => (
        // 시트도 Apple 날씨 데이터를 보여 주므로 주 버튼 위에 출처 표기를 고정한다. 바탕은 앱 테마를 따른다
        <VStack gap={8}>
          {/* 출처 표기는 보조 정보라 불러오지 못하면 시트를 막지 않고 자리를 비운다. */}
          <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
            <Suspense fallback={<WeatherAttribution.Loading />}>
              <WeatherAttribution background={resolvedTheme} />
            </Suspense>
          </QueryErrorBoundary>
          <Suspense fallback={<RescheduleSubmitButton.Loading />}>
            <RescheduleSubmitButton form={form} onDone={() => sheet.close()} />
          </Suspense>
        </VStack>
      )}
    >
      {(sheet) => sheet.isOpen && <RescheduleTodoList form={form} onEmpty={() => sheet.close()} />}
    </RouteBottomSheet>
  );
}

WeatherRescheduleBottomSheet.Loading = function Loading() {
  return (
    <VStack px={20} gap={12} pb={8}>
      <TextSkeleton size="t3" className="w-40" />
      <TextSkeleton size="b3" className="w-56" />
      {range(LOADING_TODO_COUNT).map((index) => (
        <TextSkeleton key={index} size="b2" className="w-full" />
      ))}
    </VStack>
  );
};

interface RescheduleTodoListProps {
  form: RescheduleForm;
  onEmpty: () => void;
}

/** 옮길 시각 칸은 후보가 있는 할 일에만 잇는다. 기본 선택(추천 시간)은 Controller의 defaultValue로 처음 그릴 때 한 번 정한다 */
function RescheduleTodoList({ form, onEmpty }: RescheduleTodoListProps) {
  const { t } = useTranslation('weather');
  const [todoIds, setTodoIds] = useWeatherRescheduleTodoIds();
  const [linkReason] = useWeatherRescheduleReason();
  const todayKey = useTodayKey();
  const { timezone } = useDateFormatContext();
  const now = useMinuteNow();
  const reportOptions = useGetWeatherReportQueryOptions();
  // 리포트의 select가 오늘 할 일을 받아 할 일 조회 뒤에 구독한다. 할 일을 기다리는 동안 리포트도 함께 받기 시작한다
  usePrefetchQuery(reportOptions);
  const [{ data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [useGetTodosByDateQueryOptions({ date: todayKey }), useGetPreferenceQueryOptions()],
  });
  const todos = todoList.todos.map((todo) =>
    toWeatherBriefingTodo(todo, { date: todayKey, timezone }),
  );
  const { data: weather } = useSuspenseQuery({
    ...reportOptions,
    select: WeatherReportSelect.reschedule({
      now,
      todos,
      link: { todoIds, reason: linkReason },
    }),
  });
  const { reschedule, upcomingHours } = weather;
  // 링크의 이유가 지금 브리핑과 다르면 지금 브리핑의 이유로 문구를 고른다
  const { reason, todos: affectedTodos } = reschedule;
  const copy = getRescheduleCopyKeys(reason);

  const handleExclude = (todoId: number) => {
    const remaining = WeatherReschedulePolicy.getTodoIdsWithout(reschedule, todoId);
    if (remaining.length === 0) {
      onEmpty();
      return;
    }
    setTodoIds(remaining);
  };

  if (affectedTodos.length === 0) {
    return <Result title={t('reschedule.todoNotFound')} />;
  }
  return (
    <VStack px={20} pb={8}>
      <Text size="t3" weight="bold">
        {t(copy.title)}
      </Text>
      <Spacing size={4} />
      <Text size="b3" shade={6}>
        {t(copy.description)}
      </Text>
      <Spacing size={16} />
      {reason === 'rain' && (
        <>
          <RescheduleTimeline hours={upcomingHours} />
          <Spacing size={16} />
        </>
      )}
      {affectedTodos.map((todo, index) => {
        const options = todo.rescheduleOptions.filter((option) =>
          filterByUpcomingOption(option, now),
        );
        const [recommended] = options;
        return (
          <Fragment key={todo.todoId}>
            {index > 0 && <Separator className="my-3" />}
            <RescheduleTodoList.Item
              todo={todo}
              timeFormat={preference.timeFormat}
              onExclude={() => handleExclude(todo.todoId)}
            >
              {recommended == null ? (
                <Text size="b3" shade={6}>
                  {t(copy.noTime)}
                </Text>
              ) : (
                <Controller
                  control={form.control}
                  name={`selections.${toSelectionKey(todo.todoId)}`}
                  defaultValue={recommended.startsAt}
                  render={({ field }) => (
                    <RescheduleTimeInput
                      value={field.value}
                      onValueChange={field.onChange}
                      options={options}
                      reason={reason}
                      timeFormat={preference.timeFormat}
                    />
                  )}
                />
              )}
            </RescheduleTodoList.Item>
          </Fragment>
        );
      })}
    </VStack>
  );
}

interface RescheduleTodoItemProps {
  todo: WeatherForecastTodo;
  timeFormat: TimeFormat;
  onExclude: () => void;
  /** 옮길 시각 칸. 후보가 없으면 피할 시간이 없다는 안내다 */
  children: ReactNode;
}

RescheduleTodoList.Item = function Item({
  todo,
  timeFormat,
  onExclude,
  children,
}: RescheduleTodoItemProps) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();

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
      {children}
      <Box className="items-start">
        <TextButton size="small" onPress={onExclude}>
          {t('reschedule.exclude')}
        </TextButton>
      </Box>
    </VStack>
  );
};

interface RescheduleTimeInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> {
  value: string;
  onValueChange: (startsAt: string) => void;
  options: WeatherRescheduleOption[];
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
}

/** 옮길 시각 후보. 값은 후보 정시의 ISO 문자열이고 첫 후보가 추천이다. */
function RescheduleTimeInput({
  value,
  onValueChange,
  options,
  reason,
  timeFormat,
  ...props
}: RescheduleTimeInputProps) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} className="gap-0" {...props}>
      {options.map((option) => (
        <RescheduleTimeInput.Item
          key={option.startsAt}
          option={option}
          reason={reason}
          timeFormat={timeFormat}
        />
      ))}
    </RadioGroup>
  );
}

interface RescheduleTimeItemProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Radio>,
  'value' | 'label' | 'description'
> {
  option: WeatherRescheduleOption;
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
}

RescheduleTimeInput.Item = function Item({
  option,
  reason,
  timeFormat,
  ...props
}: RescheduleTimeItemProps) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  const unit = useTemperatureUnit();
  const time = formatClockTime(option.startsAt, timeFormat, dateFormat);
  const description = match(reason)
    .with('heat', () =>
      t('reschedule.heat.option', {
        temperature: formatTemperature(option.apparentTemperature, unit),
      }),
    )
    .with('rain', () => t('reschedule.option', { chance: option.precipitationChance }))
    .exhaustive();

  return (
    <SettingsListGroup.Radio
      value={option.startsAt}
      label={time}
      description={description}
      badge={
        option.isRecommended && (
          <LabelChip color="accent" label={t('reschedule.recommended')} pointerEvents="none" />
        )
      }
      {...props}
    />
  );
};

/** 오늘(기기 시간대) 남은 시간의 강수 확률 막대. 비 오는 시간은 진하게, 맑은 시간은 옅게 그린다. */
function RescheduleTimeline({ hours }: { hours: ForecastHour[] }) {
  const { t } = useTranslation('weather');
  const todayKey = useTodayKey();
  const { timezone } = useDateFormatContext();
  const todayHours = hours.filter((hour) => filterByLocalDate(hour, todayKey, timezone));

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
          key={toEpochMs(hour.startsAt)}
          flex={1}
          className={cn('rounded-sm', ForecastHourPolicy.isWet(hour) ? 'bg-info' : 'bg-gray-3')}
          style={{
            height: Math.max(
              MIN_BAR_HEIGHT,
              toUnitPosition(hour.precipitationChance, 0, 100) * CHART_HEIGHT,
            ),
          }}
        />
      ))}
    </HStack>
  );
}

interface RescheduleSubmitButtonProps {
  form: RescheduleForm;
  onDone: () => void;
}

/** 할 일마다 뜨는 저장 토스트 대신 한 번에 옮긴 결과와 되돌리기를 보여 준다. 실패도 이 버튼이 모아 한 번만 알린다. */
function RescheduleSubmitButton({ form, onDone }: RescheduleSubmitButtonProps) {
  const { t } = useTranslation(['weather', 'todo']);
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { timezone } = useDateFormatContext();
  const showMutationError = useMutationErrorFeedback();
  const logger = useLogger();
  const reportUnexpectedError = useReportUnexpectedError('weather');
  const { trackEvent } = useTrack();
  const [reason] = useWeatherRescheduleReason();
  const todayKey = useTodayKey();
  // 시트 목록이 같은 조회를 먼저 받아 두어 보통은 바로 읽힌다
  const [{ data: reportBriefing }, { data: todoList }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.reportBriefing },
      useGetTodosByDateQueryOptions({ date: todayKey }),
    ],
  });
  const updateSchedule = useMutation(useRescheduleTodoMutationOptions());
  const { isSubmitting, isSubmitSuccessful } = useFormState({ control: form.control });
  const todayTodos = todoList.todos;
  // shouldUnregister 폼은 남은 선택이 없으면 selections 자체를 지운다.
  const selections = useWatch({ control: form.control, name: 'selections' }) ?? {};
  // 링크의 id로 다시 거르면 링크가 낡았을 때 버튼만 0개가 되므로 지금 영향받는 할 일의 선택을 그대로 센다
  const affectedTodoIds = reportBriefing == null ? [] : reportBriefing.affectedTodoIds;
  const targetCount = getRescheduleTargets(
    toScheduleChanges({ selections }, affectedTodoIds),
    todayTodos,
  ).length;

  const refreshAndReportFailures = (failures: unknown[]) => {
    settleTodoBatchWrite(queryClient);
    // 영향받는 할 일은 서버가 고르므로 옮긴 할 일이 브리핑에서 빠지려면 리포트를 다시 받는다
    invalidateWeatherReports(queryClient);
    // 여러 할 일을 한 번에 옮겨 실패는 첫 번째 하나로 한 번만 알린다
    const [firstFailure] = failures;
    if (firstFailure != null) {
      showMutationError(firstFailure, {
        feature: 'weather',
        fallbackKey: 'todo:toast.updateFailedRetry',
      });
    }
  };

  const handleUndo = async (todos: Todo[]) => {
    const results = await Promise.allSettled(
      todos.map((todo) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: toOriginalScheduleRequest(todo, timezone),
        }),
      ),
    );
    const { moved: restored, failures } = toRescheduleOutcome(
      todos.map((todo) => ({ todo })),
      results,
    );
    refreshAndReportFailures(failures);
    if (restored.length > 0) {
      trackEvent('weather_reschedule_undone', { moved_count: restored.length, reason });
      toast.success(t('weather:reschedule.undone'));
    }
  };

  // 옮기지 못한 제출은 던진다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 누를 수 있다
  const submitReschedule = form.handleSubmit(async (values) => {
    const targets = getRescheduleTargets(toScheduleChanges(values, affectedTodoIds), todayTodos);
    const now = getNowInstant();
    const expired = getExpiredTargets(targets, now);
    if (expired.length > 0) {
      // 시트를 연 채 정시를 넘겼다. 지난 시각으로 옮기지 않고 다음 유효 후보로 바꿔 다시 확인받는다
      for (const { todo } of expired) {
        const next =
          reportBriefing == null
            ? null
            : WeatherReportBriefingPolicy.findNextOption(reportBriefing, todo.id, now);
        if (next != null) {
          form.setValue(`selections.${toSelectionKey(todo.id)}`, next.startsAt);
        }
      }
      toast.warning(t('weather:reschedule.expired'));
      throw NOT_MOVED;
    }
    const results = await Promise.allSettled(
      targets.map(({ todo, startsAt }) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: toMovedScheduleRequest(todo, startsAt, timezone),
        }),
      ),
    );
    const { moved, failures } = toRescheduleOutcome(targets, results);
    refreshAndReportFailures(failures);
    if (moved.length === 0) {
      throw NOT_MOVED;
    }
    trackEvent('weather_reschedule_applied', { moved_count: moved.length, reason });
    toast.success(t('weather:reschedule.moved', { count: moved.length }), {
      action: {
        label: t('weather:reschedule.undo'),
        onPress: () => {
          handleUndo(moved).catch((error) => {
            logger.warn(WEATHER_LOG_EVENT.RESCHEDULE_UNDO_FAILED, {
              error: getErrorMessage(error),
            });
          });
        },
      },
    });
    onDone();
  });
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다
  const handleMovePress = useSingleTap(() => {
    submitReschedule().catch((error: unknown) => {
      // 옮기지 못한 제출은 안에서 이미 알렸다. 시트와 고른 시각은 그대로 남긴다
      if (error !== NOT_MOVED) {
        reportUnexpectedError(error);
      }
    });
  });

  return (
    <Button
      display="full"
      size="xlarge"
      isLoading={isSubmitting}
      // 옮기고 닫히는 동안에도 값이 남아 다시 눌리므로 성공한 뒤에는 꺼 둔다
      isDisabled={targetCount === 0 || isSubmitSuccessful}
      onPress={handleMovePress}
    >
      {t('weather:reschedule.submit', { count: targetCount })}
    </Button>
  );
}

RescheduleSubmitButton.Loading = function Loading() {
  const { t } = useTranslation('weather');

  return (
    <Button display="full" size="xlarge" isDisabled>
      {t('reschedule.submit', { count: 0 })}
    </Button>
  );
};
