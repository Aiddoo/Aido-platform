import { weatherLocationSchema } from '@aido/api';
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

/** 기기 위치에서 읽은 지명. 큰 제목은 도시, 작은 위치 줄은 동네다. */
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
  }),
]);
export type LocationReading = z.infer<typeof locationReadingSchema>;
