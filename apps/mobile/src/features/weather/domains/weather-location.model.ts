import { weatherLocationSchema } from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

const registeredLocationSchema = weatherLocationSchema;
export type RegisteredLocation = z.infer<typeof registeredLocationSchema>;

const coordinatesSchema = weatherLocationSchema.pick({ latitude: true, longitude: true });
export type Coordinates = z.infer<typeof coordinatesSchema>;

/**
 * 리포트 캐시 리비전. 서버에 저장된 위치로 바로 받는 첫 리포트가 0이고,
 * 등록으로 위치가 실제로 바뀌었을 때만 1씩 올려 리포트를 다시 받는다.
 */
const revisionSchema = z.int().nonnegative();
export const SAVED_LOCATION_REVISION = 0;

/** 기기 위치에서 읽은 지명. 큰 제목은 도시, 작은 위치 줄은 동네다. */
const placeNameSchema = z.object({ city: z.string(), district: z.string().nullable() });
export type PlaceName = z.infer<typeof placeNameSchema>;

const locationReadingSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('needsPermission') }),
  z.object({ status: z.literal('denied') }),
  z.object({ status: z.literal('unavailable'), revision: revisionSchema }),
  z.object({
    status: z.literal('located'),
    registered: registeredLocationSchema,
    place: placeNameSchema.nullable(),
    countryCode: z.string().nullable(),
    revision: revisionSchema,
  }),
]);
export type LocationReading = z.infer<typeof locationReadingSchema>;

/** 약 1km(위도 0.01°) 안에서의 이동은 같은 날씨 격자로 보고 서버에 다시 등록하지 않는다. */
const RELOCATION_THRESHOLD_DEGREES = 0.01;

function isRelocationNeeded(next: Coordinates, previous: Coordinates | null): boolean {
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
  return isRelocationNeeded(registered, reportLocation) ? revision + 1 : revision;
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
  | { status: 'ready'; place: PlaceName | null; countryCode: string | null };

/** 권한은 있지만 위치를 읽지 못했거나 등록 요청이 실패하면 unavailable이다. */
function resolveLocationStatus(
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
    .with({ status: 'located' }, ({ place, countryCode }) => ({
      status: 'ready' as const,
      place,
      countryCode,
    }))
    .exhaustive();
}

/** 권한을 묻는 중이거나 거부한 동안에는 받을 리포트가 없다. 그 밖에는 서버에 저장된 위치로 받는다. */
function canFetchReport(status: WeatherLocationStatus['status']): boolean {
  return status !== 'needsPermission' && status !== 'denied';
}

type PermissionResult = 'granted' | 'needs_permission' | 'denied';

/** 권한 요청 자체가 실패하면(null) 다시 물을 수 있는 상태로 본다. */
function toPermissionResult(
  permission: { isGranted: boolean; canAskAgain: boolean } | null,
): PermissionResult {
  if (permission == null) {
    return 'needs_permission';
  }
  if (permission.isGranted) {
    return 'granted';
  }
  return permission.canAskAgain ? 'needs_permission' : 'denied';
}

export const WeatherLocationPolicy = {
  isRelocationNeeded,
  getNextRevision,
  getReadingRevision,
  resolveLocationStatus,
  canFetchReport,
  toPermissionResult,
} as const;
