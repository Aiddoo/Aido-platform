import type { QueryClient } from '@tanstack/react-query';
import { last } from 'es-toolkit';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import type { LocationReading } from '../domains/weather-location.model';
import type { RegisteredLocation } from '../domains/weather-report.model';
import { weatherReportQueryKeySchema } from '../schemas/weather-report-query-key.schema';

/** 리포트 쿼리 키의 인자는 객체 하나이고 항상 마지막에 둔다 */
function getReportKeyParams(queryKey: readonly unknown[]) {
  const parsed = weatherReportQueryKeySchema.safeParse(last(queryKey));
  return parsed.success ? parsed.data : null;
}

/**
 * 위치를 먼저 다시 읽는다. 위치가 바뀌면 리포트 key가 바뀌어 새 리포트만 받고,
 * 그대로면 보고 있는 리포트를 다시 받는다. 이전 위치의 리포트를 한 번 더 받지 않는다.
 * 헤더 버튼과 당겨서 새로고침을 연달아 쓰면 진행 중인 요청을 취소하고 다시 시작하지 않고 그 요청을 기다린다.
 */
export async function refetchWeather(queryClient: QueryClient) {
  const getRevision = () =>
    WeatherLocationPolicy.getReadingRevision(
      queryClient.getQueryData<LocationReading>(WEATHER_QUERY_KEYS.location()),
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

/**
 * 위치가 바뀌어 리비전이 올라가면 이전 위치의 리포트를 캐시에서 뺀다.
 * 다시 볼 일이 없는 리포트가 기기 캐시에 남아 콜드 스타트 복원을 키우지 않게 한다.
 */
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

export function invalidateWeather(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all });
}

export function refetchWeatherLocation(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.location() });
}

/** 리포트를 받는 중인지 볼 때 쓰는 필터 */
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
  queryClient.setQueryData<LocationReading>(WEATHER_QUERY_KEYS.location(), (reading) =>
    reading?.status === 'located' ? { ...reading, registered } : reading,
  );
}
