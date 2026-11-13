import { match } from 'ts-pattern';
import { z } from 'zod';

import { registeredLocationSchema } from './weather-report.model';

// 기기 위치와 서버에 등록한 위치를 같은 좌표 값으로 비교한다
const coordinatesSchema = registeredLocationSchema.pick({ latitude: true, longitude: true });
export type Coordinates = z.infer<typeof coordinatesSchema>;

const revisionSchema = z.int().nonnegative();
/** 기기에 저장된 위치로 받은 리포트의 리비전. 새로 등록할 때마다 1씩 올린다 */
const SAVED_LOCATION_REVISION = 0;

const placeNameSchema = z.object({ city: z.string(), district: z.string().nullable() });
export type PlaceName = z.infer<typeof placeNameSchema>;

export const locationReadingSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('needsPermission') }),
  z.object({ status: z.literal('denied') }),
  z.object({ status: z.literal('unavailable'), revision: revisionSchema }),
  z.object({
    status: z.literal('located'),
    registered: registeredLocationSchema,
    place: placeNameSchema.nullable(),
    countryCode: z.string().nullable(),
    revision: revisionSchema,
    isLastKnown: z.boolean(),
  }),
]);
export type LocationReading = z.infer<typeof locationReadingSchema>;

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

function getReadingRevision(reading: LocationReading | undefined): number {
  return reading?.status === 'located' || reading?.status === 'unavailable'
    ? reading.revision
    : SAVED_LOCATION_REVISION;
}

/** 리포트와 같은 격자면 리비전을 유지해 같은 요청을 두 번 보내지 않고, 비교할 리포트가 없으면 새 리비전이다 */
function getNextRevision(
  previous: LocationReading | undefined,
  registered: Coordinates,
  reportLocation: Coordinates | null,
): number {
  const revision = getReadingRevision(previous);
  return shouldRelocate(registered, reportLocation) ? revision + 1 : revision;
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

/** 권한은 있지만 위치를 읽지 못했으면 unavailable이다. 읽는 중과 요청 실패는 조회 상태라 훅이 정한다 */
function getLocationStatus(reading: LocationReading): WeatherLocationStatus {
  return match(reading)
    .with({ status: 'needsPermission' }, () => ({ status: 'needsPermission' as const }))
    .with({ status: 'denied' }, () => ({ status: 'denied' as const }))
    .with({ status: 'unavailable' }, () => ({ status: 'unavailable' as const }))
    .with({ status: 'located' }, ({ place, countryCode, isLastKnown }) => ({
      status: 'ready' as const,
      place,
      countryCode,
      isLastKnown,
    }))
    .exhaustive();
}

/** 권한을 묻는 중이거나 거부한 동안에는 받을 리포트가 없다. 그 밖에는 서버에 저장된 위치로 받는다. */
function shouldFetchReport({ status }: WeatherLocationStatus): boolean {
  return status !== 'needsPermission' && status !== 'denied';
}

export const WeatherLocationPolicy = {
  shouldRelocate,
  getNextRevision,
  getReadingRevision,
  getLocationStatus,
  shouldFetchReport,
} as const;
