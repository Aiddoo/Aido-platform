import catSuggestionImage from '@assets/images/ido_cat_suggestion.webp';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useGetTodosByDateQueryOptions } from '@src/features/todo/queries/get-todos-by-date-query-options';
import { useTrack } from '@src/shared/analytics';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  HStack,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { formatClockTime, type TimeFormat } from '@src/shared/utils/date-format';
import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Fragment } from 'react';
import { match } from 'ts-pattern';

import { type RainyTodo, WeatherBriefingPolicy } from '../domains/weather-briefing.model';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import { createWeatherRescheduleHref } from '../hooks/use-reschedule-todo-ids-param';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { WeatherCard } from './weather-card';
import { WeatherMascot } from './weather-mascot';

/**
 * 오늘 할 일과 시간별 강수를 겹쳐 비와 만나는 할 일을 알려 준다.
 * 리포트는 히어로가 이미 요청한 같은 캐시를 던지지 않는 useQuery로 구독한다. 리포트 실패는 화면의
 * 리포트 경계 한 곳에서만 보이고 보고되며, 이 블록의 경계는 오늘 할 일 실패만 맡는다.
 * 오늘 할 일·설정은 함께 suspend해 리포트 요청과 동시에 받는다.
 */
export function WeatherBriefing() {
  const { t } = useTranslation('weather');
  const { data: report, dataUpdatedAt } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.briefing,
  });
  const [{ data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [
      useGetTodosByDateQueryOptions({ date: useTodayKey() }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = new Date(dataUpdatedAt);

  if (report == null) {
    return <WeatherBriefing.Loading />;
  }
  if (WeatherReportPolicy.isNowcastExpired(report, now)) {
    return <WeatherBriefing.Empty />;
  }

  const briefing = WeatherBriefingPolicy.briefing(
    report.hourly,
    todoList.todos.map(WeatherBriefingPolicy.briefingTodo),
    now,
  );
  const headline = match(briefing)
    .with({ kind: 'noScheduledTodos' }, () => t('briefing.noScheduledTodos'))
    .with({ kind: 'dry' }, () => t('briefing.dry'))
    .with({ kind: 'rainy' }, ({ rainyTodos: [first, ...rest] }) =>
      rest.length === 0 && first != null
        ? t('briefing.rainyOne', { title: first.title })
        : t('briefing.rainyMany', { count: rest.length + 1 }),
    )
    .exhaustive();

  return (
    <WeatherCard title={t('briefing.title')}>
      <HStack gap={12} align="center">
        <WeatherMascot source={catSuggestionImage} className="size-12" fallbackCondition="RAIN" />
        <Text size="b1" weight="semibold" tone="white" className="shrink">
          {headline}
        </Text>
      </HStack>
      {briefing.kind === 'rainy' && (
        <WeatherBriefing.RainyTodos
          rainyTodos={briefing.rainyTodos}
          timeFormat={preference.timeFormat}
        />
      )}
    </WeatherCard>
  );
}

WeatherBriefing.RainyTodos = function RainyTodos({
  rainyTodos,
  timeFormat,
}: {
  rainyTodos: RainyTodo[];
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation('weather');
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);

  const handleReschedulePress = () => {
    trackEvent('weather_reschedule_opened', { todo_count: rainyTodos.length });
    push(createWeatherRescheduleHref(rainyTodos.map((todo) => todo.todoId)));
  };

  return (
    <VStack gap={10}>
      {rainyTodos.map((todo, index) => (
        <Fragment key={todo.todoId}>
          {index > 0 && <Separator className="bg-white/15" />}
          <WeatherBriefing.RainyTodo todo={todo} timeFormat={timeFormat} />
        </Fragment>
      ))}
      <Button display="full" onPress={handleReschedulePress}>
        {t('briefing.reschedule')}
      </Button>
    </VStack>
  );
};

/** 할 일 시각은 기기 시간대로 저장돼 있어 기기 시간대로 보여 준다. */
WeatherBriefing.RainyTodo = function RainyTodoRow({
  todo,
  timeFormat,
}: {
  todo: RainyTodo;
  timeFormat: TimeFormat;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  const detail = t('briefing.todoDetail', {
    time: formatClockTime(todo.scheduledAt, timeFormat, dateFormat),
    chance: todo.precipitationChance,
  });

  return (
    <VStack gap={2} accessible accessibilityLabel={`${todo.title}, ${detail}`}>
      <Text size="b2" weight="semibold" tone="white" maxLines={1}>
        {todo.title}
      </Text>
      <Text size="b4" className="text-white/80">
        {detail}
      </Text>
    </VStack>
  );
};

WeatherBriefing.Loading = function Loading() {
  return (
    <WeatherCard>
      <TextSkeleton size="e1" className="w-24 opacity-40" />
      <TextSkeleton size="b1" className="w-full opacity-40" />
    </WeatherCard>
  );
};

/** 오늘 할 일을 받지 못해도 날씨는 그대로 보이도록 브리핑 자리에서만 다시 시도를 안내한다. */
WeatherBriefing.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('weather');
  return (
    <WeatherCard title={t('briefing.title')}>
      <Text size="b3" tone="white">
        {t('briefing.loadFailed')}
      </Text>
      <QueryErrorActions onRetry={reset} />
    </WeatherCard>
  );
};

/** 6시간 넘게 갱신되지 않은 데이터로는 할 일과 비를 겹쳐 안내하지 않는다. */
WeatherBriefing.Empty = function Empty() {
  return null;
};
