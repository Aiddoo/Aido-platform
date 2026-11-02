import { weatherLocationSchema } from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

export const registeredLocationSchema = weatherLocationSchema;
export type RegisteredLocation = z.infer<typeof registeredLocationSchema>;

const coordinatesSchema = weatherLocationSchema.pick({ latitude: true, longitude: true });
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const locationReadingSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('needsPermission') }),
  z.object({ status: z.literal('denied') }),
  z.object({
    status: z.literal('located'),
    registered: registeredLocationSchema,
    placeName: z.string().nullable(),
  }),
]);
export type LocationReading = z.infer<typeof locationReadingSchema>;

/** 약 1km(위도 0.01°) 안에서의 이동은 같은 날씨 격자로 보고 서버에 다시 등록하지 않는다. */
const RELOCATION_THRESHOLD_DEGREES = 0.01;

export function isRelocationNeeded(next: Coordinates, previous: Coordinates | null): boolean {
  if (previous == null) {
    return true;
  }
  return (
    Math.abs(next.latitude - previous.latitude) >= RELOCATION_THRESHOLD_DEGREES ||
    Math.abs(next.longitude - previous.longitude) >= RELOCATION_THRESHOLD_DEGREES
  );
}

/** 위치를 읽지 못해도 서버에 저장된 위치로 날씨를 받을 수 있으므로 별도 리비전으로 요청한다. */
export const UNLOCATED_REVISION = 'unlocated';

export function toLocationRevision(location: Coordinates): string {
  return `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
}

export type WeatherLocationStatus =
  | { status: 'checking' }
  | { status: 'needsPermission' }
  | { status: 'denied' }
  | { status: 'ready'; locationRevision: string; placeName: string | null };

/**
 * 위치를 읽거나 등록하지 못해도(오류) 서버에 남은 위치로 날씨를 요청한다.
 * 서버에도 위치가 없으면 날씨 요청이 WEATHER_1902로 실패하고 그 자리에서 등록을 안내한다.
 */
export function resolveLocationStatus(
  reading: LocationReading | undefined,
  { hasFailed }: { hasFailed: boolean },
): WeatherLocationStatus {
  if (reading == null) {
    return hasFailed
      ? { status: 'ready', locationRevision: UNLOCATED_REVISION, placeName: null }
      : { status: 'checking' };
  }
  return match(reading)
    .with({ status: 'needsPermission' }, () => ({ status: 'needsPermission' as const }))
    .with({ status: 'denied' }, () => ({ status: 'denied' as const }))
    .with({ status: 'located' }, ({ registered, placeName }) => ({
      status: 'ready' as const,
      locationRevision: toLocationRevision(registered),
      placeName,
    }))
    .exhaustive();
}

export const WeatherLocationPolicy = {
  isRelocationNeeded,
  revision: toLocationRevision,
  status: resolveLocationStatus,
} as const;
