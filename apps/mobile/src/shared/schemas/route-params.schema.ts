import { z } from 'zod';

const ROUTE_INTEGER_PATTERN = /^[1-9]\d*$/;

/** 경로 세그먼트처럼 읽기만 하는 숫자 값. 뒤에 계약 스키마를 잇는다. `z.encode`는 지나가지 못한다 */
export const routeIntegerStringSchema = z
  .string()
  .regex(ROUTE_INTEGER_PATTERN)
  .transform((value): unknown => value);

/** URL 값 `'12'`와 앱 값 `12`를 오가는 id. `useRouteParams`로 쓰는 필드는 이 코덱을 쓴다 */
export const routeIdSchema = z.codec(z.string().regex(ROUTE_INTEGER_PATTERN), z.int().positive(), {
  decode: Number,
  encode: String,
});
