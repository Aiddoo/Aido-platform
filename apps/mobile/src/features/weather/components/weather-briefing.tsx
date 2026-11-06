import { WEATHER_RESCHEDULE_DEEP_LINK } from '@aido/api';
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
import { toHHmm } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaleRatio } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import {
  ArrowRightIcon,
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
import { router } from 'expo-router';
import { PressableFeedback, Separator } from 'heroui-native';
import { Fragment, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { BRIEFING_ROW_TONES } from '../constants/weather-colors';
import { type BriefingResult, WeatherBriefingPolicy } from '../domains/weather-briefing.model';
import { type HourlyForecastEntry, WeatherReportPolicy } from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';
import { toWeatherBriefingKind } from '../utils/analytics/weather-analytics';
import {
  type BriefingAction,
  type BriefingCopy,
  type BriefingRow,
  toBriefingState,
  toBriefingView,
} from '../utils/view-models/weather-briefing.view-model';
import { WeatherBriefingChip } from './weather-briefing-chip';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMascot } from './weather-mascot';

/** 앱 글자 크기가 가장 클 때(1.25배)는 칩을 제목 아래로 내린다. */
const STACKED_CHIP_FONT_SCALE_RATIO = 1.25;
const MORE_CHEVRON_SIZE = 13;
/** 영향이 큰 할 일만 보이고 나머지는 시트에서 본다. */
const VISIBLE_TODO_LIMIT = 3;

type RescheduleAction = Extract<BriefingAction, { kind: 'reschedule' }>;
type SuggestTodoAction = Extract<BriefingAction, { kind: 'suggestTodo' }>;

/** 값 안에 넣은 문구까지 번역해 한 문장으로 만든다. */
function useBriefingCopy() {
  const { t } = useTranslation('weather');
  const translate = (copy: BriefingCopy): string => {
    const values = Object.fromEntries(
      Object.entries(copy.values ?? {}).map(([name, value]) => [
        name,
        typeof value === 'object' ? translate(value) : value,
      ]),
    );
    return t(copy.key, values);
  };
  return translate;
}

/**
 * 오늘 할 일과 시간별 예보를 겹쳐 비·뇌우·눈·더위와 만나는 할 일, 곧 올 비, 맑은 날, 내일 아침을 알려 준다.
 * 리포트는 히어로가 이미 요청한 같은 캐시를 던지지 않는 useQuery로 구독한다. 리포트 실패는 화면의
 * 리포트 경계 한 곳에서만 보이고 보고되며, 이 블록의 경계는 오늘 할 일 실패만 맡는다.
 * 할 일 시각은 기기 시계라 위치 벽시계가 기기와 다르면(해외 위치) 브리핑을 그리지 않는다.
 */
export function WeatherBriefing() {
  const { data: report } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.briefing,
  });
  const [{ data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [
      useGetTodosByDateQueryOptions({ date: useTodayKey() }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const deviceTimeZone = getDeviceTimezone();
  const state = toBriefingState(report, { now, deviceTimeZone });

  if (report == null || state === 'loading') {
    return <WeatherBriefing.Loading />;
  }
  if (state === 'hidden') {
    return <WeatherBriefing.Empty />;
  }

  const briefing = WeatherBriefingPolicy.briefing(
    report,
    todoList.todos.map(WeatherBriefingPolicy.briefingTodo),
    { now, timeZone: deviceTimeZone },
  );

  return (
    <WeatherBriefing.Content
      briefing={briefing}
      hourly={report.hourly}
      now={now}
      timeFormat={preference.timeFormat}
    />
  );
}

WeatherBriefing.Content = function Content({
  briefing,
  hourly,
  now,
  timeFormat,
}: {
  briefing: BriefingResult;
  hourly: readonly HourlyForecastEntry[];
  now: Date;
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation('weather');
  const translate = useBriefingCopy();
  const { trackEvent } = useTrack();
  const hasTrackedShown = useRef(false);
  const dateFormat = useDateFormatContext();
  const unit = useTemperatureUnit();
  const view = toBriefingView(briefing, {
    hourly,
    now,
    timeZone: dateFormat.timeZone,
    formatClock: (date) => formatClockTime(date, timeFormat, dateFormat),
    formatHour: (date) => formatInstantHour(date, timeFormat, dateFormat),
    formatDegrees: (celsius) =>
      WeatherReportPolicy.degrees(WeatherReportPolicy.displayTemperature(celsius, unit)),
    formatChance: (percent) => t('details.percentValue', { value: percent }),
  });
  const visibleRows = view.rows.slice(0, VISIBLE_TODO_LIMIT);
  const hiddenCount = view.rows.length - visibleRows.length;
  const { action } = view;

  // 분 단위 갱신·할 일 변경으로 종류가 바뀌어도 이 화면에서는 처음 보인 브리핑만 센다
  useEffect(() => {
    if (hasTrackedShown.current) {
      return;
    }
    hasTrackedShown.current = true;
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
            {hiddenCount > 0 && action?.kind === 'reschedule' && (
              <>
                <Separator className="bg-on-sky/[0.14]" />
                <WeatherBriefing.More count={hiddenCount} action={action} />
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

/**
 * 할 일 시각은 기기 시간대로 저장돼 있어 기기 시간대로 보여 준다. 큰 글씨에서는 칩을 제목 아래로 내린다.
 * 피드의 할 일 줄과 같게, 줄을 누르면 할 일 메뉴(수정·날짜·시간·카테고리)가 열리고 체크박스는 완료를 바꾼다.
 */
WeatherBriefing.Item = function Item({
  row,
  timeFormat,
}: {
  row: BriefingRow;
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation(['todo', 'weather']);
  const translate = useBriefingCopy();
  const dateFormat = useDateFormatContext();
  const todayKey = useTodayKey();
  const push = useSingleTap(router.push);
  const toggleTodo = useMutation(useToggleTodoMutationOptions());
  const isChipStacked = useFontScaleRatio() >= STACKED_CHIP_FONT_SCALE_RATIO;
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
          maxLines={1}
          strikethrough={todo.completed}
          className="leading-[22px]"
        >
          {todo.title}
        </Text>
      }
      middle={
        <Text size="b4" maxLines={2} className="leading-[18px] text-on-sky/[0.62] tabular-nums">
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

/** 보이지 않는 나머지 할 일은 옮기기 시트에서 함께 본다. */
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

WeatherBriefing.RescheduleButton = function RescheduleButton({
  action,
}: {
  action: RescheduleAction;
}) {
  const translate = useBriefingCopy();
  const openReschedule = useOpenReschedule(action);
  return (
    <Button onPress={openReschedule} className="h-auto min-h-14 py-2">
      <Text size="b1" weight="semibold" tone="onSky" align="center" maxLines={2}>
        {translate(action.label)}
      </Text>
    </Button>
  );
};

/**
 * 날씨에 맞는 할 일을 제안만 한다. 제목·시각을 채운 할 일 추가 시트를 열고, 저장은 사용자가 고친 뒤 시트가 한다.
 */
WeatherBriefing.SuggestTodoButton = function SuggestTodoButton({
  action,
}: {
  action: SuggestTodoAction;
}) {
  const translate = useBriefingCopy();
  const todayKey = useTodayKey();
  const push = useSingleTap(router.push);
  const { trackEvent } = useTrack();

  const handlePress = () => {
    trackEvent('weather_todo_suggestion_opened', { reason: action.reason });
    push({
      pathname: '/todo/new',
      params: {
        date: todayKey,
        title: translate(action.title),
        time:
          action.scheduledAt == null ? undefined : toHHmm(action.scheduledAt, getDeviceTimezone()),
      },
    });
  };

  return (
    <Button onPress={handlePress} className="h-auto min-h-14 bg-on-sky/16 py-2">
      <Text size="b1" weight="semibold" tone="onSky" align="center" maxLines={2}>
        {translate(action.label)}
      </Text>
    </Button>
  );
};

WeatherBriefing.Loading = function Loading() {
  return (
    <WeatherCard className="p-4">
      <TextSkeleton size="b4" className="w-24 opacity-40" />
      <TextSkeleton size="t3" className="w-full opacity-40" />
    </WeatherCard>
  );
};

/** 오늘 할 일을 받지 못해도 날씨는 그대로 보이도록 브리핑 자리에서만 다시 시도를 안내한다. */
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
    push({
      pathname: WEATHER_RESCHEDULE_DEEP_LINK,
      params: z.encode(weatherRescheduleParamsSchema, {
        todoIds: action.todoIds,
        reason: action.reason,
      }),
    });
  };
}
