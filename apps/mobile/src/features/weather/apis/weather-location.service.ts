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
import { WeatherErrorCode } from '../domains/weather.error';
import type { Coordinates, LocationReading } from '../schemas/weather-location.schema';
import type { WeatherService } from './weather.service';

interface ResolveLocationInput {
  /** 직전에 읽은 위치. 충분히 움직이지 않았으면 다시 등록하지 않는다. */
  previous: LocationReading | undefined;
  signal: AbortSignal;
  /** 등록을 마친 뒤 같은 리비전 리포트가 쓴 위치. 같은 격자면 리포트를 다시 받지 않는다. */
  readReportLocation: (revision: number) => Promise<Coordinates | null>;
}

interface WeatherLocationServicePorts {
  gateway: LocationGateway;
  weatherService: Pick<WeatherService, 'updateLocation'>;
  logger: Logger;
  errorReporter: ErrorReporter;
}

export class WeatherLocationService {
  readonly #gateway: LocationGateway;
  readonly #weatherService: Pick<WeatherService, 'updateLocation'>;
  readonly #logger: Logger;
  readonly #errorReporter: ErrorReporter;

  constructor({ gateway, weatherService, logger, errorReporter }: WeatherLocationServicePorts) {
    this.#gateway = gateway;
    this.#weatherService = weatherService;
    this.#logger = logger;
    this.#errorReporter = errorReporter;
  }

  /**
   * 기기 위치를 읽고, 직전에 등록한 위치에서 충분히 움직였을 때만 서버에 다시 등록한다.
   * 위치를 읽지 못하면 직전 위치를 유지하고, 직전 위치도 없으면 unavailable로 끝내 서버에 저장된 위치를 쓰게 한다.
   * 등록한 위치가 이미 받은 리포트의 위치와 다른 격자일 때만 리비전을 올려 리포트를 다시 받는다.
   * 서버가 등록을 거절하면(4xx) err로, 네트워크·서버 장애는 throw로 알린다.
   */
  resolveLocation = async ({
    previous,
    signal,
    readReportLocation,
  }: ResolveLocationInput): Promise<Result<LocationReading, ApiError>> => {
    const permission = await this.#gateway.getPermission();
    if (!permission.isGranted) {
      return ok({ status: permission.canAskAgain ? 'needsPermission' : 'denied' });
    }

    const previousLocated = previous?.status === 'located' ? previous : null;
    const revision = WeatherLocationPolicy.getReadingRevision(previous);
    const coordinates = await this.#readCoordinates(signal);
    if (coordinates == null) {
      return ok(previousLocated ?? { status: 'unavailable', revision });
    }
    const place = await this.#gateway.getPlace(coordinates, signal);

    if (
      previousLocated != null &&
      !WeatherLocationPolicy.isRelocationNeeded(coordinates, previousLocated.registered)
    ) {
      return ok({
        ...previousLocated,
        place: place.name ?? previousLocated.place,
        countryCode: place.countryCode ?? previousLocated.countryCode,
      });
    }

    const registration = await this.#registerLocation(coordinates, signal);
    if (!registration.ok) {
      return err(registration.error);
    }
    const registered = registration.value;
    const reportLocation = await readReportLocation(revision);
    return ok({
      status: 'located',
      registered,
      place: place.name,
      countryCode: place.countryCode,
      revision: WeatherLocationPolicy.getNextRevision(revision, registered, reportLocation),
    });
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
        errorCode: WeatherErrorCode.LOCATION_UNAVAILABLE,
      });
      return null;
    }
  };

  #registerLocation = async (coordinates: LocationCoordinates, signal: AbortSignal) => {
    try {
      const result = await this.#weatherService.updateLocation(coordinates, signal);
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
