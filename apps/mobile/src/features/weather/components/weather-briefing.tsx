import type { WeatherCondition } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import {
  TodoCheckbox,
  TodoProgress,
  TodoRow,
} from '@src/features/planning/todo/components/todo-row';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import {
  formatClockTime,
  formatInstantHour,
  type TimeFormat,
} from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { toHHmm } from '@src/shared/date/zoned';
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
import { Chip, PressableFeedback, Separator } from 'heroui-native';
import { type ComponentProps, Fragment, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';

import { BRIEFING_ROW_TONES, type BriefingRowTone } from '../constants/weather-colors.constants';
import {
  type BriefingResult,
  getBriefingState,
  getWeatherBriefing,
  WeatherBriefingPolicy,
} from '../domains/weather-briefing.model';
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
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMascot } from './weather-mascot';

const MORE_CHEVRON_SIZE = 13;
const CHIP_ICON_SIZE = 15;
/** 영향이 큰 할 일만 보인다. 옮기기 시트가 있는 브리핑은 나머지를 시트에서 보고, 없으면 개수만 알린다. */
const VISIBLE_TODO_LIMIT = 3;

type RescheduleAction = Extract<BriefingAction, { kind: 'reschedule' }>;
type SuggestTodoAction = Extract<BriefingAction, { kind: 'suggestTodo' }>;

/** 값 안에 넣은 문구까지 번역해 한 문장으로 만든다. */
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

/** 리포트 실패는 리포트 경계 한 곳에서만 보이도록 던지지 않는 useQuery로 구독하고, 이 경계는 할 일 실패만 맡는다 */
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
  const state = getBriefingState(report, { now, deviceTimeZone });

  if (report == null || state === 'loading') {
    return <WeatherBriefing.Loading />;
  }
  if (state === 'hidden') {
    return <WeatherBriefing.Empty />;
  }

  const briefing = getWeatherBriefing(
    report,
    todoList.todos.map((todo) =>
      WeatherBriefingPolicy.toBriefingTodo(todo, { date: todayKey, timeZone: deviceTimeZone }),
    ),
    { now, timeZone: deviceTimeZone },
  );
  if (briefing == null) {
    return <WeatherBriefing.Empty />;
  }

  return (
    <WeatherBriefing.Card
      briefing={briefing}
      hourly={report.hourly}
      now={now}
      timeFormat={preference.timeFormat}
    />
  );
}

WeatherBriefing.Card = function Card({
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
    formatClock: (date) => formatClockTime(date, timeFormat, dateFormat),
    formatHour: (date) => formatInstantHour(date, timeFormat, dateFormat),
    formatTemperature: (celsius) => formatTemperature(celsius, unit),
    formatChance: (percent) => t('details.percentValue', { value: percent }),
  });
  const visibleRows = view.rows.slice(0, VISIBLE_TODO_LIMIT);
  const hiddenCount = view.rows.length - visibleRows.length;
  const { action } = view;

  // 분 단위 갱신·할 일 변경으로 종류가 바뀌어도 이 화면에서는 처음 보인 브리핑만 센다
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
      <HStack className="gap-3" align="start">
        <VStack className="gap-1.5" flex={1}>
          <Text size="t3" weight="semibold" tone="onSky" className="text-[21px] tracking-[-0.6px]">
            {translate(view.headline)}
          </Text>
          <Text size="b3" className="leading-[22px] tracking-[-0.2px] text-on-sky/[0.78]">
            {translate(view.body)}
          </Text>
        </VStack>
        <WeatherMascot
          name="weatherSuggestion"
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

/** 할 일 시각은 기기 시간대로 저장돼 있어 기기 시간대로 보여 준다 */
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
  // TodoRow가 누름 영역이라 Pressable인 Chip이 줄 탭을 가로채지 않게 한다
  const chip = (
    <WeatherBriefing.Chip
      pointerEvents="none"
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

interface WeatherBriefingChipProps extends Omit<
  ComponentProps<typeof Chip>,
  'variant' | 'size' | 'color' | 'children'
> {
  condition: WeatherCondition;
  isDaylight: boolean;
  label: string;
  tone: BriefingRowTone;
}

/** 할 일 시각의 날씨를 아이콘과 강수 확률·기온 한 값으로 줄여 보여 준다. */
WeatherBriefing.Chip = function BriefingChip({
  condition,
  isDaylight,
  label,
  tone,
  className,
  ...props
}: WeatherBriefingChipProps) {
  const iconSize = Math.round(CHIP_ICON_SIZE * useFontScaleRatio());
  return (
    <Chip
      variant="tertiary"
      className={cn(
        'min-h-[26px] gap-0.75 self-start rounded-[13px] py-0 pr-2.25 pl-1.75',
        BRIEFING_ROW_TONES[tone].chip,
        className,
      )}
      {...props}
    >
      <WeatherIcon
        condition={condition}
        isDaylight={isDaylight}
        width={iconSize}
        height={iconSize}
      />
      <Text size="e1" weight="semibold" tone="onSky" className="tabular-nums">
        {label}
      </Text>
    </Chip>
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

/** 옮기기 시트가 없는 브리핑은 보이지 않는 할 일의 개수만 글자로 알린다. */
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

/** 제안만 한다. 저장은 사용자가 고친 뒤 할 일 추가 시트가 한다 */
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

/** 받은 뒤와 같은 자리를 잡는다. 제목 아래 머리글과 본문 줄이 있고 오른쪽에 고양이 자리가 있다. */
WeatherBriefing.Loading = function Loading() {
  return (
    <WeatherCard className="gap-0 p-4">
      <TextSkeleton size="b4" className="w-24 opacity-40" />
      <Spacing size={10} />
      <HStack className="gap-3" align="start">
        <VStack className="gap-1.5" flex={1}>
          <TextSkeleton size="t3" className="w-full opacity-40" />
          <TextSkeleton size="b3" className="w-3/4 opacity-40" />
        </VStack>
        <Box className="-mt-1.5 -mr-1 size-[72px]" />
      </HStack>
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

/** 오래된 데이터이거나 위치 벽시계가 기기와 다르거나 서버가 영향받는 할 일을 판단하지 못했으면 할 일과 날씨를 겹쳐 안내하지 않는다. */
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
