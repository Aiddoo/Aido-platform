import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import {
  type LocationCoordinates,
  type LocationGateway,
  LocationUnavailableError,
} from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import { toError } from '@src/shared/errors';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import type { Coordinates, LocationReading } from '../domains/weather-location.model';
import { WEATHER_ERROR_CODE } from '../domains/weather.error';
import type { WeatherApi } from './weather.api';

interface ResolveLocationInput {
  /** 직전에 읽은 위치. 충분히 움직이지 않았으면 다시 등록하지 않는다. */
  previous: LocationReading | undefined;
  signal: AbortSignal;
  /** 등록을 마친 뒤 같은 리비전 리포트가 쓴 위치. 같은 격자면 리포트를 다시 받지 않는다. */
  findReportLocation: (revision: number) => Promise<Coordinates | null>;
}

interface WeatherLocationServicePorts {
  gateway: Pick<
    LocationGateway,
    'getPermission' | 'recheckPermission' | 'getCoordinates' | 'getPlace'
  >;
  weatherApi: Pick<WeatherApi, 'updateLocation'>;
  logger: Logger;
  errorReporter: ErrorReporter;
}

export class WeatherLocationService {
  readonly #gateway: WeatherLocationServicePorts['gateway'];
  readonly #weatherApi: Pick<WeatherApi, 'updateLocation'>;
  readonly #logger: Logger;
  readonly #errorReporter: ErrorReporter;

  constructor({ gateway, weatherApi, logger, errorReporter }: WeatherLocationServicePorts) {
    this.#gateway = gateway;
    this.#weatherApi = weatherApi;
    this.#logger = logger;
    this.#errorReporter = errorReporter;
  }

  // 직전 위치도 없으면 unavailable로 서버 저장 위치를 쓰게 한다. 등록 거절(4xx)은 err, 네트워크·서버 장애는 throw다
  resolveLocation = async ({
    previous,
    signal,
    findReportLocation,
  }: ResolveLocationInput): Promise<Result<LocationReading, ApiError>> => {
    const previousLocated = previous?.status === 'located' ? previous : null;
    const permission = await this.#readPermission(previousLocated);
    if (!permission.isGranted) {
      if (permission.canAskAgain && previousLocated != null) {
        return ok({ ...previousLocated, isLastKnown: true });
      }
      return ok({ status: permission.canAskAgain ? 'needsPermission' : 'denied' });
    }

    const revision = WeatherLocationPolicy.getReadingRevision(previous);
    const coordinates = await this.#readCoordinates(signal);
    if (coordinates == null) {
      // 권한은 허용된 상태이므로 이전 위치를 보여 주더라도 허용 안내가 남지 않게 마지막 위치 표시를 푼다
      return ok(
        previousLocated == null
          ? { status: 'unavailable', revision }
          : { ...previousLocated, isLastKnown: false },
      );
    }
    const place = await this.#gateway.getPlace(coordinates, signal);

    if (
      previousLocated != null &&
      !WeatherLocationPolicy.shouldRelocate(coordinates, previousLocated.registered)
    ) {
      return ok({
        ...previousLocated,
        place: place.name ?? previousLocated.place,
        countryCode: place.countryCode ?? previousLocated.countryCode,
        isLastKnown: false,
      });
    }

    const registration = await this.#registerLocation(coordinates, signal);
    if (!registration.ok) {
      return err(registration.error);
    }
    const registered = registration.value;
    const reportLocation = await findReportLocation(revision);
    return ok({
      status: 'located',
      registered,
      place: place.name,
      countryCode: place.countryCode,
      isLastKnown: false,
      revision: WeatherLocationPolicy.getNextRevision(previous, registered, reportLocation),
    });
  };

  /** 허용한 적 있는 사용자(직전 위치가 있음)의 권한이 정해지지 않은 상태로 읽히면 한 번 더 확인한다. */
  #readPermission = async (
    previousLocated: Extract<LocationReading, { status: 'located' }> | null,
  ) => {
    const permission = await this.#gateway.getPermission();
    if (permission.isGranted || !permission.canAskAgain || previousLocated == null) {
      return permission;
    }
    return this.#gateway.recheckPermission();
  };

  #readCoordinates = async (signal: AbortSignal): Promise<LocationCoordinates | null> => {
    try {
      return await this.#gateway.getCoordinates(signal);
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      if (error instanceof LocationUnavailableError) {
        this.#logger.info(WEATHER_LOG_EVENT.LOCATION_READ_FAILED, { reason: 'unavailable' });
        return null;
      }
      this.#logger.warn(WEATHER_LOG_EVENT.LOCATION_READ_FAILED, { reason: 'unexpected' });
      this.#errorReporter.captureException(toError(error), {
        feature: 'weather_location',
        errorCode: WEATHER_ERROR_CODE.LOCATION_UNAVAILABLE,
      });
      return null;
    }
  };

  #registerLocation = async (coordinates: LocationCoordinates, signal: AbortSignal) => {
    try {
      const result = await this.#weatherApi.updateLocation(coordinates, signal);
      if (!result.ok && !signal.aborted) {
        this.#logger.warn(WEATHER_LOG_EVENT.LOCATION_REGISTER_FAILED, {
          serverErrorCode: result.error.code,
        });
      }
      return result;
    } catch (error) {
      if (!signal.aborted) {
        this.#errorReporter.captureException(toError(error), { feature: 'weather_location' });
      }
      throw error;
    }
  };
}
