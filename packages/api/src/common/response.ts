import { z } from "zod";

import type { ErrorCodeType } from "../errors/errors.js";

/** JSON 성공 응답. Timestamp는 기존 앱과 동일한 epoch milliseconds다. */
export const successEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  timestamp: z.number(),
});

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: number;
}

/**
 * JSON 오류 응답. code는 새 서버가 추가한 코드도 파싱되도록 문자열로 받고,
 * details는 개발 환경에서만 내려온다.
 */
export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  timestamp: z.number(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export interface RestErrorResponse {
  success: false;
  error: {
    code: ErrorCodeType;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}
