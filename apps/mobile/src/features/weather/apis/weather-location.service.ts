import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  type LocationCoordinates,
  type LocationGateway,
  LocationUnavailableError,
} from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import { isApiError, isBusinessError, toError, unwrap } from '@src/shared/errors';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import {
  type Coordinates,
  type LocationReading,
  WeatherLocationPolicy,
} from '../domains/weather-location.model';
import { WeatherErrorCode } from '../domains/weather.error';
import type { WeatherService } from './weather.service';

export interface WeatherLocationDependencies {
  gateway: LocationGateway;
  weatherService: WeatherService;
  logger: Logger;
  errorReporter: ErrorReporter;
}

interface ResolveLocationInput {
  /** 직전에 읽은 위치. 충분히 움직이지 않았으면 다시 등록하지 않는다. */
  previous: LocationReading | undefined;
  signal: AbortSignal;
  /** 등록을 마친 뒤 같은 리비전 리포트가 쓴 위치. 같은 격자면 리포트를 다시 받지 않는다. */
  readReportLocation: (revision: number) => Promise<Coordinates | null>;
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
 * 기기 위치를 읽고, 직전에 등록한 위치에서 충분히 움직였을 때만 서버에 다시 등록한다.
 * 위치를 읽지 못하면 직전 위치를 유지하고, 직전 위치도 없으면 unavailable로 끝내 서버에 저장된 위치를 쓰게 한다.
 * 등록한 위치가 이미 받은 리포트의 위치와 다른 격자일 때만 리비전을 올려 리포트를 다시 받는다.
 */
export async function resolveLocation(
  dependencies: WeatherLocationDependencies,
  { previous, signal, readReportLocation }: ResolveLocationInput,
): Promise<LocationReading> {
  const { gateway } = dependencies;
  const permission = await gateway.getPermission();
  if (!permission.isGranted) {
    return { status: permission.canAskAgain ? 'needsPermission' : 'denied' };
  }

  const previousLocated = previous?.status === 'located' ? previous : null;
  const revision = WeatherLocationPolicy.getReadingRevision(previous);
  const coordinates = await readCoordinates(dependencies, signal);
  if (coordinates == null) {
    return previousLocated ?? { status: 'unavailable', revision };
  }
  const place = await gateway.getPlace(coordinates, signal);

  if (
    previousLocated != null &&
    !WeatherLocationPolicy.isRelocationNeeded(coordinates, previousLocated.registered)
  ) {
    return {
      ...previousLocated,
      place: place.name ?? previousLocated.place,
      countryCode: place.countryCode ?? previousLocated.countryCode,
    };
  }

  const registered = await registerLocation(dependencies, coordinates, signal);
  const reportLocation = await readReportLocation(revision);
  return {
    status: 'located',
    registered,
    place: place.name,
    countryCode: place.countryCode,
    revision: WeatherLocationPolicy.getNextRevision(revision, registered, reportLocation),
  };
}
