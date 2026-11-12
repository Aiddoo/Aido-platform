import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  Text,
  TextSkeleton,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Separator } from 'heroui-native';
import { Fragment, Suspense } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { WeatherBriefingPolicy } from '../../domains/weather-briefing.model';
import { WeatherReportPolicy } from '../../domains/weather-report.model';
import {
  getRescheduleTodos,
  WeatherReschedulePolicy,
} from '../../domains/weather-reschedule.model';
import { useWeatherRescheduleParams } from '../../hooks/use-weather-reschedule-params';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../../queries/weather.queries';
import {
  type WeatherRescheduleFormValues,
  weatherRescheduleFormSchema,
} from '../../schemas/weather-reschedule-form.schema';
import { getRescheduleCopyKeys } from '../../utils/weather-labels.view-model';
import { WeatherAttribution } from '../weather-attribution';
import { WeatherRescheduleSubmitButton } from './weather-reschedule-submit-button';
import { WeatherRescheduleTimeline } from './weather-reschedule-timeline';
import { WeatherRescheduleTodo } from './weather-reschedule-todo';

const WEATHER_HREF = '/weather';
const LOADING_TODO_COUNT = 2;

/** footer의 주 버튼과 목록이 같은 폼을 보도록 시트가 소유하고, 목록에서 빠진 할 일의 선택은 함께 지운다 */
export function WeatherRescheduleBottomSheet() {
  const sheet = useSheetRoute(WEATHER_HREF);
  const form = useForm({
    resolver: zodResolver(weatherRescheduleFormSchema),
    defaultValues: { selections: {} },
    shouldUnregister: true,
  });

  return (
    <BottomSheet
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={<RescheduleFooter form={form} onDone={() => sheet.close()} />}
    >
      {sheet.isOpen && (
        <QueryErrorBoundary
          fallback={(fallbackProps) => (
            <WeatherRescheduleBottomSheet.Error
              {...fallbackProps}
              onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
            />
          )}
        >
          <Suspense fallback={<WeatherRescheduleBottomSheet.Loading />}>
            <RescheduleTodoList form={form} onEmpty={() => sheet.close()} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </BottomSheet>
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

WeatherRescheduleBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  return <QueryErrorFallback reset={reset} onInquiry={onInquiry} />;
};

function RescheduleTodoList({
  form,
  onEmpty,
}: {
  form: UseFormReturn<WeatherRescheduleFormValues>;
  onEmpty: () => void;
}) {
  const { t } = useTranslation('weather');
  const [{ todoIds, reason: linkReason }, setParams] = useWeatherRescheduleParams();
  const todayKey = useTodayKey();
  const { timeZone } = useDateFormatContext();
  const [{ data: report }, { data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.briefing },
      useGetTodosByDateQueryOptions({ date: todayKey }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const affectedTodos = getRescheduleTodos(
    report,
    todoList.todos.map((todo) =>
      WeatherBriefingPolicy.toBriefingTodo(todo, { date: todayKey, timeZone }),
    ),
    { now, linkedTodoIds: todoIds },
  );
  // 링크의 이유가 지금 브리핑과 다르면 지금 브리핑의 이유로 문구를 고른다
  const reason = report.briefing?.reason ?? linkReason;
  const copy = getRescheduleCopyKeys(reason);

  const handleExclude = (todoId: number) => {
    const remaining = affectedTodos.flatMap((todo) =>
      todo.todoId === todoId ? [] : [todo.todoId],
    );
    if (remaining.length === 0) {
      onEmpty();
      return;
    }
    setParams({ todoIds: remaining });
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
          <WeatherRescheduleTimeline
            hours={WeatherReportPolicy.getUpcomingHours(report.hourly, now)}
          />
          <Spacing size={16} />
        </>
      )}
      {affectedTodos.map((todo, index) => (
        <Fragment key={todo.todoId}>
          {index > 0 && <Separator className="my-3" />}
          <WeatherRescheduleTodo
            form={form}
            todo={todo}
            options={WeatherReschedulePolicy.getUpcomingOptions(todo.rescheduleOptions, now)}
            reason={reason}
            timeFormat={preference.timeFormat}
            onExclude={() => handleExclude(todo.todoId)}
          />
        </Fragment>
      ))}
    </VStack>
  );
}

/** 시트도 Apple 날씨 데이터를 보여 주므로 주 버튼 위에 출처 표기를 고정한다. 바탕은 앱 테마를 따른다. */
function RescheduleFooter({
  form,
  onDone,
}: {
  form: UseFormReturn<WeatherRescheduleFormValues>;
  onDone: () => void;
}) {
  const { resolvedTheme } = useAppTheme();

  return (
    <VStack gap={8}>
      {/* 출처 표기는 보조 정보라 불러오지 못하면 시트를 막지 않고 자리를 비운다. */}
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={<WeatherAttribution.Loading />}>
          <WeatherAttribution background={resolvedTheme} />
        </Suspense>
      </QueryErrorBoundary>
      <WeatherRescheduleSubmitButton form={form} onDone={onDone} />
    </VStack>
  );
}
