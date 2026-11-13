import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import {
  type LocationCoordinates,
  type LocationGateway,
  LocationUnavailableError,
} from '@src/core/ports/location-gateway';

import type { WeatherApi } from '../apis/weather.api';
import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import type { Coordinates, LocationReading } from '../domains/weather-location.model';

/** 위치 읽기 실패는 위치 없이 이어 가고 등록 실패는 다시 던진다. 보고는 부른 훅이 한다 */
export interface UnexpectedLocationFailure {
  step: 'read' | 'register';
  error: unknown;
}

interface ResolveLocationInput {
  /** 직전에 읽은 위치. 충분히 움직이지 않았으면 다시 등록하지 않는다. */
  previous: LocationReading | undefined;
  signal: AbortSignal;
  /** 등록을 마친 뒤 같은 리비전 리포트가 쓴 위치. 같은 격자면 리포트를 다시 받지 않는다. */
  findReportLocation: (revision: number) => Promise<Coordinates | null>;
  onUnexpectedFailure: (failure: UnexpectedLocationFailure) => void;
}

interface WeatherLocationServicePorts {
  gateway: Pick<
    LocationGateway,
    'getPermission' | 'recheckPermission' | 'getCoordinates' | 'getPlace'
  >;
  weatherApi: Pick<WeatherApi, 'updateLocation'>;
  logger: AppLogger;
}

export class WeatherLocationService {
  readonly #gateway: WeatherLocationServicePorts['gateway'];
  readonly #weatherApi: Pick<WeatherApi, 'updateLocation'>;
  readonly #logger: AppLogger;

  constructor({ gateway, weatherApi, logger }: WeatherLocationServicePorts) {
    this.#gateway = gateway;
    this.#weatherApi = weatherApi;
    this.#logger = logger;
  }

  // 직전 위치도 없으면 unavailable로 서버 저장 위치를 쓰게 한다. 등록 거절(4xx)은 err, 네트워크·서버 장애는 throw다
  resolveLocation = async ({
    previous,
    signal,
    findReportLocation,
    onUnexpectedFailure,
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
    const coordinates = await this.#readCoordinates(signal, onUnexpectedFailure);
    if (coordinates == null) {
      // 권한은 허용된 상태이므로 이전 위치를 보여 주더라도 허용 안내가 남지 않게 마지막 위치 표시를 푼다
      return ok(
        previousLocated == null
          ? { status: 'unavailable', revision }
          : { ...previousLocated, isLastKnown: false },
      );
    }
    const placeRead = this.#gateway.getPlace(coordinates, signal);

    if (
      previousLocated != null &&
      !WeatherLocationPolicy.shouldRelocate(coordinates, previousLocated.registered)
    ) {
      const place = await placeRead;
      return ok({
        ...previousLocated,
        place: place.name ?? previousLocated.place,
        countryCode: place.countryCode ?? previousLocated.countryCode,
        isLastKnown: false,
      });
    }

    // getPlace는 실패 대신 빈 이름으로 끝나 등록 결과만 흐름을 정한다
    const [place, registration] = await Promise.all([
      placeRead,
      this.#registerLocation(coordinates, signal, onUnexpectedFailure),
    ]);
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

  #readCoordinates = async (
    signal: AbortSignal,
    onUnexpectedFailure: ResolveLocationInput['onUnexpectedFailure'],
  ): Promise<LocationCoordinates | null> => {
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
      onUnexpectedFailure({ step: 'read', error });
      return null;
    }
  };

  #registerLocation = async (
    coordinates: LocationCoordinates,
    signal: AbortSignal,
    onUnexpectedFailure: ResolveLocationInput['onUnexpectedFailure'],
  ) => {
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
        onUnexpectedFailure({ step: 'register', error });
      }
      throw error;
    }
  };
}
