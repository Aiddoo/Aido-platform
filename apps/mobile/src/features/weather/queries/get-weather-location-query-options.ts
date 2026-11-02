import {
  useErrorReporter,
  useLocationGateway,
  useLogger,
  useWeatherService,
} from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  LocationUnavailableError,
  type LocationCoordinates,
  type LocationGateway,
} from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isApiError, isBusinessError, toError, unwrap } from '@src/shared/errors';
import { type Query, type QueryClient, queryOptions } from '@tanstack/react-query';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { type LocationReading, WeatherLocationPolicy } from '../domains/weather-location.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { WeatherErrorCode } from '../domains/weather.error';

const LOCATION_STALE_TIME_MS = 30 * 60_000;

interface WeatherLocationDependencies {
  gateway: LocationGateway;
  weatherService: WeatherService;
  logger: Logger;
  errorReporter: ErrorReporter;
}

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

async function readCoordinates(
  { gateway, logger, errorReporter }: WeatherLocationDependencies,
  signal: AbortSignal,
): Promise<LocationCoordinates | null> {
  try {
    return await gateway.getCoordinates(signal);
  } catch (error) {
    if (signal.aborted) {
      return null;
    }
    if (error instanceof LocationUnavailableError) {
      logger.info(WEATHER_LOG_EVENT.LOCATION_READ_FAILED, { reason: 'unavailable' });
      return null;
    }
    logger.warn(WEATHER_LOG_EVENT.LOCATION_READ_FAILED, { reason: 'unexpected' });
    errorReporter.captureException(toError(error), {
      feature: 'weather_location',
      errorCode: WeatherErrorCode.LOCATION_UNAVAILABLE,
    });
    return null;
  }
}

async function registerLocation(
  { weatherService, logger, errorReporter }: WeatherLocationDependencies,
  coordinates: LocationCoordinates,
  signal: AbortSignal,
) {
  try {
    return unwrap(await weatherService.updateLocation(coordinates, signal));
  } catch (error) {
    if (!signal.aborted) {
      if (isBusinessError(error)) {
        logger.warn(WEATHER_LOG_EVENT.LOCATION_REGISTER_FAILED, {
          serverErrorCode: isApiError(error) ? error.code : undefined,
        });
      } else {
        errorReporter.captureException(toError(error), { feature: 'weather_location' });
      }
    }
    throw error;
  }
}

/**
 * 등록을 마쳤을 때 같은 리비전의 리포트를 아직 받는 중이면 그 요청을 기다려 서버가 쓴 위치와 비교한다.
 * 리포트가 늦게 와도 같은 격자면 리비전을 올리지 않아 같은 요청을 두 번 보내지 않는다.
 * fetchQuery는 진행 중인 요청이 있으면 새로 보내지 않고 그 요청을 기다린다.
 */
async function readReportLocation(client: QueryClient, revision: number) {
  const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision: revision });
  const state = client.getQueryState<WeatherReport>(queryKey);
  if (state?.data == null && state?.fetchStatus === 'fetching') {
    const report = await client.fetchQuery<WeatherReport>({ queryKey }).catch(() => null);
    return report?.location ?? null;
  }
  return state?.data?.location ?? null;
}

/**
 * 기기 위치를 읽고, 직전에 등록한 위치에서 충분히 움직였을 때만 서버에 다시 등록한다.
 * 등록을 이 query 안에서 하는 이유: 피드 배지·날씨 화면·안내가 같은 key를 구독하므로
 * 동시에 열려도 위치 읽기와 PUT이 한 번만 일어난다.
 * 위치를 읽지 못하면 직전 위치를 유지하고, 직전 위치도 없으면 unavailable로 끝내 서버에 저장된 위치를 쓰게 한다.
 * 리포트는 이 query를 기다리지 않고 서버에 저장된 위치로 먼저 받는다. 등록한 위치가 그 리포트의 위치와
 * 다른 격자일 때만 리비전을 올려 다시 받는다.
 */
export function getWeatherLocationQueryOptions(dependencies: WeatherLocationDependencies) {
  const { gateway } = dependencies;

  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: async ({ signal, client, queryKey }): Promise<LocationReading> => {
      const permission = await gateway.getPermission();
      if (!permission.granted) {
        return { status: permission.canAskAgain ? 'needsPermission' : 'denied' };
      }

      const previous = client.getQueryData<LocationReading>(queryKey);
      const previousLocated = previous?.status === 'located' ? previous : null;
      const revision = WeatherLocationPolicy.readingRevision(previous);
      const coordinates = await readCoordinates(dependencies, signal);
      if (coordinates == null) {
        return previousLocated ?? { status: 'unavailable', revision };
      }
      const place = await gateway.getPlace(coordinates, signal);

      if (
        previousLocated != null &&
        !WeatherLocationPolicy.isRelocationNeeded(coordinates, previousLocated.registered)
      ) {
        return { ...previousLocated, placeName: place.name ?? previousLocated.placeName };
      }

      const registered = await registerLocation(dependencies, coordinates, signal);
      const reportLocation = await readReportLocation(client, revision);
      return {
        status: 'located',
        registered,
        placeName: place.name,
        revision: WeatherLocationPolicy.nextRevision(revision, registered, reportLocation),
      };
    },
    staleTime: LOCATION_STALE_TIME_MS,
    gcTime: Infinity,
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
