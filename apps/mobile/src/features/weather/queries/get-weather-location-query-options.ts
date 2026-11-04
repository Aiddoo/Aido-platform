import {
  useErrorReporter,
  useLocationGateway,
  useLogger,
  useWeatherService,
} from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import {
  resolveLocation,
  type WeatherLocationDependencies,
} from '@src/features/weather/apis/weather-location.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { errorMessageOf } from '@src/shared/errors';
import { type Query, type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { type LocationReading, WeatherLocationPolicy } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';

const LOCATION_STALE_TIME_MS = 30 * 60_000;

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

/**
 * 등록을 마쳤을 때 같은 리비전의 리포트를 아직 받는 중이면 그 요청을 기다려 서버가 쓴 위치와 비교한다.
 * fetchQuery는 진행 중인 요청이 있으면 새로 보내지 않고 그 요청을 기다린다. 리포트 실패는 리포트 경계가
 * 알리므로 여기서는 비교할 위치가 없는 것으로 보고 기록만 남긴다.
 */
async function readReportLocation(client: QueryClient, logger: Logger, revision: number) {
  const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision: revision });
  const state = client.getQueryState<WeatherReport>(queryKey);
  if (state?.data == null && state?.fetchStatus === 'fetching') {
    const report = await client.fetchQuery<WeatherReport>({ queryKey }).catch((error) => {
      logger.info(WEATHER_LOG_EVENT.REPORT_LOCATION_READ_FAILED, {
        error: errorMessageOf(error),
      });
      return null;
    });
    return report?.location ?? null;
  }
  return state?.data?.location ?? null;
}

/**
 * 위치 읽기·등록을 이 query 안에서 하는 이유: 피드 배지·날씨 화면·안내가 같은 key를 구독하므로
 * 동시에 열려도 위치 읽기와 PUT이 한 번만 일어난다.
 * 리포트는 이 query를 기다리지 않고 서버에 저장된 위치로 먼저 받는다.
 */
export function getWeatherLocationQueryOptions(dependencies: WeatherLocationDependencies) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: ({ signal, client, queryKey }): Promise<LocationReading> =>
      resolveLocation(dependencies, {
        previous: client.getQueryData<LocationReading>(queryKey),
        signal,
        readReportLocation: (revision) => readReportLocation(client, dependencies.logger, revision),
      }),
    ...PERSISTED_QUERY_OPTIONS,
    staleTime: LOCATION_STALE_TIME_MS,
    gcTime: Infinity,
    /** 위치 읽기는 기기 안에서 끝나므로 오프라인에서도 실행하고, 등록 실패는 저장된 위치·안내 정책으로 넘긴다. */
    networkMode: 'offlineFirst',
    retry: false,
    refetchOnWindowFocus: refetchOnFocus,
  });
}

export function useGetWeatherLocationQueryOptions() {
  return getWeatherLocationQueryOptions({
    gateway: useLocationGateway(),
    weatherService: useWeatherService(),
    logger: useLogger(),
    errorReporter: useErrorReporter(),
  });
}

/** 날씨 블록이 같은 리포트 캐시를 고르도록 위치 리비전을 돌려준다. 위치를 읽는 동안에도 0으로 바로 받는다. */
export function useWeatherLocationRevision(): number {
  const { data } = useQuery(useGetWeatherLocationQueryOptions());
  return WeatherLocationPolicy.readingRevision(data);
}
