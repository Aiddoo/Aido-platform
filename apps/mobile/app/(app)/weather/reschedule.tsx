import { zodResolver } from '@hookform/resolvers/zod';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { WeatherAttribution } from '@src/features/weather/components/weather-attribution';
import { WeatherRescheduleSubmitButton } from '@src/features/weather/components/weather-reschedule/weather-reschedule-submit-button';
import { WeatherRescheduleTimeline } from '@src/features/weather/components/weather-reschedule/weather-reschedule-timeline';
import { WeatherRescheduleTodo } from '@src/features/weather/components/weather-reschedule/weather-reschedule-todo';
import { RESCHEDULE_COPY_KEYS } from '@src/features/weather/constants/weather-labels';
import { WeatherBriefingPolicy } from '@src/features/weather/domains/weather-briefing.model';
import { WeatherReportPolicy } from '@src/features/weather/domains/weather-report.model';
import { weatherRescheduleFormSchema } from '@src/features/weather/domains/weather-reschedule-form.schema';
import { useWeatherRescheduleParams } from '@src/features/weather/hooks/use-weather-reschedule-params';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '@src/features/weather/queries/get-weather-report-query-options';
import { weatherRescheduleParamsSchema } from '@src/features/weather/schemas/weather-reschedule-params.schema';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { useTheme } from '@src/shared/providers/theme-provider';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  SheetRouteScreen,
  Spacing,
  Text,
  TextSkeleton,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { keyBy, range } from 'es-toolkit';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Separator } from 'heroui-native';
import { Fragment, Suspense } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

const WEATHER_HREF = '/weather';
const LOADING_TODO_COUNT = 2;

export default function WeatherRescheduleSheetRoute() {
  const params = weatherRescheduleParamsSchema.safeParse(useLocalSearchParams());

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
 * 시트를 연 사이 완료·삭제·시각 경과로 목록에서 빠진 할 일의 선택은 함께 지워 옮기지 않는다.
 */
function WeatherRescheduleSheet() {
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
      footer={
        <FormProvider {...form}>
          <RescheduleFooter onDone={() => sheet.close()} />
        </FormProvider>
      }
    >
      <FormProvider {...form}>
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
      </FormProvider>
    </BottomSheet>
  );
}

function RescheduleContent({ onEmpty }: { onEmpty: () => void }) {
  const { t } = useTranslation('weather');
  const [{ todoIds, reason }, setParams] = useWeatherRescheduleParams();
  const todayKey = useTodayKey();
  const [{ data: report }, { data: todoList }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.briefing },
      useGetTodosByDateQueryOptions({ date: todayKey }),
      useGetPreferenceQueryOptions(),
    ],
  });
  const now = useMinuteNow();
  const copy = RESCHEDULE_COPY_KEYS[reason];
  const todosById = keyBy(todoList.todos, (todo) => todo.id);
  const affectedTodos = WeatherBriefingPolicy.getAffectedTodos(
    report.hourly,
    todoIds.flatMap((todoId) => {
      const todo = todosById[todoId];
      return todo == null
        ? []
        : [
            WeatherBriefingPolicy.toBriefingTodo(todo, {
              date: todayKey,
              timeZone: getDeviceTimezone(),
            }),
          ];
    }),
    { now, reason },
  );

  const handleExclude = (todoId: number) => {
    const remaining = todoIds.filter((id) => id !== todoId);
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
            hours={WeatherReportPolicy.selectUpcomingHours(report.hourly, now)}
          />
          <Spacing size={16} />
        </>
      )}
      {affectedTodos.map((todo, index) => (
        <Fragment key={todo.todoId}>
          {index > 0 && <Separator className="my-3" />}
          <WeatherRescheduleTodo
            todo={todo}
            options={WeatherBriefingPolicy.getRescheduleOptions(report.hourly, todo, {
              now,
              timeZone: getDeviceTimezone(),
              reason,
            })}
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
function RescheduleFooter({ onDone }: { onDone: () => void }) {
  const { resolvedTheme } = useTheme();

  return (
    <VStack gap={8}>
      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={<WeatherAttribution.Loading />}>
          <WeatherAttribution background={resolvedTheme} />
        </Suspense>
      </QueryErrorBoundary>
      <WeatherRescheduleSubmitButton onDone={onDone} />
    </VStack>
  );
}

function RescheduleLoading() {
  return (
    <VStack px={20} gap={12} pb={8}>
      <TextSkeleton size="t3" className="w-40" />
      <TextSkeleton size="b3" className="w-56" />
      {range(LOADING_TODO_COUNT).map((index) => (
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
