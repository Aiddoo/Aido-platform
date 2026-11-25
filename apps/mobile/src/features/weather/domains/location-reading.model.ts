import { match } from 'ts-pattern';
import { z } from 'zod';

/** 서버에 등록한 위치. 리포트는 이 위치의 예보다 */
export const registeredLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  // 예보 위치의 IANA 시간대. 런타임(Hermes)이 모르는 이름이면 null이다
  timezone: z.string().nullable(),
});
export type RegisteredLocation = z.infer<typeof registeredLocationSchema>;

/** 기기 위치와 서버에 등록한 위치를 같은 좌표 값으로 비교한다 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

const revisionSchema = z.int().nonnegative();
/** 기기에 저장된 위치로 받은 리포트의 리비전. 새로 등록할 때마다 1씩 올린다 */
const SAVED_LOCATION_REVISION = 0;

const placeNameSchema = z.object({ city: z.string(), district: z.string().nullable() });
export type PlaceName = z.infer<typeof placeNameSchema>;

/** 기기 위치를 읽은 결과. 읽었으면(located) 서버에 등록한 위치와 지명을 함께 둔다 */
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

/** 다시 읽은 지명. 읽지 못한 칸은 null이다 */
interface PlaceRead {
  name: PlaceName | null;
  countryCode: string | null;
}

export function shouldRelocate(next: Coordinates, previous: Coordinates | null): boolean {
  if (previous == null) {
    return true;
  }
  return (
    RELOCATION_THRESHOLD_DEGREES <= Math.abs(next.latitude - previous.latitude) ||
    RELOCATION_THRESHOLD_DEGREES <= Math.abs(next.longitude - previous.longitude)
  );
}

/** 권한을 묻는 중이거나 거부한 동안에는 받을 리포트가 없다. 그 밖에는 서버에 저장된 위치로 받는다. */
export function shouldFetchReport(status: WeatherLocationStatus['status']): boolean {
  return status !== 'needsPermission' && status !== 'denied';
}

export const LocationReadingPolicy = {
  /** 위치를 읽기 전이거나 권한이 없으면 서버 저장 위치의 리비전이다 */
  getRevision(reading: LocationReading | undefined): number {
    return reading?.status === 'located' || reading?.status === 'unavailable'
      ? reading.revision
      : SAVED_LOCATION_REVISION;
  },

  /** 리포트와 같은 격자면 리비전을 유지해 같은 요청을 두 번 보내지 않고, 비교할 리포트가 없으면 새 리비전이다 */
  getNextRevision(
    previous: LocationReading | undefined,
    registered: Coordinates,
    reportLocation: Coordinates | null,
  ): number {
    const revision = this.getRevision(previous);
    return shouldRelocate(registered, reportLocation) ? revision + 1 : revision;
  },

  /** 권한은 있지만 위치를 읽지 못했으면 unavailable이다. 읽는 중과 요청 실패는 조회 상태라 훅이 정한다 */
  getStatus(reading: LocationReading): WeatherLocationStatus {
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
  },

  /** 권한을 확인하지 못해 직전 위치를 쓰면 마지막 위치로 표시하고, 권한이 허용돼 있으면 표시를 푼다 */
  withLastKnown(reading: LocationReading, isLastKnown: boolean): LocationReading {
    return reading.status === 'located' ? { ...reading, isLastKnown } : reading;
  },

  /** 같은 격자에서 지명을 다시 읽었다. 읽지 못한 칸은 앞의 값을 두고 마지막 위치 표시를 푼다 */
  withPlaceRead(reading: LocationReading, place: PlaceRead): LocationReading {
    if (reading.status !== 'located') {
      return reading;
    }
    return {
      ...reading,
      place: place.name ?? reading.place,
      countryCode: place.countryCode ?? reading.countryCode,
      isLastKnown: false,
    };
  },

  /** 서버가 다시 등록한 위치로 바꾼다. 위치를 읽기 전이면 그대로다 */
  withRegistered(reading: LocationReading, registered: RegisteredLocation): LocationReading {
    return reading.status === 'located' ? { ...reading, registered } : reading;
  },
};
