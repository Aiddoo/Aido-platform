import type { QueryClient, QueryExecuteOptions, QueryKey } from '@tanstack/react-query';
import { last } from 'es-toolkit';

import { WeatherLocationPolicy } from '../domains/weather-location.model';
import type { RegisteredLocation, WeatherReport } from '../domains/weather-report.model';
import { weatherReportQueryKeySchema } from '../schemas/weather-report-query-key.schema';
import { WEATHER_QUERY_KEYS } from './weather-query-keys';

/** 리포트 쿼리 키의 인자는 객체 하나이고 항상 마지막에 둔다 */
function getReportKeyParams(queryKey: readonly unknown[]) {
  const parsed = weatherReportQueryKeySchema.safeParse(last(queryKey));
  return parsed.success ? parsed.data : null;
}

/** 개발용 덮어쓰기가 실제 리포트를 캐시에서 읽고, 없을 때만 한 번 받는다 */
export function queryCachedWeatherReport<TError, TQueryKey extends QueryKey>(
  queryClient: QueryClient,
  options: QueryExecuteOptions<WeatherReport, TError, WeatherReport, WeatherReport, TQueryKey>,
) {
  return queryClient.query({ ...options, staleTime: 'static' });
}

/** 위치를 먼저 읽어 이전 위치의 리포트를 한 번 더 받지 않고, 연달아 불리면 진행 중인 요청을 기다린다 */
export async function refetchWeather(queryClient: QueryClient) {
  const getRevision = () =>
    WeatherLocationPolicy.getReadingRevision(
      queryClient.getQueryData(WEATHER_QUERY_KEYS.location()),
    );
  const before = getRevision();
  await queryClient.refetchQueries(
    { queryKey: WEATHER_QUERY_KEYS.location() },
    { cancelRefetch: false },
  );
  if (getRevision() !== before) {
    return;
  }
  await queryClient.refetchQueries(
    { queryKey: WEATHER_QUERY_KEYS.reports(), type: 'active' },
    { cancelRefetch: false },
  );
}

/** 다시 볼 일이 없는 리포트가 기기 캐시에 남아 콜드 스타트 복원을 키우지 않게 한다 */
export function removeOutdatedWeatherReports(
  queryClient: QueryClient,
  { locationRevision }: { locationRevision: number },
) {
  queryClient.removeQueries({
    queryKey: WEATHER_QUERY_KEYS.reports(),
    predicate: (query) => {
      const params = getReportKeyParams(query.queryKey);
      return params != null && params.locationRevision < locationRevision;
    },
  });
}

export function refetchWeatherLocation(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.location() });
}

export function getWeatherReportsFilters() {
  return { queryKey: WEATHER_QUERY_KEYS.reports() };
}

export function invalidateWeatherReports(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.reports() });
}

/** 다시 등록한 위치를 위치 캐시에 반영한다. 위치를 읽기 전이면 다음 위치 확인에서 채운다. */
export function setRegisteredWeatherLocation(
  queryClient: QueryClient,
  registered: RegisteredLocation,
) {
  queryClient.setQueryData(WEATHER_QUERY_KEYS.location(), (reading) =>
    reading?.status === 'located' ? { ...reading, registered } : reading,
  );
}

export function getCachedWeatherLocation(queryClient: QueryClient) {
  return queryClient.getQueryData(WEATHER_QUERY_KEYS.location());
}

export function getCachedWeatherReport(
  queryClient: QueryClient,
  { locationRevision }: { locationRevision: number },
) {
  return queryClient.getQueryData<WeatherReport>(WEATHER_QUERY_KEYS.report({ locationRevision }));
}

/** 그 리비전의 리포트가 받는 중이면 끝나기를 기다려 위치를 읽는다. 실패는 비교할 위치가 없는 것으로 본다 */
export async function findCachedReportLocation(
  queryClient: QueryClient,
  {
    locationRevision,
    onReadFailed,
  }: { locationRevision: number; onReadFailed: (error: unknown) => void },
) {
  const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision });
  const state = queryClient.getQueryState<WeatherReport>(queryKey);
  if (state?.data == null && state?.fetchStatus === 'fetching') {
    const report = await queryClient.query<WeatherReport>({ queryKey }).catch((error: unknown) => {
      onReadFailed(error);
      return null;
    });
    return report?.location ?? null;
  }
  return state?.data?.location ?? null;
}
