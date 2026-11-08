import catSuggestionImage from '@assets/images/weather/mascot-suggestion.webp';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  TodoCheckbox,
  TodoProgress,
  TodoRow,
} from '@src/features/planning/todo/components/todo-row';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { formatClockTime, formatInstantHour, type TimeFormat } from '@src/shared/date/date-format';
import { type Instant, toHHmm } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  ArrowRightIcon,
  Box,
  Button,
  HStack,
  MoreIcon,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { mapValues } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Separator } from 'heroui-native';
import { Fragment, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';

import { BRIEFING_ROW_TONES } from '../constants/weather-colors.constants';
import { type BriefingResult, WeatherBriefingPolicy } from '../domains/weather-briefing.model';
import type { HourlyForecastEntry } from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { toWeatherBriefingKind } from '../utils/weather-analytics';
import {
  type BriefingAction,
  type BriefingCopy,
  type BriefingRow,
  toBriefingView,
} from '../utils/weather-briefing.view-model';
import { toWeatherRescheduleHref } from '../utils/weather-reschedule-link';
import { formatTemperature } from '../utils/weather-temperature';
import { WeatherBriefingChip } from './weather-briefing-chip';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMascot } from './weather-mascot';

const MORE_CHEVRON_SIZE = 13;
const VISIBLE_TODO_LIMIT = 3;

type RescheduleAction = Extract<BriefingAction, { kind: 'reschedule' }>;
type SuggestTodoAction = Extract<BriefingAction, { kind: 'suggestTodo' }>;

function useTranslateBriefingCopy() {
  const { t } = useTranslation('weather');
  const translate = (copy: BriefingCopy): string => {
    const values = mapValues(copy.values ?? {}, (value) =>
      typeof value === 'object' ? translate(value) : value,
    );
    return t(copy.key, values);
  };
  return translate;
}

/** 오늘 할 일과 시간별 예보를 겹쳐 비·뇌우·눈·더위와 만나는 할 일, 곧 올 비, 맑은 날, 내일 아침을 알려 준다 */
export function WeatherBriefing() {
  const { data: report } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.briefing,
  });
  const todayKey = useTodayKey();
  const [{ data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [useGetTodosByDateQueryOptions({ date: todayKey }), useGetPreferenceQueryOptions()],
  });
  const now = useMinuteNow();
  const { timeZone: deviceTimeZone } = useDateFormatContext();
  const state = WeatherBriefingPolicy.getBriefingState(report, { now, deviceTimeZone });

  if (report == null || state === 'loading') {
    return <WeatherBriefing.Loading />;
  }
  if (state === 'hidden') {
    return <WeatherBriefing.Empty />;
  }

  const briefing = WeatherBriefingPolicy.getWeatherBriefing(
    report,
    todoList.todos.map((todo) =>
      WeatherBriefingPolicy.toBriefingTodo(todo, { date: todayKey, timeZone: deviceTimeZone }),
    ),
    { now, timeZone: deviceTimeZone },
  );

  return (
    <WeatherBriefing.Contents
      briefing={briefing}
      hourly={report.hourly}
      now={now}
      timeFormat={preference.timeFormat}
    />
  );
}

WeatherBriefing.Contents = function Contents({
  briefing,
  hourly,
  now,
  timeFormat,
}: {
  briefing: BriefingResult;
  hourly: readonly HourlyForecastEntry[];
  now: Instant;
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation('weather');
  const translate = useTranslateBriefingCopy();
  const { trackEvent } = useTrack();
  const hasTrackedShownRef = useRef(false);
  const dateFormat = useDateFormatContext();
  const unit = useTemperatureUnit();
  const view = toBriefingView(briefing, {
    hourly,
    now,
    timeZone: dateFormat.timeZone,
    formatClock: (date) => formatClockTime(date, timeFormat, dateFormat),
    formatHour: (date) => formatInstantHour(date, timeFormat, dateFormat),
    formatTemperature: (celsius) => formatTemperature(celsius, unit),
    formatChance: (percent) => t('details.percentValue', { value: percent }),
  });
  const visibleRows = view.rows.slice(0, VISIBLE_TODO_LIMIT);
  const hiddenCount = view.rows.length - visibleRows.length;
  const { action } = view;

  useEffect(() => {
    if (hasTrackedShownRef.current) {
      return;
    }
    hasTrackedShownRef.current = true;
    trackEvent('weather_briefing_shown', { kind: toWeatherBriefingKind(briefing.kind) });
  }, [trackEvent, briefing.kind]);

  return (
    <WeatherCard
      title={t('briefing.title')}
      icon={<WeatherIcon.Card glyph="briefing" />}
      className="gap-0 p-4"
    >
      <Spacing size={10} />
      <HStack gap={12} align="start">
        <VStack flex={1} gap={6}>
          <Text size="t3" weight="semibold" tone="onSky" className="text-[21px] tracking-[-0.6px]">
            {translate(view.headline)}
          </Text>
          <Text size="b3" className="leading-[22px] tracking-[-0.2px] text-on-sky/[0.78]">
            {translate(view.body)}
          </Text>
        </VStack>
        <WeatherMascot
          source={catSuggestionImage}
          className="-mt-1.5 -mr-1 size-[72px]"
          fallbackCondition={view.mascotCondition}
        />
      </HStack>
      {visibleRows.length > 0 && (
        <>
          <Spacing size={14} />
          <VStack className="rounded-2xl bg-on-sky/[0.08] px-3">
            {visibleRows.map((row, index) => (
              <Fragment key={row.todo.todoId}>
                {index > 0 && <Separator className="bg-on-sky/[0.14]" />}
                <WeatherBriefing.Item row={row} timeFormat={timeFormat} />
              </Fragment>
            ))}
            {hiddenCount > 0 && (
              <>
                <Separator className="bg-on-sky/[0.14]" />
                {action?.kind === 'reschedule' ? (
                  <WeatherBriefing.More count={hiddenCount} action={action} />
                ) : (
                  <WeatherBriefing.HiddenCount count={hiddenCount} />
                )}
              </>
            )}
          </VStack>
        </>
      )}
      {action != null && (
        <>
          <Spacing size={12} />
          {match(action)
            .with({ kind: 'reschedule' }, (reschedule) => (
              <WeatherBriefing.RescheduleButton action={reschedule} />
            ))
            .with({ kind: 'suggestTodo' }, (suggestTodo) => (
              <WeatherBriefing.SuggestTodoButton action={suggestTodo} />
            ))
            .exhaustive()}
        </>
      )}
    </WeatherCard>
  );
};

WeatherBriefing.Item = function Item({
  row,
  timeFormat,
}: {
  row: BriefingRow;
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation(['todo', 'weather']);
  const translate = useTranslateBriefingCopy();
  const dateFormat = useDateFormatContext();
  const todayKey = useTodayKey();
  const push = useSingleTap(router.push);
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const isChipStacked = useFontScale().fontScale === 'xlarge';
  const { todo, tone } = row;
  const time = formatClockTime(todo.scheduledAt, timeFormat, dateFormat);
  const advice = translate(row.advice);
  const openActions = () =>
    push({ pathname: '/todo/[todoId]/actions', params: { todoId: todo.todoId, date: todayKey } });
  const chip = (
    <WeatherBriefingChip
      condition={row.chipCondition}
      isDaylight={todo.hour.isDaylight}
      label={row.chipLabel}
      tone={tone}
    />
  );

  return (
    <TodoRow
      accessibilityLabel={t('weather:briefing.itemLabel', {
        title: todo.title,
        time,
        advice,
        chip: row.chipLabel,
      })}
      accessibilityHint={t('todo:actions.more')}
      onPress={openActions}
      className={cn('min-h-[60px] justify-center rounded-none', todo.completed && 'opacity-60')}
      left={
        <TodoCheckbox
          accessibilityLabel={todo.title}
          isSelected={todo.completed}
          isDisabled={toggleTodo.isPending}
          onSelectedChange={() =>
            toggleTodo.mutate({
              todoId: todo.todoId,
              body: { completed: !todo.completed },
              date: todayKey,
            })
          }
          className="size-[22px] rounded-[7px] border-[1.5px] border-on-sky/60"
        />
      }
      top={
        <Text
          size="b2"
          weight="medium"
          tone="onSky"
          numberOfLines={1}
          strikethrough={todo.completed}
          className="leading-[22px]"
        >
          {todo.title}
        </Text>
      }
      middle={
        <Text
          size="b4"
          numberOfLines={2}
          className="leading-[18px] text-on-sky/[0.62] tabular-nums"
        >
          {`${time} · `}
          <Text size="b4" className={cn('leading-[18px]', BRIEFING_ROW_TONES[tone].advice)}>
            {advice}
          </Text>
        </Text>
      }
      bottom={
        todo.subTodoProgress == null && !isChipStacked ? undefined : (
          <VStack gap={6} className="mt-1">
            {todo.subTodoProgress != null && (
              <TodoProgress
                tone="onSky"
                value={todo.subTodoProgress.completed}
                total={todo.subTodoProgress.total}
              />
            )}
            {isChipStacked && chip}
          </VStack>
        )
      }
      right={
        <HStack gap={8} align="center">
          {!isChipStacked && chip}
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel={t('todo:actions.more')}
            onPress={openActions}
            hitSlop={12}
            className="size-6 items-center justify-center"
          >
            <MoreIcon width={20} height={20} colorClassName="text-on-sky/60" />
          </PressableFeedback>
        </HStack>
      }
    />
  );
};

WeatherBriefing.More = function More({
  count,
  action,
}: {
  count: number;
  action: RescheduleAction;
}) {
  const { t } = useTranslation('weather');
  const openReschedule = useOpenReschedule(action);
  const chevronSize = Math.round(MORE_CHEVRON_SIZE * useFontScaleRatio());
  return (
    <PressableFeedback accessibilityRole="button" onPress={openReschedule}>
      <HStack align="center" justify="between" className="min-h-12">
        <Text size="b4" weight="medium" className="text-on-sky/[0.78]">
          {t('briefing.more', { count })}
        </Text>
        <ArrowRightIcon width={chevronSize} height={chevronSize} colorClassName="text-on-sky/60" />
      </HStack>
    </PressableFeedback>
  );
};

WeatherBriefing.HiddenCount = function HiddenCount({ count }: { count: number }) {
  const { t } = useTranslation('weather');
  return (
    <HStack align="center" className="min-h-12">
      <Text size="b4" weight="medium" className="text-on-sky/[0.78]">
        {t('briefing.hiddenCount', { count })}
      </Text>
    </HStack>
  );
};

WeatherBriefing.RescheduleButton = function RescheduleButton({
  action,
}: {
  action: RescheduleAction;
}) {
  const translate = useTranslateBriefingCopy();
  const openReschedule = useOpenReschedule(action);
  return (
    <Button onPress={openReschedule} className="h-auto min-h-14 py-2">
      <Text size="b1" weight="semibold" tone="onSky" align="center" numberOfLines={2}>
        {translate(action.label)}
      </Text>
    </Button>
  );
};

WeatherBriefing.SuggestTodoButton = function SuggestTodoButton({
  action,
}: {
  action: SuggestTodoAction;
}) {
  const translate = useTranslateBriefingCopy();
  const todayKey = useTodayKey();
  const { timeZone } = useDateFormatContext();
  const push = useSingleTap(router.push);
  const { trackEvent } = useTrack();

  const handlePress = () => {
    trackEvent('weather_todo_suggestion_opened', { reason: action.reason });
    push({
      pathname: '/todo/new',
      params: {
        date: todayKey,
        title: translate(action.title),
        time: action.scheduledAt == null ? undefined : toHHmm(action.scheduledAt, timeZone),
      },
    });
  };

  return (
    <Button onPress={handlePress} className="h-auto min-h-14 bg-on-sky/16 py-2">
      <Text size="b1" weight="semibold" tone="onSky" align="center" numberOfLines={2}>
        {translate(action.label)}
      </Text>
    </Button>
  );
};

WeatherBriefing.Loading = function Loading() {
  return (
    <WeatherCard className="gap-0 p-4">
      <TextSkeleton size="b4" className="w-24 opacity-40" />
      <Spacing size={10} />
      <HStack gap={12} align="start">
        <VStack flex={1} gap={6}>
          <TextSkeleton size="t3" className="w-full opacity-40" />
          <TextSkeleton size="b3" className="w-3/4 opacity-40" />
        </VStack>
        <Box className="-mt-1.5 -mr-1 size-[72px]" />
      </HStack>
    </WeatherCard>
  );
};

WeatherBriefing.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('weather');
  return (
    <WeatherCard
      title={t('briefing.title')}
      icon={<WeatherIcon.Card glyph="briefing" />}
      className="p-4"
    >
      <Text size="b3" tone="onSky">
        {t('briefing.loadFailed')}
      </Text>
      <QueryErrorActions onRetry={reset} />
    </WeatherCard>
  );
};

/** 오래된 데이터이거나 위치 벽시계가 기기와 다르면 할 일과 날씨를 겹쳐 안내하지 않는다. */
WeatherBriefing.Empty = function Empty() {
  return null;
};

function useOpenReschedule(action: RescheduleAction) {
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);
  return () => {
    trackEvent('weather_reschedule_opened', {
      todo_count: action.todoIds.length,
      reason: action.reason,
    });
    push(toWeatherRescheduleHref({ todoIds: action.todoIds, reason: action.reason }));
  };
}
