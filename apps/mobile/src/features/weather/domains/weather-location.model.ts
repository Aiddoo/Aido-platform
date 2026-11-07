import { match } from 'ts-pattern';

import type { Coordinates, LocationReading, PlaceName } from '../schemas/weather-location.schema';

export const SAVED_LOCATION_REVISION = 0;

/** 약 1km(위도 0.01°) 안에서의 이동은 같은 날씨 격자로 보고 서버에 다시 등록하지 않는다. */
const RELOCATION_THRESHOLD_DEGREES = 0.01;

function shouldRelocate(next: Coordinates, previous: Coordinates | null): boolean {
  if (previous == null) {
    return true;
  }
  return (
    Math.abs(next.latitude - previous.latitude) >= RELOCATION_THRESHOLD_DEGREES ||
    Math.abs(next.longitude - previous.longitude) >= RELOCATION_THRESHOLD_DEGREES
  );
}

/**
 * 등록한 위치가 이미 받은 리포트의 위치와 같은 격자면 리비전을 유지해 같은 요청을 두 번 보내지 않는다.
 * 비교할 리포트가 없으면(아직 받는 중이거나 서버에 위치가 없던 경우) 새 리비전으로 다시 받는다.
 */
function getNextRevision(
  revision: number,
  registered: Coordinates,
  reportLocation: Coordinates | null,
): number {
  return shouldRelocate(registered, reportLocation) ? revision + 1 : revision;
}

function getReadingRevision(reading: LocationReading | undefined): number {
  return reading?.status === 'located' || reading?.status === 'unavailable'
    ? reading.revision
    : SAVED_LOCATION_REVISION;
}

export type WeatherLocationStatus =
  | { status: 'checking' }
  | { status: 'needsPermission' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      place: PlaceName | null;
      countryCode: string | null;
      isLastKnown: boolean;
    };

/** 권한은 있지만 위치를 읽지 못했거나 등록 요청이 실패하면 unavailable이다. */
function getLocationStatus(
  reading: LocationReading | undefined,
  { hasFailed }: { hasFailed: boolean },
): WeatherLocationStatus {
  if (reading == null) {
    return hasFailed ? { status: 'unavailable' } : { status: 'checking' };
  }
  return match(reading)
    .with({ status: 'needsPermission' }, () => ({ status: 'needsPermission' as const }))
    .with({ status: 'denied' }, () => ({ status: 'denied' as const }))
    .with({ status: 'unavailable' }, () => ({ status: 'unavailable' as const }))
    .with({ status: 'located' }, ({ place, countryCode, isLastKnown }) => ({
      status: 'ready' as const,
      place,
      countryCode,
      isLastKnown: isLastKnown === true,
    }))
    .exhaustive();
}

/** 권한을 묻는 중이거나 거부한 동안에는 받을 리포트가 없다. 그 밖에는 서버에 저장된 위치로 받는다. */
function shouldFetchReport(status: WeatherLocationStatus['status']): boolean {
  return status !== 'needsPermission' && status !== 'denied';
}

export const WeatherLocationPolicy = {
  shouldRelocate,
  getNextRevision,
  getReadingRevision,
  getLocationStatus,
  shouldFetchReport,
} as const;
